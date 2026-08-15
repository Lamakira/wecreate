-- Keeping approval and delivery exactly once when the failures are not tidy.
--
-- Everything before this migration is right about the ordinary path: an event
-- is recorded once, an approval decides a payment once, a delivery is claimed
-- once. What it does not survive is the untidy half — a process that stops
-- between claiming a delivery and finishing it, a second transaction the buyer
-- was charged for, an abandoned request waking up to settle a delivery that has
-- since been done by somebody else. Three changes here, and each closes one of
-- those.
--
-- **A claim is held by a caller, not by a state.** `fulfillment_claim_id` and
-- `fulfillment_claimed_at` say who is delivering and since when. A settlement
-- names the claim it settles, so a request that gave up ten minutes ago cannot
-- mark an order failed that has just been delivered — and a claim nobody
-- finished can be taken up once it is old enough to be abandoned (ADR-0010).
--
-- **Being claimable again is only safe if everything durable is idempotent.**
-- The grants are inserted `on conflict do nothing` — a buyer's allowance is
-- theirs and a second delivery must not reset it — and the access row is
-- reissued in place rather than added to, so one order has one live token
-- however many times it was delivered. The expiry is *not* recomputed: thirty
-- days run from the approval, and a delivery taken up a day late must not hand
-- a buyer a day less than they paid for.
--
-- **What no rule could settle is written down instead of guessed at.**
-- `commerce.order_anomalies` is what issue #15's Commerce Operator view will
-- read: a second approved transaction, a provider contradicting itself, and a
-- delivery that failed. Three things a person has to decide something about,
-- and nothing else — a delivery taken up again is not one of them, however
-- interesting it is, because there is nothing for anybody to do about it. It
-- holds the provider's own identifiers, which are not secrets and are what an
-- operator has in front of them in a provider dashboard, and nothing of the
-- buyer, no delivery body, no token and no storage address.
--
-- Nothing here loosens the one direction that is closed. A Payment State still
-- may not leave `approved`, still may leave a refusal only for an approval, and
-- is still moved by `commerce_record_payment_event` alone (ADR-0005, ADR-0009).
-- A `delivered` order is terminal here in exactly the same way.

-- ---------------------------------------------------------------------------
-- Who is delivering, and since when
-- ---------------------------------------------------------------------------

alter table commerce.orders
  add column if not exists fulfillment_claim_id uuid,
  add column if not exists fulfillment_claimed_at timestamptz;

-- ---------------------------------------------------------------------------
-- What a person has to settle
-- ---------------------------------------------------------------------------

