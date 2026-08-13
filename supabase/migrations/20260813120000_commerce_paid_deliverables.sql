-- WeCreate's commerce data plane: the private file behind each Digital
-- Product, which version of it is on sale, and an append-only record of what
-- staff did.
--
-- Three decisions shape everything below.
--
-- The tables live in a `commerce` schema that is NOT in the data API's exposed
-- schemas. Nothing can reach them over REST at all, whatever key it holds. Do
-- not add `commerce` to the exposed schemas: the functions in `public` are the
-- whole surface, and each one asks who is calling before it does anything.
--
-- Every function refuses a caller who has not reached assurance level 2 with
-- the Commerce Operator role. The application asks the same questions before it
-- renders a control or runs an action, but those checks live in a process that
-- could be wrong; this one cannot be got past by a request that never rendered
-- a page (issue #1).
--
-- Nothing here is reached with a service role key. The application signs in as
-- the individual member of staff doing the work and every statement runs under
-- their identity, which is what makes `auth.uid()` in an audit entry mean
-- something and what keeps these policies from being decorative.

create schema if not exists commerce;

-- ---------------------------------------------------------------------------
-- Who is allowed
-- ---------------------------------------------------------------------------

-- Assurance level 2 *and* the role. A password alone reaches level 1, so a
-- stolen one opens nothing here; and reaching level 2 as a Content Editor still
-- opens nothing, because editorial and commerce are separate permissions even
-- when the same person holds both (issue #1).
create or replace function commerce.is_operator()
  returns boolean
  language sql
  stable
  set search_path = ''
as $$
  select
    auth.uid() is not null
    and coalesce(auth.jwt() ->> 'aal', 'aal1') = 'aal2'
    and coalesce(auth.jwt() -> 'app_metadata' -> 'roles', '[]'::jsonb)
        ? 'commerce_operator';
$$;

create or replace function commerce.require_operator()
  returns void
  language plpgsql
  stable
  set search_path = ''
as $$
begin
  if not commerce.is_operator() then
    raise exception
      'commerce: a Commerce Operator at assurance level 2 is required'
      using errcode = '42501';
  end if;
end;
$$;

-- ---------------------------------------------------------------------------
-- What is stored
-- ---------------------------------------------------------------------------

-- One immutable revision of the file a buyer receives. An Order Snapshot
-- references exactly one of these rows, so none of them may ever change.
create table if not exists commerce.paid_deliverable_versions (
  id uuid primary key default gen_random_uuid(),
  -- The identity the CMS and this system share. Deliberately not a foreign key:
  -- Managed Content lives in another system entirely, and a product's editorial
  -- record being edited, moved or archived must not touch what was delivered.
  sku text not null,
  version integer not null check (version > 0),
  -- Where the bytes are, named after the file's own checksum so a version can
  -- only ever be added, never written over.
  object_path text not null,
  file_name text not null,
  content_type text not null,
  byte_size bigint not null check (byte_size > 0),
  checksum_sha256 text not null check (checksum_sha256 ~ '^[0-9a-f]{64}$'),
  created_at timestamptz not null default now(),
  created_by uuid not null references auth.users (id),
  created_by_email text not null,
  unique (sku, version),
  -- Two versions of one product are two different files: re-uploading the same
  -- bytes is not a replacement, and is refused rather than duplicated.
  unique (sku, checksum_sha256),
  unique (object_path)
);

-- Which version future purchases receive. A row per product rather than a flag
-- on a version, so activating one is structurally incapable of altering another.
create table if not exists commerce.active_paid_deliverables (
  sku text primary key,
  version_id uuid not null references commerce.paid_deliverable_versions (id),
  activated_at timestamptz not null default now(),
  activated_by uuid not null references auth.users (id)
);

-- What staff did: who, when, to which product, and the safe half of what
-- changed on either side. Never a secret, a token or a storage address.
create table if not exists commerce.audit_entries (
  id uuid primary key default gen_random_uuid(),
  -- The order things happened in, which two entries sharing a millisecond
  -- cannot answer between them. An append-only trail is read newest first, and
  -- "newest" has to mean "written last" rather than "sorted highest".
  sequence_number bigint generated always as identity,
  occurred_at timestamptz not null default now(),
  actor_id uuid not null references auth.users (id),
  actor_email text not null,
  action text not null,
  sku text not null,
  before jsonb,
  after jsonb
);

create index if not exists audit_entries_in_order
  on commerce.audit_entries (sequence_number desc);

-- ---------------------------------------------------------------------------
-- What cannot be undone
-- ---------------------------------------------------------------------------

create or replace function commerce.refuse_rewrite()
  returns trigger
  language plpgsql
  set search_path = ''
as $$
begin
  raise exception 'commerce: %.% is append-only; % is refused',
    tg_table_schema, tg_table_name, tg_op
    using errcode = '42501';
end;
$$;

drop trigger if exists paid_deliverable_versions_are_immutable
  on commerce.paid_deliverable_versions;
create trigger paid_deliverable_versions_are_immutable
  before update or delete on commerce.paid_deliverable_versions
  for each row execute function commerce.refuse_rewrite();

drop trigger if exists audit_entries_are_append_only
  on commerce.audit_entries;
create trigger audit_entries_are_append_only
  before update or delete on commerce.audit_entries
  for each row execute function commerce.refuse_rewrite();

-- `active_paid_deliverables` is deliberately not protected this way: which
-- version is on sale is the one thing here that is meant to change.

-- Row-level security with no policy at all, which denies every row to every
-- role but the owner. The functions below run as the owner and are the only way
-- in; a request that reached these tables another way finds nothing.
alter table commerce.paid_deliverable_versions enable row level security;
alter table commerce.active_paid_deliverables enable row level security;
alter table commerce.audit_entries enable row level security;

-- ---------------------------------------------------------------------------
-- The whole surface
-- ---------------------------------------------------------------------------

-- The safe half of a version, for an audit entry: what it is, never where it is
-- kept. Written once so the two functions that record a change cannot describe
-- one differently.
create or replace function commerce.audit_metadata(
  v commerce.paid_deliverable_versions
)
  returns jsonb
  language sql
  immutable
  set search_path = ''
as $$
  select case
    when v.id is null then null
    else jsonb_build_object(
      'version', v.version,
      'file_name', v.file_name,
      'checksum', v.checksum_sha256
    )
  end;
$$;

create or replace function commerce.version_json(
  v commerce.paid_deliverable_versions
)
  returns jsonb
  language sql
  immutable
  set search_path = ''
as $$
  select jsonb_build_object(
    'id', v.id,
    'sku', v.sku,
    'version', v.version,
    'file_name', v.file_name,
    'content_type', v.content_type,
    'byte_size', v.byte_size,
    'checksum', v.checksum_sha256,
    'created_at', v.created_at,
    'created_by_email', v.created_by_email
  );
$$;

-- Every Paid Deliverable, with its versions newest first and the one on sale.
create or replace function public.commerce_paid_deliverables()
  returns jsonb
  language plpgsql
  stable
  security definer
  set search_path = ''
as $$
begin
  perform commerce.require_operator();

  return coalesce((
    select jsonb_agg(entry order by entry ->> 'sku')
      from (
        select jsonb_build_object(
                 'sku', v.sku,
                 'active_version_id', (
                   select a.version_id
                     from commerce.active_paid_deliverables a
                    where a.sku = v.sku
                 ),
                 'versions', jsonb_agg(
                   commerce.version_json(v.*) order by v.version desc
                 )
               ) as entry
          from commerce.paid_deliverable_versions v
         group by v.sku
      ) grouped
  ), '[]'::jsonb);
end;
$$;

-- Record an uploaded file as the next immutable version of a product's Paid
-- Deliverable, and say so in the audit trail, in one transaction.
--
-- The version number is taken from what is already stored rather than supplied
-- by the caller, so nothing outside this function decides what a version is. Two
-- uploads for one product racing each other both compute the same number and
-- the unique constraint refuses the second — the operator uploads it again,
-- which is the right outcome and better than a silently overwritten version.
create or replace function public.commerce_create_paid_deliverable_version(
  p_sku text,
  p_object_path text,
  p_file_name text,
  p_content_type text,
  p_byte_size bigint,
  p_checksum text
)
  returns jsonb
  language plpgsql
  security definer
  set search_path = ''
as $$
declare
  created commerce.paid_deliverable_versions;
begin
  perform commerce.require_operator();

  insert into commerce.paid_deliverable_versions (
    sku, version, object_path, file_name, content_type, byte_size,
    checksum_sha256, created_by, created_by_email
  )
  values (
    p_sku,
    coalesce((
      select max(v.version)
        from commerce.paid_deliverable_versions v
       where v.sku = p_sku
    ), 0) + 1,
    p_object_path, p_file_name, p_content_type, p_byte_size, p_checksum,
    auth.uid(), auth.jwt() ->> 'email'
  )
  returning * into created;

  insert into commerce.audit_entries (
    actor_id, actor_email, action, sku, before, after
  )
  values (
    auth.uid(), auth.jwt() ->> 'email',
    'paid-deliverable-version.created', p_sku, null,
    commerce.audit_metadata(created)
  );

  return commerce.version_json(created);
end;
$$;

-- Make one existing version the one future purchases receive. Returns null when
-- the version does not belong to that product, so a crafted request cannot
-- attach one product's file to another.
create or replace function public.commerce_activate_paid_deliverable_version(
  p_sku text,
  p_version_id uuid
)
  returns jsonb
  language plpgsql
  security definer
  set search_path = ''
as $$
declare
  target commerce.paid_deliverable_versions;
  previous commerce.paid_deliverable_versions;
begin
  perform commerce.require_operator();

  select * into target
    from commerce.paid_deliverable_versions v
   where v.id = p_version_id and v.sku = p_sku;
  if not found then
    return null;
  end if;

  select v.* into previous
    from commerce.active_paid_deliverables a
    join commerce.paid_deliverable_versions v on v.id = a.version_id
   where a.sku = p_sku;

  insert into commerce.active_paid_deliverables (sku, version_id, activated_by)
  values (p_sku, target.id, auth.uid())
  on conflict (sku) do update
    set version_id = excluded.version_id,
        activated_at = now(),
        activated_by = excluded.activated_by;

  insert into commerce.audit_entries (
    actor_id, actor_email, action, sku, before, after
  )
  values (
    auth.uid(), auth.jwt() ->> 'email',
    'paid-deliverable-version.activated', p_sku,
    commerce.audit_metadata(previous),
    commerce.audit_metadata(target)
  );

  return commerce.version_json(target);
end;
$$;

create or replace function public.commerce_audit_entries(p_limit integer default 50)
  returns jsonb
  language plpgsql
  stable
  security definer
  set search_path = ''
as $$
begin
  perform commerce.require_operator();

  -- Ordered by the sequence rather than by the rendered timestamp: sorting the
  -- built JSON would compare `occurred_at` as text, which is a different
  -- question and answers it wrongly for two entries in the same millisecond.
  return coalesce((
    select jsonb_agg(recent.entry order by recent.sequence_number desc)
      from (
        select e.sequence_number,
               jsonb_build_object(
                 'id', e.id,
                 'occurred_at', e.occurred_at,
                 'actor_email', e.actor_email,
                 'action', e.action,
                 'sku', e.sku,
                 'before', e.before,
                 'after', e.after
               ) as entry
          from commerce.audit_entries e
         order by e.sequence_number desc
         limit greatest(coalesce(p_limit, 50), 0)
      ) recent
  ), '[]'::jsonb);
end;
$$;

-- The one function with no session behind it.
--
-- It answers which products have a file ready — the same thing every product
-- card in the Boutique already says out loud — and nothing else: no file name,
-- no checksum, no address, no staff identity. The application reads it once per
-- cache fill rather than per request, so no visit to the public site reaches
-- this database at all (ADR-0003).
create or replace function public.commerce_active_paid_deliverable_skus()
  returns jsonb
  language sql
  stable
  security definer
  set search_path = ''
as $$
  select coalesce(jsonb_agg(a.sku order by a.sku), '[]'::jsonb)
    from commerce.active_paid_deliverables a;
$$;

-- ---------------------------------------------------------------------------
-- Grants
-- ---------------------------------------------------------------------------

-- Postgres grants EXECUTE to PUBLIC on a new function, so each one is taken
-- back and given out deliberately.
revoke all on function public.commerce_paid_deliverables() from public;
revoke all on function public.commerce_create_paid_deliverable_version(
  text, text, text, text, bigint, text
) from public;
revoke all on function public.commerce_activate_paid_deliverable_version(text, uuid)
  from public;
revoke all on function public.commerce_audit_entries(integer) from public;
revoke all on function public.commerce_active_paid_deliverable_skus() from public;

grant execute on function public.commerce_paid_deliverables() to authenticated;
grant execute on function public.commerce_create_paid_deliverable_version(
  text, text, text, text, bigint, text
) to authenticated;
grant execute on function public.commerce_activate_paid_deliverable_version(text, uuid)
  to authenticated;
grant execute on function public.commerce_audit_entries(integer) to authenticated;
grant execute on function public.commerce_active_paid_deliverable_skus()
  to anon, authenticated;

-- Enough of the `commerce` schema for the storage policy below to call its
-- guard. No table privileges are granted with it, and row-level security denies
-- the tables regardless.
grant usage on schema commerce to authenticated;
grant execute on function commerce.is_operator() to authenticated;

-- ---------------------------------------------------------------------------
-- Private storage
-- ---------------------------------------------------------------------------

insert into storage.buckets (id, name, public)
values ('paid-deliverables', 'paid-deliverables', false)
on conflict (id) do nothing;

drop policy if exists "Commerce Operators store Paid Deliverable Versions"
  on storage.objects;
create policy "Commerce Operators store Paid Deliverable Versions"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'paid-deliverables' and commerce.is_operator()
  );

-- There is deliberately no select, update or delete policy on this bucket.
--
-- Nothing may write over a stored version, and nothing reads a Paid Deliverable
-- with a staff session: a buyer receives one through a short-lived signed link
-- issued against valid Order Access, which is issue #12's to build and will say
-- so in a policy of its own. Until then the bytes are write-once and unreadable,
-- which is the correct state for a file nobody has bought yet.
