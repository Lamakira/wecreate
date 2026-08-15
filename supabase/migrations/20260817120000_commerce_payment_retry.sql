-- Paying again for an order a provider refused, without ever paying twice.
--
-- A refusal is not the end of an order. Issue #1 gives an Order Snapshot
-- twenty-four hours at the prices it recorded, and issue #13 is the rest of
-- that journey: for those hours a buyer may open another attempt against the
-- *same* order — its products, its prices, its Paid Deliverable Versions and
-- the Legal Revisions they accepted — and after them they start again from
-- whatever WeCreate is publishing that day.
--
-- Four things change here, and the first two are one idea seen from two sides.
--
-- **Payment truth still settles once, and now says which way.** Until now an
-- order's Payment State could leave `pending` exactly once, which was a
-- stronger rule than the one it was there to keep. The rule is *nothing may
-- unsay that a buyer paid* (ADR-0005), so what is closed is exactly that
-- direction: an approved order is final against everything, and a refused or
-- cancelled one may be replaced by an approval and by nothing else. A retry
-- that could never be approved would be a button that cannot work.
--
-- **An attempt now reports what the provider said about it.** `attempt_json`
-- reads it out of `commerce.payment_events` rather than storing a copy beside
-- them: what a provider said is recorded once, in the trail, and a second copy
-- could only ever disagree with it. It is what tells an outstanding payment
-- from a settled one on an order with several attempts — an order reading
-- *failed* may have a fresh transaction open with FedaPay, and that is exactly
-- when a second payment page charges somebody twice.
--
-- **So `commerce_open_payment_attempt` asks a wider question and a narrower
-- one.** Wider: any order that is not approved and is still inside its window,
-- rather than only a pending one. Narrower: and only while nothing is
-- outstanding. It is the copy of `paymentProspect()` in `src/commerce/orders.ts`
-- that a request which never rendered a page is held to — a reconnecting
-- browser, a page reloaded from history, a poll that ran twice — and it takes
-- the order's row for update so that two of them arriving together cannot each
-- decide there was nothing outstanding.
--
-- Nothing here weakens who may call what. The grants are unchanged, an order is
-- still addressed by a reference with fifty bits of randomness in it, and only
-- `commerce_record_payment_event` — which still demands the application's own
-- secret — can move a Payment State at all.

-- ---------------------------------------------------------------------------
-- What a provider said about one attempt
-- ---------------------------------------------------------------------------

-- One attempt as the boundary reports it, with the verdict a verified event
-- gave its transaction. `stable` rather than `immutable` now: it reads the
-- events, which is the point.
--
-- The last event about that transaction which said anything at all. A
-- `transaction.created` announces a transaction and answers nothing, so it is
-- passed over here exactly as `payment_event_effect` passes over it, and an
-- attempt with no transaction of its own has nothing to look up. A provider
-- contradicting itself about one transaction is kept in the trail either way,
-- and what the order's Payment State makes of those events is
-- `payment_event_effect`'s decision rather than this column's — an approved
-- order stays approved whatever arrives after it. `attemptOutcome()` in
-- `src/commerce/fixture/provider.ts` reads the same way.
create or replace function commerce.attempt_json(t commerce.payment_attempts)
  returns jsonb
  language sql
  stable
  set search_path = ''
as $$
  select jsonb_build_object(
    'id', t.id,
    'created_at', t.created_at,
    'state', t.state,
    'provider', t.provider,
    'provider_transaction_id', t.provider_transaction_id,
    'failure_reason', t.failure_reason,
    'outcome', (
      select e.outcome
        from commerce.payment_events e
       where e.provider_transaction_id = t.provider_transaction_id
         and e.outcome <> 'pending'
       order by e.sequence_number desc
       limit 1
    )
  );
$$;

-- ---------------------------------------------------------------------------
-- What a verified event may decide
-- ---------------------------------------------------------------------------

