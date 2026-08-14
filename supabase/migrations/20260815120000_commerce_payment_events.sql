-- Payment truth: the events a payment provider delivered, and the one way a
-- Payment State is allowed to move.
--
-- Three decisions shape everything below.
--
-- **Events are the record; the state is a conclusion drawn from them.** Every
-- verified delivery is written here whatever it turns out to mean, with the
-- provider's own identity and timestamp on it, and nothing ever edits or
-- deletes one. An order's Payment State is then whatever the first event
-- allowed to decide it said (ADR-0005). That is why a late or contradictory
-- delivery is not a problem to be swallowed: it is a row, and the row explains
-- itself.
--
-- **A delivery is processed once.** `(provider, provider_event_id)` is unique,
-- and `commerce_record_payment_event` reports the second arrival as a duplicate
-- instead of failing. A provider that did not hear the first answer retries,
-- and retrying has to be safe — issue #1 asks for exactly this, because the
-- fulfillment issue #12 builds hangs off the first approval and must not fire
-- twice.
--
-- **The rule lives in two places and is written to agree.** This function and
-- `paymentEventEffect()` in `src/commerce/orders.ts` answer the same question:
-- an event that only announces a transaction changes nothing, a pending order
-- takes the first outcome that reaches it, and anything arriving after that is
-- recorded and ignored. Change one and change the other.
--
-- **`commerce_record_payment_event` is the one function here that is not
-- granted on the strength of the anonymous key alone.** Every other order
-- function is: they either write something nobody has paid for, or are
-- addressed by a reference with fifty bits of randomness in it, and none of
-- them can approve a payment. This one can — and the identity it is addressed
-- by is the *provider's* transaction id, which is a small integer a caller
-- could walk. A leaked anonymous key would otherwise be a way to approve an
-- order without a signature, which is exactly the claim this whole slice
-- exists to make true.
--
-- So it also demands a secret the application holds
-- (`WECREATE_PAYMENT_EVENT_SECRET`), compared here against a digest an operator
-- stored at setup. The point is the equivalence: calling this function directly
-- becomes no easier than forging a signed delivery through the front door,
-- because both need a credential out of the deployment's own environment.
-- Rate limiting and alerting on this surface are issue #17's.

-- ---------------------------------------------------------------------------
-- What is stored
-- ---------------------------------------------------------------------------

create table if not exists commerce.payment_events (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references commerce.orders (id),
  -- The order they arrived in, which two deliveries sharing a millisecond
  -- cannot answer between them.
  sequence_number bigint generated always as identity,
  -- Which provider said it. Part of the identity: two providers numbering their
  -- events from one must not collide.
  provider text not null,
  -- The provider's own name for this delivery. A redelivery carries the same
  -- one, which is what makes retrying safe.
  provider_event_id text not null,
  -- The provider's own name for what happened — `transaction.approved` and its
  -- siblings — recorded as it was sent rather than as it was interpreted.
  provider_event_type text not null,
  provider_transaction_id text not null,
  -- When the provider says it happened, and when this deployment heard it. Both,
  -- because they differ and the difference is the thing an operator asks about.
  occurred_at timestamptz not null,
  received_at timestamptz not null default now(),
  -- What it meant, in the vocabulary a Payment State is written in.
  outcome text not null
    check (outcome in ('pending', 'approved', 'failed', 'cancelled')),
  -- What it was allowed to do when it arrived. See `PaymentEventDisposition`.
  disposition text not null
    check (disposition in ('applied', 'unchanged', 'superseded')),
  unique (provider, provider_event_id)
);

create index if not exists payment_events_in_order
  on commerce.payment_events (order_id, sequence_number);
create index if not exists payment_events_by_transaction
  on commerce.payment_events (provider_transaction_id);

-- The one credential that stands between a leaked anonymous key and an approved
-- order. One row, and the secret itself is never here: only its digest, which
-- is no use to anybody who does not already hold the secret it was made from.
create table if not exists commerce.payment_event_authorisation (
  -- One row, enforced rather than remembered.
  id boolean primary key default true check (id),
  -- SHA-256 of `WECREATE_PAYMENT_EVENT_SECRET`, hexadecimal.
  secret_digest text not null check (secret_digest ~ '^[0-9a-f]{64}$'),
  updated_at timestamptz not null default now()
);

alter table commerce.payment_event_authorisation enable row level security;

-- Append-only, as the audit trail is. What a provider said is what it said.
drop trigger if exists payment_events_are_immutable on commerce.payment_events;
create trigger payment_events_are_immutable
  before update or delete on commerce.payment_events
  for each row execute function commerce.refuse_rewrite();

alter table commerce.payment_events enable row level security;

-- ---------------------------------------------------------------------------
-- The surface
-- ---------------------------------------------------------------------------

