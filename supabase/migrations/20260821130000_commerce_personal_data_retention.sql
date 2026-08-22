-- Forget a buyer's contact details after a configured retention period.
--
-- Issue #1 collects only what a checkout needs, makes retention configurable,
-- and refuses to rewrite an Order Snapshot. The buyer's own columns stay
-- exactly as `commerce.refuse_order_rewrite()` has always kept them. What is
-- added is a side fact — `personal_data_forgotten_at` — and the dossier is
-- where it is applied: a forgotten order is still findable by its reference,
-- and no longer by an address.
--
-- There is no default period here. `commerce.forget_personal_data(p_days)` is
-- a job a named operator runs from the SQL editor with the integer
-- `WECREATE_PERSONAL_DATA_RETENTION_DAYS` names, once the privacy policy in
-- force has approved that number. The application (`applyPersonalDataRetention`)
-- is what consults that gate; this function does not invent a period of its
-- own. It is not granted to `anon` or `authenticated`.

alter table commerce.orders
  add column if not exists personal_data_forgotten_at timestamptz;

comment on column commerce.orders.personal_data_forgotten_at is
  'When this order''s buyer contact was forgotten. Null while it is still held. The buyer columns themselves are never rewritten.';

-- A forgotten fact may be written once. Restoring the contact would be
-- undoing a legal act, and rewriting the buyer columns is already refused.
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

  if old.personal_data_forgotten_at is not null
     and new.personal_data_forgotten_at is distinct from old.personal_data_forgotten_at
  then
    raise exception 'commerce: forgotten personal data may not be restored'
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

create or replace function commerce.forget_personal_data(p_days integer)
  returns integer
  language plpgsql
  security definer
  set search_path = ''
as $$
declare
  n integer;
begin
  if p_days is null or p_days < 1 then
    raise exception 'commerce: a retention period must be a positive number of days'
      using errcode = '22023';
  end if;

  update commerce.orders
     set personal_data_forgotten_at = now()
   where personal_data_forgotten_at is null
     and created_at < now() - make_interval(days => p_days);

  get diagnostics n = row_count;
  return n;
end;
$$;

revoke all on function commerce.forget_personal_data(integer) from public;

-- The masked hint a forgotten order shows is no longer an address at all.
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
    'buyer_email_hint',
      case
        when o.personal_data_forgotten_at is not null then '***'
        else commerce.mask_email(commerce.delivery_email(o))
      end,
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
      select jsonb_agg(commerce.attempt_json(t) order by t.sequence_number)
        from commerce.payment_attempts t
       where t.order_id = o.id
    ), '[]'::jsonb)
  );
$$;

-- `matchesOrderSearch()` is this `where`'s twin — change one and change the
-- other. A forgotten order is found by its reference, never by an address.
create or replace function public.commerce_orders(
  p_search text default '',
  p_limit integer default 50
)
  returns jsonb
  language plpgsql
  stable
  security definer
  set search_path = ''
as $$
declare
  wanted text := btrim(coalesce(p_search, ''));
begin
  perform commerce.require_operator();

  return coalesce((
    select jsonb_agg(found.summary order by found.created_at desc)
      from (
        select o.created_at,
               jsonb_build_object(
                 'reference', o.reference,
                 'created_at', o.created_at,
                 'total_xof', o.total_xof,
                 'buyer_email_hint',
                   case
                     when o.personal_data_forgotten_at is not null then '***'
                     else commerce.mask_email(commerce.delivery_email(o))
                   end,
                 'payment_state', o.payment_state,
                 'fulfillment_state', o.fulfillment_state,
                 'outstanding', coalesce((
                   select jsonb_agg(a.kind order by a.sequence_number)
                     from commerce.order_anomalies a
                    where a.order_id = o.id and a.resolved_at is null
                 ), '[]'::jsonb)
               ) as summary
          from commerce.orders o
         where wanted = ''
            or strpos(lower(o.reference), lower(wanted)) > 0
            or (
              o.personal_data_forgotten_at is null
              and (
                strpos(lower(o.buyer_email), lower(wanted)) > 0
                or strpos(lower(coalesce(o.corrected_email, '')), lower(wanted)) > 0
              )
            )
         order by o.created_at desc
         limit greatest(coalesce(p_limit, 50), 0)
      ) found
  ), '[]'::jsonb);
