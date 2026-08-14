-- Fulfillment: what an approved payment turns into, and how a buyer opens it.
--
-- Five decisions shape everything below.
--
-- **Delivery is claimed, once.** `commerce_begin_fulfillment` is the only way a
-- Fulfillment State leaves `not_started`, and it does so inside a transaction
-- that has the order row locked. Two webhooks racing and a provider
-- redelivering both go through it, and exactly one of them wins the claim —
-- which is what makes "one set of grants, one receipt" true rather than hoped
-- for (issue #1). Nothing here can touch a Payment State: a delivery that
-- failed must never be able to unsay that a buyer paid (ADR-0005).
--
-- **Only the digest of the token is stored.** The address a buyer is emailed
-- carries a high-entropy token; what is written here is its SHA-256. A leak of
-- this database is therefore not a leak of anybody's files, and no log, query
-- or backup can contain a working credential. Access is addressed by that
-- digest and by nothing else — the fifty-bit order reference opens nothing.
--
-- **A grant belongs to an order line, not to a token.** So reissuing a token
-- (a lost email, a corrected address — issue #15) leaves the allowance exactly
-- where the buyer left it, and a grant keeps pointing at the Paid Deliverable
-- Version its Order Snapshot recorded rather than at whatever is on sale today
-- (CONTEXT.md).
--
-- **A download is counted when a file is handed over, not when a button is
-- pressed.** `commerce_download_target` reads and refuses; the application then
-- asks Storage for a temporary address; only then does
-- `commerce_consume_download` spend one. So a store that did not answer costs
-- nobody anything. And while the last address is still good, asking again is
-- the *same* download — a fifteen-minute address expiring must not cost a buyer
-- part of what they paid for (issue #1).
--
-- **The two functions that write fulfillment carry the deployment's own
-- secret.** They are called from the webhook path, where there is no session
-- and never will be, and between them they can create an access token and mark
-- an order delivered. So they demand `WECREATE_PAYMENT_EVENT_SECRET` exactly as
-- `commerce_record_payment_event` does, and a leaked anonymous key grants
-- nothing. The two a buyer calls are bounded by the token digest instead, which
-- is a credential in its own right. Rate limiting and alerting on token
-- guessing are issue #17's.

-- ---------------------------------------------------------------------------
-- What is stored
-- ---------------------------------------------------------------------------

create table if not exists commerce.order_access (
  id uuid primary key default gen_random_uuid(),
  -- One per order, so reissuing a token (issue #15) replaces this row's digest
  -- rather than adding a second one that would also open the order.
  order_id uuid not null unique references commerce.orders (id),
  -- SHA-256 of the emailed token, hexadecimal. Never the token.
  token_digest text not null unique check (token_digest ~ '^[0-9a-f]{64}$'),
  issued_at timestamptz not null default now(),
  -- Thirty days after the payment was approved, not after this row was written:
  -- a deadline that moved with how long a delivery took to start would be one
  -- WeCreate shortened by being slow.
  expires_at timestamptz not null
);

create table if not exists commerce.order_access_grants (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references commerce.orders (id),
  -- One grant per purchased line, enforced rather than remembered: this is what
  -- makes a second claim unable to double anybody's allowance.
  order_line_id uuid not null unique references commerce.order_lines (id),
  sku text not null,
  downloads_allowed integer not null check (downloads_allowed > 0),
  downloads_used integer not null default 0 check (downloads_used >= 0),
  -- When the address last handed over stops working, or null before the first.
  link_expires_at timestamptz,
  -- No negative allowance and no uncontrolled duplication, whatever races
  -- (issue #1). The conditional update below cannot pass this, and neither can
  -- anything else that ever writes the row.
  check (downloads_used <= downloads_allowed)
);

create index if not exists order_access_grants_by_order
  on commerce.order_access_grants (order_id);

alter table commerce.order_access enable row level security;
alter table commerce.order_access_grants enable row level security;

-- ---------------------------------------------------------------------------
-- What cannot be undone
-- ---------------------------------------------------------------------------

-- A Fulfillment State is meant to change, and not in every direction. It starts
-- at `not_started`, is claimed into `processing`, and settles `delivered` or
-- `failed`. Nothing goes back, and nothing leaves `delivered` — a buyer who has
-- their files does not stop having them because a later process was confused.
-- A failed delivery therefore stays failed until an operator retries it, and
-- opening that path is issue #15's along with the surface that would use it.
create or replace function commerce.refuse_fulfillment_rewrite()
  returns trigger
  language plpgsql
  set search_path = ''
as $$
begin
  if new.fulfillment_state is not distinct from old.fulfillment_state then
    return new;
  end if;

  if not (
    (old.fulfillment_state = 'not_started' and new.fulfillment_state = 'processing')
    or (old.fulfillment_state = 'processing'
        and new.fulfillment_state in ('delivered', 'failed'))
  ) then
    raise exception 'commerce: Fulfillment State may not go from % to %',
      old.fulfillment_state, new.fulfillment_state
      using errcode = '42501';
  end if;

  -- Delivery follows payment and never leads it.
  if new.fulfillment_state = 'processing' and old.payment_state <> 'approved' then
    raise exception 'commerce: an unapproved order has nothing to deliver'
      using errcode = '42501';
  end if;

  return new;
end;
$$;

drop trigger if exists orders_follow_the_fulfillment_rule on commerce.orders;
create trigger orders_follow_the_fulfillment_rule
  before update on commerce.orders
  for each row execute function commerce.refuse_fulfillment_rewrite();

-- An access row and its grants are written once and deleted by nothing. A
-- reissue (issue #15) will replace a digest in place; nothing removes the row
-- that records what a buyer was granted.
create or replace function commerce.refuse_access_delete()
  returns trigger
  language plpgsql
  set search_path = ''
as $$
begin
  raise exception 'commerce: Order Access may not be deleted'
    using errcode = '42501';
end;
$$;

drop trigger if exists order_access_is_never_deleted on commerce.order_access;
create trigger order_access_is_never_deleted
  before delete on commerce.order_access
  for each row execute function commerce.refuse_access_delete();

drop trigger if exists order_access_grants_are_never_deleted
  on commerce.order_access_grants;
create trigger order_access_grants_are_never_deleted
  before delete on commerce.order_access_grants
  for each row execute function commerce.refuse_access_delete();

-- ---------------------------------------------------------------------------
-- The surface
-- ---------------------------------------------------------------------------

-- The same check `commerce_record_payment_event` makes, factored out because
-- three functions now make it. It reads no row until it has passed.
create or replace function commerce.require_payment_event_secret(p_secret text)
  returns void
  language plpgsql
  set search_path = ''
as $$
begin
  if not exists (
    select 1
      from commerce.payment_event_authorisation a
     where a.secret_digest =
           encode(sha256(convert_to(coalesce(p_secret, ''), 'UTF8')), 'hex')
  ) then
    raise exception 'commerce: this caller may not deliver orders'
      using errcode = '42501';
  end if;
end;
$$;

-- How much of the address last handed over for one grant is still good.
--
-- The rule, in one place, because three callers answer to it — the two
-- functions below and `liveLinkSeconds()` in `src/commerce/order-access.ts`,
-- which is its twin the way `paymentEventEffect()` is `payment_event_effect`'s.
-- Change one and change the other.
--
-- Zero means there is no live address, and zero is what makes the next one cost
-- a download.
create or replace function commerce.live_link_seconds(
  p_link_expires_at timestamptz
)
  returns integer
  language sql
  stable
  set search_path = ''
as $$
  select greatest(
    0,
    ceil(extract(epoch from coalesce(p_link_expires_at, now()) - now()))
  )::integer;
$$;

-- One order's access as the boundary reports it: what may still be opened,
-- until when, and how much of each is left. No digest leaves here, and no
-- storage address: the first is the credential and the second is issued only by
-- the download functions below.
create or replace function commerce.access_json(a commerce.order_access)
  returns jsonb
  language sql
  stable
  set search_path = ''
as $$
  select jsonb_build_object(
    'reference', (select o.reference from commerce.orders o where o.id = a.order_id),
    'expires_at', a.expires_at,
    'grants', coalesce((
      select jsonb_agg(
               jsonb_build_object(
                 'sku', g.sku,
                 'title', l.title,
                 'paid_deliverable_version', l.paid_deliverable_version,
                 'downloads_allowed', g.downloads_allowed,
                 'downloads_remaining', g.downloads_allowed - g.downloads_used
               ) order by l.line_order
             )
        from commerce.order_access_grants g
        join commerce.order_lines l on l.id = g.order_line_id
       where g.order_id = a.order_id
    ), '[]'::jsonb)
  );
$$;

-- Claim one approved order for delivery, and make its grants.
--
-- The claim and the grants are one transaction because they are one decision:
-- a caller that granted without claiming could grant twice, and one that
-- claimed without granting would mark an order delivered with nothing behind
-- it.
create or replace function public.commerce_begin_fulfillment(
  p_secret text,
  p_reference text,
  p_token_digest text,
  p_access_days integer,
  p_downloads_allowed integer
)
  returns jsonb
  language plpgsql
  security definer
  set search_path = ''
as $$
declare
  placed commerce.orders;
  held commerce.order_access;
  approved_at timestamptz;
begin
  perform commerce.require_payment_event_secret(p_secret);

  if p_token_digest !~ '^[0-9a-f]{64}$' then
    raise exception 'commerce: an access token digest is a SHA-256'
      using errcode = '22023';
  end if;

  -- Locked, so the second caller waits here and then finds the claim gone.
  select * into placed
    from commerce.orders o
   where o.reference = p_reference
     and o.payment_state = 'approved'
     and o.fulfillment_state = 'not_started'
     for update;
  if not found then
    return null;
  end if;

  update commerce.orders
     set fulfillment_state = 'processing'
   where id = placed.id
  returning * into placed;

  -- One per line. The claim above is what makes this run once, so there is
  -- nothing here to confirm or to skip.
  insert into commerce.order_access_grants (
    order_id, order_line_id, sku, downloads_allowed
  )
  select placed.id, l.id, l.sku, p_downloads_allowed
    from commerce.order_lines l
   where l.order_id = placed.id;

  -- When the money actually arrived, which is what the thirty days are measured
  -- from. The first event allowed to decide the Payment State is where that
  -- moment is recorded; `now()` stands in only for data old enough to predate
  -- the event trail.
  select e.received_at into approved_at
    from commerce.payment_events e
   where e.order_id = placed.id
     and e.disposition = 'applied'
     and e.outcome = 'approved'
   order by e.sequence_number
   limit 1;

  insert into commerce.order_access (order_id, token_digest, expires_at)
  values (
    placed.id,
    p_token_digest,
    coalesce(approved_at, now()) + make_interval(days => p_access_days)
  )
  returning * into held;

  return jsonb_build_object(
    'order', commerce.order_json(placed),
    'access', commerce.access_json(held),
    -- The one contact detail any of these functions returns, and the reason
    -- this one carries the deployment's own secret: a delivery has to know its
    -- address, and nothing addressed by an order reference alone ever learns it.
    'deliver_to', placed.buyer_email
  );
end;
$$;

-- Record how the delivery went. It moves a Fulfillment State and nothing else.
create or replace function public.commerce_settle_fulfillment(
  p_secret text,
  p_reference text,
  p_state text
)
  returns boolean
  language plpgsql
  security definer
  set search_path = ''
as $$
begin
  perform commerce.require_payment_event_secret(p_secret);

  if p_state not in ('delivered', 'failed') then
    raise exception 'commerce: % is not a delivery outcome', p_state
      using errcode = '22023';
  end if;

  -- Only what this caller claimed. A settlement for a delivery somebody else is
  -- running, or one already settled, is not this caller's to write.
  update commerce.orders o
     set fulfillment_state = p_state
   where o.reference = p_reference
     and o.fulfillment_state = 'processing';

  return found;
end;
$$;

-- What the holder of this token may still open.
--
-- Expired reads as nothing at all, exactly as a token nobody was ever given
-- does: a caller learns whether it may proceed and never why not.
create or replace function public.commerce_order_access(p_token_digest text)
  returns jsonb
  language plpgsql
  stable
  security definer
  set search_path = ''
as $$
declare
  held commerce.order_access;
begin
  select * into held
    from commerce.order_access a
   where a.token_digest = p_token_digest
     and a.expires_at > now();
  if not found then
    return null;
  end if;

  return commerce.access_json(held);
end;
$$;

-- The same, for a browser holding the order rather than the token.
--
-- What the paid checkout view prints. It shows and never opens: there is no
-- digest in what comes back, so nothing reached this way can be turned into a
-- download. Bounded like `commerce_order` is, by a reference with fifty bits of
-- randomness in it, and it returns strictly less than that function does.
--
-- Access that has run out answers nothing here too. The two reads apply one
-- rule between them, so a page cannot end up offering rows for something the
-- download functions would refuse.
create or replace function public.commerce_order_access_by_reference(
  p_reference text
)
  returns jsonb
  language plpgsql
  stable
  security definer
  set search_path = ''
as $$
declare
  held commerce.order_access;
begin
  select a.* into held
    from commerce.order_access a
    join commerce.orders o on o.id = a.order_id
   where o.reference = p_reference
     and a.expires_at > now();
  if not found then
    return null;
  end if;

  return commerce.access_json(held);
end;
$$;

-- Where one purchased file is, for a caller that has proved it may have it.
--
-- Read-only, and the reason it is separate from consuming a download: the
-- application signs a temporary address from what this returns, and only then
-- spends one. A store that did not answer therefore costs a buyer nothing.
--
-- `object_path` leaves here and goes no further than the adapter that signs
-- with it — it is never rendered, logged or stored (issue #1).
create or replace function public.commerce_download_target(
  p_token_digest text,
  p_sku text
)
  returns jsonb
  language plpgsql
  stable
  security definer
  set search_path = ''
as $$
declare
  held commerce.order_access;
  grant_row commerce.order_access_grants;
  target record;
begin
  select * into held
    from commerce.order_access a
   where a.token_digest = p_token_digest
     and a.expires_at > now();
  if not found then
    return jsonb_build_object('status', 'refused', 'reason', 'unknownAccess');
  end if;

  select g.* into grant_row
    from commerce.order_access_grants g
   where g.order_id = held.order_id and g.sku = p_sku;
  if not found then
    return jsonb_build_object('status', 'refused', 'reason', 'unknownProduct');
  end if;

  if commerce.live_link_seconds(grant_row.link_expires_at) = 0
     and grant_row.downloads_used >= grant_row.downloads_allowed
  then
    return jsonb_build_object('status', 'refused', 'reason', 'exhausted');
  end if;

  -- The version the Order Snapshot recorded, never the one on sale today.
  select v.object_path into target
    from commerce.order_lines l
    join commerce.paid_deliverable_versions v
      on v.id = l.paid_deliverable_version_id
   where l.id = grant_row.order_line_id;

  return jsonb_build_object(
    'status', 'found',
    'object_path', target.object_path,
    -- Signing for exactly what is left of the address last handed over, rather
    -- than for a fresh fifteen minutes, is what stops a buyer who keeps
    -- pressing from never spending a second download.
    'live_seconds', commerce.live_link_seconds(grant_row.link_expires_at)
  );
end;
$$;

-- Spend one download, or reuse the one still running.
--
-- The conditional update is the whole of the concurrency story: two requests
-- racing each other both try to move `downloads_used` from the value they read,
-- and only the one that still matches wins. There is no path here to a negative
-- allowance and none to two downloads spent for one press.
create or replace function public.commerce_consume_download(
  p_token_digest text,
  p_sku text,
  p_link_seconds integer
)
  returns jsonb
  language plpgsql
  security definer
  set search_path = ''
as $$
declare
  held commerce.order_access;
  grant_row commerce.order_access_grants;
begin
  select * into held
    from commerce.order_access a
   where a.token_digest = p_token_digest
     and a.expires_at > now();
  if not found then
    return jsonb_build_object('status', 'refused', 'reason', 'unknownAccess');
  end if;

  select g.* into grant_row
    from commerce.order_access_grants g
   where g.order_id = held.order_id and g.sku = p_sku
     for update;
  if not found then
    return jsonb_build_object('status', 'refused', 'reason', 'unknownProduct');
  end if;

  -- Still inside the address last handed over: the same download, and the
  -- expiry is deliberately left where it was.
  if commerce.live_link_seconds(grant_row.link_expires_at) > 0 then
    return jsonb_build_object(
      'status', 'opened',
      'downloads_remaining',
        grant_row.downloads_allowed - grant_row.downloads_used
    );
  end if;

  if grant_row.downloads_used >= grant_row.downloads_allowed then
    return jsonb_build_object('status', 'refused', 'reason', 'exhausted');
  end if;

  update commerce.order_access_grants g
     set downloads_used = g.downloads_used + 1,
         link_expires_at = now() + make_interval(secs => p_link_seconds)
   where g.id = grant_row.id
  returning * into grant_row;

  return jsonb_build_object(
    'status', 'opened',
    'downloads_remaining',
      grant_row.downloads_allowed - grant_row.downloads_used
  );
end;
$$;

-- ---------------------------------------------------------------------------
-- Naming the order a verified event decided
-- ---------------------------------------------------------------------------

-- `commerce_record_payment_event`, redefined here to say *which* order it just
-- decided.
--
-- Redefined in this migration rather than edited in the one that created it:
-- migrations are the record of what was applied, and rewriting an applied one
-- would make it a record of nothing. The body below is the previous one with a
-- third field on each answer.
--
-- The reason for the field is the whole of this slice. A webhook carries the
-- provider's transaction id and nothing of WeCreate's, so the endpoint that
-- records an approval has no way to name the order it approved — and the only
-- other way to find out is to read the order, which is a wider thing for that
-- caller to be allowed to do than being told its reference.
create or replace function public.commerce_record_payment_event(
  p_secret text,
  p_provider text,
  p_event_id text,
  p_event_type text,
  p_transaction_id text,
  p_occurred_at timestamptz,
  p_outcome text
)
  returns jsonb
  language plpgsql
  security definer
  set search_path = ''
as $$
declare
  placed commerce.orders;
  effect text;
begin
  perform commerce.require_payment_event_secret(p_secret);

  if p_outcome not in ('pending', 'approved', 'failed', 'cancelled') then
    raise exception 'commerce: % is not a payment outcome', p_outcome
      using errcode = '22023';
  end if;

  select o.* into placed
    from commerce.orders o
    join commerce.payment_attempts t on t.order_id = o.id
   where t.provider_transaction_id = p_transaction_id
   order by t.sequence_number desc
   limit 1
     for update of o;
  if not found then
    return jsonb_build_object(
      'disposition', 'unmatched',
      'payment_state', null,
      'order_reference', null
    );
  end if;

  if exists (
    select 1
      from commerce.payment_events e
     where e.provider = p_provider
       and e.provider_event_id = p_event_id
  ) then
    return jsonb_build_object(
      'disposition', 'duplicate',
      'payment_state', placed.payment_state,
      'order_reference', placed.reference
    );
  end if;

  effect := commerce.payment_event_effect(placed.payment_state, p_outcome);

  insert into commerce.payment_events (
    order_id, provider, provider_event_id, provider_event_type,
    provider_transaction_id, occurred_at, outcome, disposition
  )
  values (
    placed.id, p_provider, p_event_id, p_event_type,
    p_transaction_id, p_occurred_at, p_outcome, effect
  );

  if effect = 'applied' then
    update commerce.orders
       set payment_state = p_outcome
     where id = placed.id
    returning * into placed;
  end if;

  return jsonb_build_object(
    'disposition', effect,
    'payment_state', placed.payment_state,
    'order_reference', placed.reference
  );
exception
  when unique_violation then
    return jsonb_build_object(
      'disposition', 'duplicate',
      'payment_state', (
        select o.payment_state from commerce.orders o where o.id = placed.id
      ),
      'order_reference', placed.reference
    );
end;
$$;

-- ---------------------------------------------------------------------------
-- Grants
-- ---------------------------------------------------------------------------

revoke all on function public.commerce_begin_fulfillment(
  text, text, text, integer, integer
) from public;
revoke all on function public.commerce_settle_fulfillment(text, text, text)
  from public;
revoke all on function public.commerce_order_access(text) from public;
revoke all on function public.commerce_order_access_by_reference(text) from public;
revoke all on function public.commerce_download_target(text, text) from public;
revoke all on function public.commerce_consume_download(text, text, integer)
  from public;

-- The two that write a delivery are reached from the webhook path, which has no
-- session — and each demands the deployment's own secret before it reads a row.
grant execute on function public.commerce_begin_fulfillment(
  text, text, text, integer, integer
) to anon, authenticated;
grant execute on function public.commerce_settle_fulfillment(text, text, text)
  to anon, authenticated;

-- The three a buyer reaches carry no session either — a guest has none — and
-- are bounded by a credential of their own: a 256-bit token digest, or the
-- fifty-bit reference this browser is already carrying.
grant execute on function public.commerce_order_access(text)
  to anon, authenticated;
grant execute on function public.commerce_order_access_by_reference(text)
  to anon, authenticated;
grant execute on function public.commerce_download_target(text, text)
  to anon, authenticated;
grant execute on function public.commerce_consume_download(text, text, integer)
  to anon, authenticated;