-- What one event does to a Payment State. The whole rule, and the twin of
-- `paymentEventEffect()` in `src/commerce/orders.ts`.
create or replace function commerce.payment_event_effect(
  p_current text,
  p_outcome text
)
  returns text
  language sql
  immutable
  set search_path = ''
as $$
  select case
    -- A provider announcing a transaction it has just created has said nothing
    -- about whether it was paid.
    when p_outcome = 'pending' then 'unchanged'
    when p_current = 'pending' then 'applied'
    -- A second event agreeing with the state is agreement, not a conflict.
    when p_current = p_outcome then 'unchanged'
    -- Anything else arrived after payment truth was decided. Nothing may unsay
    -- that a buyer paid, and a provider retrying out of order must not be able
    -- to (ADR-0005).
    else 'superseded'
  end;
$$;

-- Record one verified event and let it decide the Payment State if it may.
--
-- One transaction, because they are one decision: an event acted on but not
-- written down could be acted on again, and one written down but not acted on
-- would leave an order pending with its own approval sitting beside it.
--
-- It raises nothing for an event that is merely unwelcome. A duplicate, a late
-- one and one for a transaction this project does not know are all answers, and
-- the caller owes the provider an acknowledgement for each — a provider told
-- "failed" redelivers forever.
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
  -- Before anything is read or written. An unconfigured authorisation refuses
  -- every event, which leaves payments pending rather than approving them on
  -- the word of whoever holds the anonymous key.
  if not exists (
    select 1
      from commerce.payment_event_authorisation a
     where a.secret_digest =
           encode(sha256(convert_to(coalesce(p_secret, ''), 'UTF8')), 'hex')
  ) then
    raise exception 'commerce: this caller may not record payment events'
      using errcode = '42501';
  end if;

  if p_outcome not in ('pending', 'approved', 'failed', 'cancelled') then
    raise exception 'commerce: % is not a payment outcome', p_outcome
      using errcode = '22023';
  end if;

  -- Which order was paid through that transaction. The provider's identity was
  -- recorded on the attempt when the payment page was opened, and it is the
  -- only thing tying a delivery to an order: WeCreate's own reference never
  -- travels to the provider, so nothing a webhook carries could name one.
  select o.* into placed
    from commerce.orders o
    join commerce.payment_attempts t on t.order_id = o.id
   where t.provider_transaction_id = p_transaction_id
   order by t.sequence_number desc
   limit 1
     for update of o;
  if not found then
    return jsonb_build_object('disposition', 'unmatched', 'payment_state', null);
  end if;

  -- Already recorded. Acknowledged, and nothing happens a second time.
  if exists (
    select 1
      from commerce.payment_events e
     where e.provider = p_provider
       and e.provider_event_id = p_event_id
  ) then
    return jsonb_build_object(
      'disposition', 'duplicate',
      'payment_state', placed.payment_state
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
    'payment_state', placed.payment_state
  );
exception
  -- Two deliveries of one event racing each other. The unique index decided
  -- which arrived first; the loser is a duplicate, which is what it is.
  when unique_violation then
    return jsonb_build_object(
      'disposition', 'duplicate',
      'payment_state', (
        select o.payment_state from commerce.orders o where o.id = placed.id
      )
    );
end;
$$;

-- Where one order stands, and nothing else about it.
--
-- Deliberately not `commerce_order` with two fields read off it: this is what a
-- page polls every few seconds while a buyer waits, and a poll that returned an
-- order and printed two fields of it would still have read the order. Two
-- columns leave, and there is nowhere here for a third to appear.
create or replace function public.commerce_order_state(p_reference text)
  returns jsonb
  language sql
  stable
  security definer
  set search_path = ''
as $$
  select jsonb_build_object(
    'payment_state', o.payment_state,
    'fulfillment_state', o.fulfillment_state
  )
    from commerce.orders o
   where o.reference = p_reference;
$$;

-- ---------------------------------------------------------------------------
-- Grants
-- ---------------------------------------------------------------------------

revoke all on function public.commerce_record_payment_event(
  text, text, text, text, text, timestamptz, text
) from public;
revoke all on function public.commerce_order_state(text) from public;

-- Granted to `anon` because a payment provider's webhook carries no session and
-- never will — but see the note at the top of this file: the grant is not on
-- its own what lets a caller in. The function demands the application's own
-- secret before it reads a single row.
grant execute on function public.commerce_record_payment_event(
  text, text, text, text, text, timestamptz, text
) to anon, authenticated;

-- Bounded the way `commerce_order` is, and returns strictly less than it does:
-- an order is addressed by a reference with fifty bits of randomness in it, and
-- two words come back.
grant execute on function public.commerce_order_state(text)
  to anon, authenticated;