-- The whole rule, and the twin of `paymentEventEffect()` in
-- `src/commerce/orders.ts`. Change one and change the other.
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
    -- A payment that had not succeeded, and now has. A buyer may try again for
    -- twenty-four hours (issue #13), so an approval reaching a refused or
    -- cancelled order is the answer to the attempt they made — whether it is
    -- the first thing FedaPay said or the third.
    when p_current <> 'approved' and p_outcome = 'approved' then 'applied'
    -- Anything else arrived after payment truth was decided. Nothing may unsay
    -- that a buyer paid, and a provider retrying out of order must not be able
    -- to (ADR-0005).
    else 'superseded'
  end;
$$;

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

  -- An approved payment is final against everything: no application bug, no
  -- support action and no provider retrying out of order may unsay that a buyer
  -- paid (ADR-0005). A refusal is not final in the same way — the buyer may pay
  -- again while the order is inside its window — but the only thing that may
  -- replace it is an approval, so a second refusal cannot rewrite the first.
  if new.payment_state is distinct from old.payment_state then
    if old.payment_state = 'approved' then
      raise exception 'commerce: an approved payment may not be unsaid'
        using errcode = '42501';
    end if;
    if old.payment_state <> 'pending' and new.payment_state <> 'approved' then
      raise exception
        'commerce: Payment State % may only be replaced by an approval',
        old.payment_state
        using errcode = '42501';
    end if;
  end if;

  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- Opening another attempt
-- ---------------------------------------------------------------------------

-- Open another attempt against an order that may still be paid.
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
  -- Not already paid, and still inside the window its prices were recorded for.
  -- The application asks the same question before it renders a control
  -- (`paymentProspect()` in `src/commerce/orders.ts`); this is the copy that a
  -- request which never rendered a page is held to.
  --
  -- The row is taken for update, so two submissions arriving together are
  -- answered one after the other rather than both finding nothing outstanding.
  select * into placed
    from commerce.orders o
   where o.reference = p_reference
     and o.payment_state <> 'approved'
     and o.created_at > now() - interval '24 hours'
     for update;
  if not found then
    return null;
  end if;

  -- Nothing outstanding. An attempt the provider gave a page for and no
  -- verified event has answered, and one this application opened and never
  -- recorded an answer for, both mean a payment may be in flight — and a second
  -- payment page for one order is how somebody pays twice. An attempt that
  -- never reached the provider is not outstanding: nothing was opened.
  if exists (
    select 1
      from commerce.payment_attempts t
     where t.order_id = placed.id
       and t.state <> 'failed'
       and not exists (
         select 1
           from commerce.payment_events e
          where e.provider_transaction_id = t.provider_transaction_id
            and e.outcome <> 'pending'
       )
  ) then
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

-- ---------------------------------------------------------------------------
-- What the waiting page polls for
-- ---------------------------------------------------------------------------

-- Where one order stands, and nothing else about it.
--
-- It gains a third word here, and only because the two it had no longer answer
-- the question it is asked. The verification view polls this to learn when it
-- may stop waiting, and once a buyer may pay again a second refusal leaves the
-- Payment State exactly as it was — so a page watching for that state to move
-- would go on saying *Vérification du paiement* over a payment FedaPay had
-- already refused twice. `awaiting` is the thing that actually changed.
--
-- It is still not a way to read an order: no reference, no total, no product,
-- no address, not even the masked one. That is the rule this function keeps,
-- rather than the number of columns. `paymentProspect()` in
-- `src/commerce/orders.ts` is its twin — change one and change the other.
create or replace function public.commerce_order_state(p_reference text)
  returns jsonb
  language sql
  stable
  security definer
  set search_path = ''
as $$
  select jsonb_build_object(
    'payment_state', o.payment_state,
    'fulfillment_state', o.fulfillment_state,
    'awaiting', o.payment_state <> 'approved'
      and o.created_at > now() - interval '24 hours'
      and exists (
        select 1
          from commerce.payment_attempts t
         where t.order_id = o.id
           and t.state <> 'failed'
           and not exists (
             select 1
               from commerce.payment_events e
              where e.provider_transaction_id = t.provider_transaction_id
                and e.outcome <> 'pending'
           )
      )
  )
    from commerce.orders o
   where o.reference = p_reference;
$$;

-- ---------------------------------------------------------------------------
-- Grants
-- ---------------------------------------------------------------------------

-- Unchanged from `20260814120000_commerce_orders.sql`, and restated because
-- `create or replace` on a `security definer` function is the moment to be sure
-- of who may execute it.
revoke all on function public.commerce_open_payment_attempt(text) from public;
grant execute on function public.commerce_open_payment_attempt(text)
  to anon, authenticated;

revoke all on function public.commerce_order_state(text) from public;
grant execute on function public.commerce_order_state(text) to anon, authenticated;
