-- Guest checkout: the immutable Order Snapshot a buyer creates, the terms they
-- accepted, and every attempt made to collect the money for it.
--
-- Four decisions shape everything below.
--
-- **An Order Snapshot is written once.** Triggers refuse every update and
-- delete on its lines and its accepted revisions, and refuse any update to the
-- order that would change what was bought, what it cost or who it is for. A
-- later retitle, reprice, archive or Paid Deliverable replacement therefore
-- cannot reach a purchase, whatever the application believes (CONTEXT.md).
--
-- **Payment truth is separate from the snapshot, and settles once.** The order
-- carries a Payment State and a Fulfillment State that are meant to change, but
-- a Payment State may only move out of `pending` — nothing may unsay that a
-- buyer paid, and no failed delivery may (ADR-0005). Attempts settle the same
-- way: a `pending` attempt becomes `redirected` or `failed` and then stops
-- being writable, so a retried request cannot rewrite what a provider said.
--
-- **What a version an order received is decided here.** The application passes
-- the products and the prices it resolved from Managed Content; the Paid
-- Deliverable Version of each line and the order's total are read and computed
-- inside `commerce_create_order`, from what is activated at that instant, so
-- neither is a number that travelled through a browser.
--
-- **These four functions carry no session, because a guest has none.** They are
-- granted to `anon` for the same reason
-- `commerce_active_paid_deliverable_skus()` is: the buyer is not a member of
-- WeCreate's staff and never will be. What that costs is bounded deliberately,
-- and it is worth being exact about what each one gives away to somebody
-- holding the anonymous key:
--
--   * `commerce_create_order` writes an order nobody has paid for. It cannot
--     approve one, and it cannot read one back.
--   * `commerce_order` reads one by a reference with fifty bits of randomness
--     in it, and returns no contact details beyond a masked address.
--   * `commerce_open_payment_attempt` adds a row to an order found the same
--     way, and returns exactly what `commerce_order` does — no buyer.
--   * `commerce_settle_payment_attempt` records what a provider answered for
--     one attempt, addressed by its own random identifier, and only while that
--     attempt is still pending.
--
-- None of them can move a Payment State: only a verified webhook may, and that
-- is issue #11's. In this application the anonymous key is server-only in any
-- case: no `NEXT_PUBLIC_SUPABASE_*` exists and no browser call to Supabase is
-- configured. Rate limiting and alerting on this surface are issue #17's.

-- ---------------------------------------------------------------------------
-- What is stored
-- ---------------------------------------------------------------------------

create table if not exists commerce.orders (
  id uuid primary key default gen_random_uuid(),
  -- WeCreate's own name for the order: printed on the ticket, quoted in
  -- support, and the only thing that addresses it.
  reference text not null unique,
  created_at timestamptz not null default now(),
  -- The buyer contact snapshot. Exactly what issue #1 allows a guest checkout
  -- to collect, and no postal address.
  buyer_full_name text not null,
  buyer_email text not null,
  buyer_telephone text not null,
  buyer_company text,
  -- Whole francs. WeCreate never charges a fraction of one.
  total_xof integer not null check (total_xof > 0),
  payment_state text not null default 'pending'
    check (payment_state in ('pending', 'approved', 'failed', 'cancelled')),
  fulfillment_state text not null default 'not_started'
    check (fulfillment_state in
      ('not_started', 'processing', 'delivered', 'failed'))
);

create table if not exists commerce.order_lines (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references commerce.orders (id),
  -- The Digital Product's identities, copied rather than referenced: Managed
  -- Content lives in another system entirely and this row may not depend on
  -- what an editor does next.
  product_id text not null,
  sku text not null,
  title text not null,
  unit_price_xof integer not null check (unit_price_xof > 0),
  -- The one identity that *is* a reference: the version this buyer bought, and
  -- which nothing may write over.
  paid_deliverable_version_id uuid not null
    references commerce.paid_deliverable_versions (id),
  paid_deliverable_version integer not null,
  line_order integer not null,
  -- One copy of each product: a Digital Product is licensed per buyer, so a
  -- second line for the same SKU is not a quantity of two.
  unique (order_id, sku)
);

create table if not exists commerce.order_legal_acceptances (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references commerce.orders (id),
  kind text not null,
  -- The revision identity, which still resolves to exactly those words.
  revision_id text not null,
  effective_from date not null,
  unique (order_id, kind)
);