create table if not exists commerce.order_anomalies (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references commerce.orders (id),
  -- The order they were detected in, which two sharing a millisecond cannot
  -- answer between them.
  sequence_number bigint generated always as identity,
  kind text not null check (kind in (
    'duplicate_payment',
    'contradictory_event',
    'fulfillment_failed'
  )),
  detected_at timestamptz not null default now(),
  -- The provider's own identifiers, and only ever these. Enough to find the
  -- transaction in a provider's dashboard and refund it; not a copy of what the
  -- provider sent, which would be an unbounded copy of a buyer's details in a
  -- table nobody opens until something has gone wrong (issue #1).
  provider text,
  provider_transaction_id text,
  provider_event_id text,
  -- Why, in words this application wrote. Never a payload, an address or a key.
  detail text check (detail is null or length(detail) <= 200),
  -- When a Commerce Operator settled it. Issue #15 is what closes one; nothing
  -- here ever does.
  resolved_at timestamptz,
  -- One row per thing that happened, so a provider redelivering an event it has
  -- already been acknowledged for cannot pile up rows for one anomaly.
  unique (kind, provider, provider_event_id)
);

create index if not exists order_anomalies_in_order
  on commerce.order_anomalies (order_id, sequence_number);

-- A delivery that failed carries no provider identity of its own, so the
-- constraint above cannot bound it — and it would otherwise gain a row every
-- time the provider redelivers into a mail outage. What an operator has to
-- settle is one thing per order either way: this buyer paid and has not been
-- written to. So one outstanding row per order, and a new one only once the
-- last has been dealt with.
create unique index if not exists order_anomalies_one_open_failure
  on commerce.order_anomalies (order_id)
  where kind = 'fulfillment_failed' and resolved_at is null;

alter table commerce.order_anomalies enable row level security;

-- Append-only in the half that matters. What was detected was detected, and a
-- row is never deleted; the one thing that may change is an operator recording
-- that they have dealt with it, and only in that direction (issue #15).
create or replace function commerce.refuse_anomaly_rewrite()
  returns trigger
  language plpgsql
  set search_path = ''
as $$
begin
  if tg_op = 'DELETE' then
    raise exception 'commerce: an order anomaly may not be deleted'
      using errcode = '42501';
  end if;

  if new.order_id is distinct from old.order_id
     or new.kind is distinct from old.kind
     or new.detected_at is distinct from old.detected_at
     or new.provider is distinct from old.provider
     or new.provider_transaction_id is distinct from old.provider_transaction_id
     or new.provider_event_id is distinct from old.provider_event_id
     or new.detail is distinct from old.detail
  then
    raise exception 'commerce: an order anomaly is immutable once detected'
      using errcode = '42501';
  end if;

  if old.resolved_at is not null and new.resolved_at is distinct from old.resolved_at
  then
    raise exception 'commerce: an order anomaly is settled once'
      using errcode = '42501';
  end if;

  return new;
end;
$$;

drop trigger if exists order_anomalies_are_append_only on commerce.order_anomalies;
create trigger order_anomalies_are_append_only
  before update or delete on commerce.order_anomalies
  for each row execute function commerce.refuse_anomaly_rewrite();

-- Write one down, and say nothing if it is already written down.
--
-- The conflict is the ordinary case rather than the exception: a provider
-- redelivering an approval it was already acknowledged for arrives here again,
-- and a delivery failing again while nobody has dealt with the last one is
-- still one buyer who has not been written to. One anomaly is one anomaly.
create or replace function commerce.note_anomaly(
  p_order_id uuid,
  p_kind text,
  p_provider text,
  p_transaction_id text,
  p_event_id text,
  p_detail text
)
  returns void
  language sql
  set search_path = ''
as $$
  insert into commerce.order_anomalies (
    order_id, kind, provider, provider_transaction_id, provider_event_id, detail
  )
  values (
    p_order_id, p_kind, p_provider, p_transaction_id, p_event_id, left(p_detail, 200)
  )
  on conflict do nothing;
$$;

-- ---------------------------------------------------------------------------
-- What a verified event leaves for a person
-- ---------------------------------------------------------------------------

-- The twin of `paymentEventAnomaly()` in `src/commerce/orders.ts`. Change one
-- and change the other.
--
-- It exists because `payment_event_effect` answers a narrower question than it
-- looks like it does: it says what an event may do to a Payment State, not
-- whether the event arriving at all is fine. Two of its answers are ambiguous
-- in exactly that way, and which transaction the event is about is what tells
-- the halves apart — a second approval for the transaction that already paid is
-- the provider repeating itself, and for another transaction it is a buyer
-- charged twice.
create or replace function commerce.payment_event_anomaly(
  p_current text,
  p_outcome text,
  p_effect text,
  p_decided_by_this_transaction boolean
)
  returns text
  language sql
  immutable
  set search_path = ''
as $$
  select case
    -- An announcement is not a verdict, so it can neither contradict one nor be
    -- a second payment.
    when p_outcome = 'pending' then null
    when p_effect = 'superseded' then
      case when p_decided_by_this_transaction then 'contradictory_event' end
    when p_effect = 'unchanged'
     and p_outcome = 'approved'
     and p_current = 'approved'
     and not p_decided_by_this_transaction then 'duplicate_payment'
  end;
$$;

-- `commerce_record_payment_event`, redefined here to notice what it cannot
-- settle.
--
-- Redefined rather than edited in the migration that created it: migrations are
-- the record of what was applied, and rewriting an applied one would make it a
-- record of nothing. The body below is the previous one with the anomaly rule
-- applied to what it had already decided.
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
  deciding text;
  anomaly text;
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

  -- Which transaction's verdict is the one currently standing. Null while
  -- nothing has decided anything, which is when neither anomaly is possible.
  select e.provider_transaction_id into deciding
    from commerce.payment_events e
   where e.order_id = placed.id
     and e.disposition = 'applied'
   order by e.sequence_number desc
   limit 1;

  insert into commerce.payment_events (
    order_id, provider, provider_event_id, provider_event_type,
    provider_transaction_id, occurred_at, outcome, disposition
  )
  values (
    placed.id, p_provider, p_event_id, p_event_type,
    p_transaction_id, p_occurred_at, p_outcome, effect
  );

  anomaly := commerce.payment_event_anomaly(
    placed.payment_state,
    p_outcome,
    effect,
    deciding is not distinct from p_transaction_id
  );
  if anomaly is not null then
    perform commerce.note_anomaly(
      placed.id, anomaly, p_provider, p_transaction_id, p_event_id, null
    );
  end if;

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
-- A delivery that can be taken up again
-- ---------------------------------------------------------------------------

-- A Fulfillment State starts at `not_started`, is claimed into `processing`,
-- and settles `delivered` or `failed`. What changes here is which of those may
-- be claimed again: a delivery that failed, and one claimed and left unfinished
-- (ADR-0010). `delivered` is terminal in every direction, as it always was — a
-- buyer who has their files does not stop having them because a later process
-- was confused — and nothing here may reach a Payment State.
create or replace function commerce.refuse_fulfillment_rewrite()
  returns trigger
  language plpgsql
  set search_path = ''
as $$
begin
  if new.fulfillment_state is not distinct from old.fulfillment_state then
    return new;
  end if;

  if old.fulfillment_state = 'delivered' then
    raise exception 'commerce: a delivered order stays delivered'
      using errcode = '42501';
  end if;

  if not (
    (old.fulfillment_state in ('not_started', 'failed')
     and new.fulfillment_state = 'processing')
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

-- One order's access as the boundary reports it, now saying when the token in
-- force was issued.
--
-- That moment is the name of *this* issuance, and the receipt carrying the
-- token is idempotent under it: a delivery taken up again emails a fresh token,
-- and a key naming only the order would let a provider swallow the second
-- message as a repeat of one the buyer never received.
create or replace function commerce.access_json(a commerce.order_access)
  returns jsonb
  language sql
  stable
  set search_path = ''
as $$
  select jsonb_build_object(
    'reference', (select o.reference from commerce.orders o where o.id = a.order_id),
    'issued_at', a.issued_at,
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

-- The five-argument claim is replaced rather than overloaded: two functions
-- differing only in how much they know about abandoned claims would be one
-- function too many, and the older one is the one with the hole in it.
drop function if exists public.commerce_begin_fulfillment(
  text, text, text, integer, integer
);

-- Claim one approved order for delivery, and make its grants.
--
-- The claim and the grants are one transaction because they are one decision: a
-- caller that granted without claiming could grant twice, and one that claimed
-- without granting would mark an order delivered with nothing behind it.
--
-- Three orders are claimable and no others: one nobody has delivered, one whose
-- delivery failed, and one claimed longer than `p_stalled_seconds` ago and
-- never settled. The row is locked, so the second caller of the moment waits
-- here and then finds the claim gone.
--
-- What makes the second and third safe is that everything durable below is
-- idempotent. The grants a buyer already has are left exactly as they left
-- them — allowance included, which is why this may not simply insert — and the
-- access row is reissued in place, so one order has one live token however many
-- deliveries it took. The expiry is deliberately not recomputed: thirty days
-- run from the approval, and a delivery taken up a day late must not hand a
-- buyer a day less than they paid for.
create or replace function public.commerce_begin_fulfillment(
  p_secret text,
  p_reference text,
  p_token_digest text,
  p_access_days integer,
  p_downloads_allowed integer,
  p_stalled_seconds integer
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
  claim uuid := gen_random_uuid();
begin
  perform commerce.require_payment_event_secret(p_secret);

  if p_token_digest !~ '^[0-9a-f]{64}$' then
    raise exception 'commerce: an access token digest is a SHA-256'
      using errcode = '22023';
  end if;

  select * into placed
    from commerce.orders o
   where o.reference = p_reference
     and o.payment_state = 'approved'
     and (
       o.fulfillment_state in ('not_started', 'failed')
       or (o.fulfillment_state = 'processing'
           -- A claim with no moment on it is one from before there were any:
           -- these two columns arrive with this migration, so an order already
           -- being delivered when it is applied has nothing to wait out. Left
           -- as a plain comparison it would be `null < …`, which is null, and
           -- that order would be unclaimable and unsettleable for ever — the
           -- exact failure ADR-0010 exists to remove. `claimable()` in
           -- `src/commerce/fixture/provider.ts` reads it the same way.
           and coalesce(o.fulfillment_claimed_at, '-infinity'::timestamptz)
               < now() - make_interval(secs => p_stalled_seconds))
     )
     for update;
  if not found then
    return null;
  end if;

  update commerce.orders
     set fulfillment_state = 'processing',
         fulfillment_claim_id = claim,
         fulfillment_claimed_at = now()
   where id = placed.id
  returning * into placed;

  -- One per line, and never a second time: a grant belongs to an order line,
  -- and the allowance on it is the buyer's rather than this delivery's.
  insert into commerce.order_access_grants (
    order_id, order_line_id, sku, downloads_allowed
  )
  select placed.id, l.id, l.sku, p_downloads_allowed
    from commerce.order_lines l
   where l.order_id = placed.id
  on conflict (order_line_id) do nothing;

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
  -- Reissued, not added to: one order has one live token, and the address a
  -- failed delivery would have emailed stops working when the next one goes
  -- out. The expiry is left where it was, because it belongs to the approval.
  on conflict (order_id) do update
     set token_digest = excluded.token_digest,
         issued_at = now()
  returning * into held;

  return jsonb_build_object(
    'order', commerce.order_json(placed),
    'access', commerce.access_json(held),
    'claim_id', claim,
    -- The one contact detail any of these functions returns, and the reason
    -- this one carries the deployment's own secret: a delivery has to know its
    -- address, and nothing addressed by an order reference alone ever learns it.
    'deliver_to', placed.buyer_email
  );
end;
$$;

-- The three-argument settlement is replaced for the reason the claim is: a
-- settlement that did not name its claim is one that can settle somebody else's.
drop function if exists public.commerce_settle_fulfillment(text, text, text);

-- Record how the delivery this caller claimed went.
--
-- It moves a Fulfillment State and nothing else. `p_claim_id` is what makes it
-- *this caller's* delivery: an abandoned request waking up to report a failure
-- would otherwise settle the delivery that replaced it, and mark an order
-- failed that had just succeeded.
create or replace function public.commerce_settle_fulfillment(
  p_secret text,
  p_reference text,
  p_state text,
  p_claim_id uuid
)
  returns boolean
  language plpgsql
  security definer
  set search_path = ''
as $$
declare
  settled commerce.orders;
begin
  perform commerce.require_payment_event_secret(p_secret);

  if p_state not in ('delivered', 'failed') then
    raise exception 'commerce: % is not a delivery outcome', p_state
      using errcode = '22023';
  end if;

  update commerce.orders o
     set fulfillment_state = p_state
   where o.reference = p_reference
     and o.fulfillment_state = 'processing'
     and o.fulfillment_claim_id = p_claim_id
  returning * into settled;
  if not found then
    return false;
  end if;

  -- A buyer who paid and did not receive their receipt is a person WeCreate has
  -- to write to, and this is where they become visible as one. Failing again
  -- while nobody has dealt with the last one is still that same one buyer, so
  -- the partial unique index above keeps it to a single outstanding row.
  if p_state = 'failed' then
    perform commerce.note_anomaly(
      settled.id, 'fulfillment_failed', null, null, null,
      'a delivery could not be finished'
    );
  end if;

  return true;
end;
$$;

-- ---------------------------------------------------------------------------
-- Grants
-- ---------------------------------------------------------------------------

revoke all on function public.commerce_begin_fulfillment(
  text, text, text, integer, integer, integer
) from public;
revoke all on function public.commerce_settle_fulfillment(text, text, text, uuid)
  from public;

-- Unchanged in who may call them: both are reached from the webhook path, which
-- has no session and never will, and each demands the deployment's own secret
-- before it reads a row.
grant execute on function public.commerce_begin_fulfillment(
  text, text, text, integer, integer, integer
) to anon, authenticated;
grant execute on function public.commerce_settle_fulfillment(
  text, text, text, uuid
) to anon, authenticated;

-- Restated because `create or replace` on a `security definer` function is the
-- moment to be sure of who may execute it. Nothing here changed.
revoke all on function public.commerce_record_payment_event(
  text, text, text, text, text, timestamptz, text
) from public;
grant execute on function public.commerce_record_payment_event(
  text, text, text, text, text, timestamptz, text
) to anon, authenticated;