end;
$$;

create or replace function public.commerce_order_dossier(p_reference text)
  returns jsonb
  language plpgsql
  stable
  security definer
  set search_path = ''
as $$
declare
  placed commerce.orders;
  held commerce.order_access;
  forgotten boolean;
begin
  perform commerce.require_operator();

  select * into placed from commerce.orders o where o.reference = p_reference;
  if not found then
    return null;
  end if;

  forgotten := placed.personal_data_forgotten_at is not null;

  select * into held
    from commerce.order_access a
   where a.order_id = placed.id;

  return jsonb_build_object(
    'order', commerce.order_json(placed),
    'buyer', case
      when forgotten then jsonb_build_object(
        'full_name', '',
        'email', '',
        'telephone', '',
        'company', null
      )
      else jsonb_build_object(
        'full_name', placed.buyer_full_name,
        'email', placed.buyer_email,
        'telephone', placed.buyer_telephone,
        'company', placed.buyer_company
      )
    end,
    'correction', case
      when placed.corrected_at is null then null
      when forgotten then jsonb_build_object(
        'email', null,
        'telephone', null,
        'reason', placed.correction_reason,
        'corrected_at', placed.corrected_at,
        'corrected_by_email', placed.corrected_by_email
      )
      else jsonb_build_object(
        'email', placed.corrected_email,
        'telephone', placed.corrected_telephone,
        'reason', placed.correction_reason,
        'corrected_at', placed.corrected_at,
        'corrected_by_email', placed.corrected_by_email
      )
    end,
    'deliver_to', case when forgotten then '' else commerce.delivery_email(placed) end,
    'personal_data_forgotten', forgotten,
    'events', coalesce((
      select jsonb_agg(
               jsonb_build_object(
                 'id', e.id,
                 'provider', e.provider,
                 'provider_event_id', e.provider_event_id,
                 'provider_event_type', e.provider_event_type,
                 'provider_transaction_id', e.provider_transaction_id,
                 'occurred_at', e.occurred_at,
                 'received_at', e.received_at,
                 'outcome', e.outcome,
                 'effect', e.disposition
               ) order by e.sequence_number
             )
        from commerce.payment_events e
       where e.order_id = placed.id
    ), '[]'::jsonb),
    'access', case when held.id is null then null else commerce.access_json(held) end,
    'anomalies', coalesce((
      select jsonb_agg(
               jsonb_build_object(
                 'id', a.id,
                 'kind', a.kind,
                 'reference', placed.reference,
                 'detected_at', a.detected_at,
                 'provider', a.provider,
                 'provider_transaction_id', a.provider_transaction_id,
                 'provider_event_id', a.provider_event_id,
                 'detail', a.detail,
                 'resolved_at', a.resolved_at,
                 'resolution', a.resolution,
                 'resolved_by_email', a.resolved_by_email
               ) order by a.sequence_number
             )
        from commerce.order_anomalies a
       where a.order_id = placed.id
    ), '[]'::jsonb),
    'audit', coalesce((
      select jsonb_agg(recent.entry order by recent.sequence_number desc)
        from (
          select e.sequence_number,
                 jsonb_build_object(
                   'id', e.id,
                   'occurred_at', e.occurred_at,
                   'actor_email', e.actor_email,
                   'action', e.action,
                   'sku', e.sku,
                   'order_reference', e.order_reference,
                   'before', e.before,
                   'after', e.after
                 ) as entry
            from commerce.audit_entries e
           where e.order_reference = placed.reference
           order by e.sequence_number desc
        ) recent
    ), '[]'::jsonb)
  );
end;
$$;