create table if not exists commerce.payment_attempts (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references commerce.orders (id),
  -- The order they were made in, which two attempts sharing a millisecond
  -- cannot answer between them.
  sequence_number bigint generated always as identity,
  created_at timestamptz not null default now(),
  state text not null default 'pending'
    check (state in ('pending', 'redirected', 'failed')),
  provider text not null,
  provider_transaction_id text,
  -- Why the provider could not be reached. Words, never a payload or a secret.
  failure_reason text
);

create index if not exists order_lines_by_order
  on commerce.order_lines (order_id, line_order);
create index if not exists payment_attempts_in_order
  on commerce.payment_attempts (order_id, sequence_number);

-- ---------------------------------------------------------------------------
-- What cannot be undone
-- ---------------------------------------------------------------------------

drop trigger if exists order_lines_are_immutable on commerce.order_lines;
create trigger order_lines_are_immutable
  before update or delete on commerce.order_lines
  for each row execute function commerce.refuse_rewrite();

drop trigger if exists order_legal_acceptances_are_immutable
  on commerce.order_legal_acceptances;
create trigger order_legal_acceptances_are_immutable
  before update or delete on commerce.order_legal_acceptances
  for each row execute function commerce.refuse_rewrite();

-- The order itself is the one record here that is partly meant to change: its
-- Payment State and its Fulfillment State are tracked as it progresses, and
-- everything else about it was decided when the buyer pressed the button.
create or replace function commerce.refuse_order_rewrite()
  returns trigger
  language plpgsql
  set search_path = ''
as $$
begin
  if tg_op = 'DELETE' then
    raise exception 'commerce: an Order Snapshot may not be deleted'
      using errcode = '42501';
  end if;

  if new.reference is distinct from old.reference
     or new.created_at is distinct from old.created_at
     or new.total_xof is distinct from old.total_xof
     or new.buyer_full_name is distinct from old.buyer_full_name
     or new.buyer_email is distinct from old.buyer_email
     or new.buyer_telephone is distinct from old.buyer_telephone
     or new.buyer_company is distinct from old.buyer_company
  then
    raise exception 'commerce: an Order Snapshot is immutable after creation'
      using errcode = '42501';
  end if;

  -- Payment truth settles once. Only the first effective transition out of
  -- `pending` counts; a later or duplicate one is recorded as an attempt and
  -- reconciled by hand rather than rewriting what was already decided.
  if new.payment_state is distinct from old.payment_state
     and old.payment_state <> 'pending'
  then
    raise exception 'commerce: Payment State % is already decided', old.payment_state
      using errcode = '42501';
  end if;

  return new;
end;
$$;

drop trigger if exists orders_keep_their_snapshot on commerce.orders;
create trigger orders_keep_their_snapshot
  before update or delete on commerce.orders
  for each row execute function commerce.refuse_order_rewrite();

-- An attempt records what a provider said. Once it has said something, that is
-- what it said.
create or replace function commerce.refuse_attempt_rewrite()
  returns trigger
  language plpgsql
  set search_path = ''
as $$
begin
  if tg_op = 'DELETE' then
    raise exception 'commerce: a payment attempt may not be deleted'
      using errcode = '42501';
  end if;

  if old.state <> 'pending' then
    raise exception 'commerce: payment attempt % is already settled', old.id
      using errcode = '42501';
  end if;

  if new.order_id is distinct from old.order_id
     or new.created_at is distinct from old.created_at
     or new.provider is distinct from old.provider
  then
    raise exception 'commerce: a payment attempt keeps its order and provider'
      using errcode = '42501';
  end if;

  return new;
end;
$$;

drop trigger if exists payment_attempts_settle_once on commerce.payment_attempts;
create trigger payment_attempts_settle_once
  before update or delete on commerce.payment_attempts
  for each row execute function commerce.refuse_attempt_rewrite();

-- Row-level security with no policy at all, as everything else in this schema
-- has: the functions below run as the owner and are the only way in.
alter table commerce.orders enable row level security;
alter table commerce.order_lines enable row level security;
alter table commerce.order_legal_acceptances enable row level security;
alter table commerce.payment_attempts enable row level security;

-- ---------------------------------------------------------------------------
-- The whole surface
-- ---------------------------------------------------------------------------

-- `a***@exemple.com`: enough for a buyer to recognise their own address, and
-- not enough for anyone holding a reference to learn one.
create or replace function commerce.mask_email(p_email text)
  returns text
  language sql
  immutable
  set search_path = ''
as $$
  select case
    when p_email is null or strpos(p_email, '@') = 0 then '***'
    else left(p_email, 1) || '***' || substring(p_email from '@[^@]*$')
  end;
$$;

create or replace function commerce.attempt_json(t commerce.payment_attempts)
  returns jsonb
  language sql
  immutable
  set search_path = ''
as $$
  select jsonb_build_object(
    'id', t.id,
    'created_at', t.created_at,
    'state', t.state,
    'provider', t.provider,
    'provider_transaction_id', t.provider_transaction_id,
    'failure_reason', t.failure_reason
  );
$$;

-- One order as the boundary reports it. The buyer's contact details are
-- deliberately absent: this is read by reference alone, with no session behind
-- it, so it returns only what a page may show somebody holding that reference.
create or replace function commerce.order_json(o commerce.orders)
  returns jsonb
  language sql
  stable
  set search_path = ''
as $$
  select jsonb_build_object(
    'reference', o.reference,
    'created_at', o.created_at,
    'total_xof', o.total_xof,
    'buyer_email_hint', commerce.mask_email(o.buyer_email),
    'payment_state', o.payment_state,
    'fulfillment_state', o.fulfillment_state,
    'lines', coalesce((
      select jsonb_agg(
               jsonb_build_object(
                 'product_id', l.product_id,
                 'sku', l.sku,
                 'title', l.title,
                 'unit_price_xof', l.unit_price_xof,
                 'paid_deliverable_version_id', l.paid_deliverable_version_id,
                 'paid_deliverable_version', l.paid_deliverable_version
               ) order by l.line_order
             )
        from commerce.order_lines l
       where l.order_id = o.id
    ), '[]'::jsonb),
    'accepted_legal', coalesce((
      select jsonb_agg(
               jsonb_build_object(
                 'kind', a.kind,
                 'revision_id', a.revision_id,
                 'effective_from', a.effective_from
               ) order by a.kind
             )
        from commerce.order_legal_acceptances a
       where a.order_id = o.id
    ), '[]'::jsonb),
    'attempts', coalesce((
      select jsonb_agg(commerce.attempt_json(t.*) order by t.sequence_number)
        from commerce.payment_attempts t
       where t.order_id = o.id
    ), '[]'::jsonb)
  );
$$;

-- Write the Order Snapshot and open the first attempt against it, in one
-- transaction. Nothing reaches a payment provider before this has succeeded:
-- an order that arrived at FedaPay with nothing recorded here would be a charge
-- nobody could explain.
create or replace function public.commerce_create_order(
  p_reference text,
  p_lines jsonb,
  p_buyer jsonb,
  p_legal jsonb,
  p_provider text
)
  returns jsonb
  language plpgsql
  security definer
  set search_path = ''
as $$
declare
  created commerce.orders;
  attempt commerce.payment_attempts;
  missing text[];
begin
  if p_lines is null or jsonb_array_length(p_lines) = 0 then
    raise exception 'commerce: an order needs at least one line'
      using errcode = '22023';
  end if;

  -- Which of these products has no Paid Deliverable Version activated right
  -- now. Read here rather than accepted from the caller, so an order can never
  -- record a file WeCreate is not currently selling.
  select coalesce(array_agg(t.line ->> 'sku'), '{}')
    into missing
    from jsonb_array_elements(p_lines) as t(line)
   where not exists (
     select 1
       from commerce.active_paid_deliverables a
      where a.sku = t.line ->> 'sku'
   );

  if array_length(missing, 1) is not null then
    return jsonb_build_object(
      'status', 'refused',
      'skus_without_deliverable', to_jsonb(missing)
    );
  end if;

  insert into commerce.orders (
    reference, buyer_full_name, buyer_email, buyer_telephone, buyer_company,
    total_xof
  )
  values (
    p_reference,
    p_buyer ->> 'full_name',
    p_buyer ->> 'email',
    p_buyer ->> 'telephone',
    nullif(p_buyer ->> 'company', ''),
    -- The total is the sum of what is about to be stored. No amount a caller
    -- supplied decides what an order costs.
    (
      select sum((t.line ->> 'unit_price_xof')::integer)
        from jsonb_array_elements(p_lines) as t(line)
    )
  )
  returning * into created;

  insert into commerce.order_lines (
    order_id, product_id, sku, title, unit_price_xof,
    paid_deliverable_version_id, paid_deliverable_version, line_order
  )
  select
    created.id,
    t.line ->> 'product_id',
    t.line ->> 'sku',
    t.line ->> 'title',
    (t.line ->> 'unit_price_xof')::integer,
    a.version_id,
    v.version,
    t.n
  from jsonb_array_elements(p_lines) with ordinality as t(line, n)
  join commerce.active_paid_deliverables a on a.sku = t.line ->> 'sku'
  join commerce.paid_deliverable_versions v on v.id = a.version_id;

  insert into commerce.order_legal_acceptances (
    order_id, kind, revision_id, effective_from
  )
  select
    created.id,
    t.accepted ->> 'kind',
    t.accepted ->> 'revision_id',
    (t.accepted ->> 'effective_from')::date
  from jsonb_array_elements(coalesce(p_legal, '[]'::jsonb)) as t(accepted);

  insert into commerce.payment_attempts (order_id, provider)
  values (created.id, p_provider)
  returning * into attempt;

  return jsonb_build_object(
    'status', 'created',
    'order', commerce.order_json(created),
    'attempt', commerce.attempt_json(attempt)
  );
end;
$$;

-- Open another attempt against an order that is still waiting to be paid.
--
-- It returns no more than `commerce_order` does. Handing back the buyer's
-- contact details would be convenient — a payment provider needs a customer —
-- and it would turn a guessed reference into a way to read somebody's name,
-- email and telephone. The details the next attempt is made with come from the
-- request that asked for it instead.
create or replace function public.commerce_open_payment_attempt(p_reference text)
  returns jsonb
  language plpgsql
  security definer
  set search_path = ''
as $$
declare
  placed commerce.orders;
  attempt commerce.payment_attempts;
  last_provider text;
begin
  -- Still pending, and still inside the window its prices were recorded for.
  -- The application asks the same question before it renders a control
  -- (`ORDER_PAYABLE_SECONDS` in `src/commerce/orders.ts`); this is the copy that
  -- a request which never rendered a page is held to.
  select * into placed
    from commerce.orders o
   where o.reference = p_reference
     and o.payment_state = 'pending'
     and o.created_at > now() - interval '24 hours';
  if not found then
    return null;
  end if;

  select t.provider into last_provider
    from commerce.payment_attempts t
   where t.order_id = placed.id
   order by t.sequence_number desc
   limit 1;

  insert into commerce.payment_attempts (order_id, provider)
  values (placed.id, coalesce(last_provider, ''))
  returning * into attempt;

  return jsonb_build_object(
    'order', commerce.order_json(placed),
    'attempt', commerce.attempt_json(attempt)
  );
end;
$$;

-- Record what the provider answered for one attempt, or that it did not. It
-- settles a `pending` attempt and nothing else — the trigger refuses a second
-- answer — and it cannot touch an order's Payment State, which only a verified
-- webhook may move (issue #11).
create or replace function public.commerce_settle_payment_attempt(
  p_attempt_id uuid,
  p_state text,
  p_provider_transaction_id text,
  p_failure_reason text
)
  returns boolean
  language plpgsql
  security definer
  set search_path = ''
as $$
begin
  if p_state not in ('redirected', 'failed') then
    raise exception 'commerce: % is not an attempt outcome', p_state
      using errcode = '22023';
  end if;

  update commerce.payment_attempts t
     set state = p_state,
         provider_transaction_id =
           case when p_state = 'redirected' then p_provider_transaction_id end,
         failure_reason =
           case when p_state = 'failed' then p_failure_reason end
   where t.id = p_attempt_id and t.state = 'pending';

  return found;
end;
$$;

create or replace function public.commerce_order(p_reference text)
  returns jsonb
  language plpgsql
  stable
  security definer
  set search_path = ''
as $$
declare
  placed commerce.orders;
begin
  select * into placed from commerce.orders o where o.reference = p_reference;
  if not found then
    return null;
  end if;

  return commerce.order_json(placed);
end;
$$;

-- ---------------------------------------------------------------------------
-- Grants
-- ---------------------------------------------------------------------------

revoke all on function public.commerce_create_order(text, jsonb, jsonb, jsonb, text)
  from public;
revoke all on function public.commerce_open_payment_attempt(text) from public;
revoke all on function public.commerce_settle_payment_attempt(uuid, text, text, text)
  from public;
revoke all on function public.commerce_order(text) from public;

grant execute on function public.commerce_create_order(text, jsonb, jsonb, jsonb, text)
  to anon, authenticated;
grant execute on function public.commerce_open_payment_attempt(text)
  to anon, authenticated;
grant execute on function public.commerce_settle_payment_attempt(uuid, text, text, text)
  to anon, authenticated;
grant execute on function public.commerce_order(text) to anon, authenticated;
