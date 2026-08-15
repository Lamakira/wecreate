-- Resolving a buyer's problem from the back office, without rewriting anything.
--
-- Issue #15 asks for a Commerce Operator to be able to answer for an order:
-- find it, read what happened to it, and put right the things a person has to
-- put right. Everything here is that, and everything here is *additive* — which
-- is the whole design, not a detail of it:
--
-- **A Contact Correction sits beside the Order Snapshot.** The buyer's own
-- columns stay exactly as `commerce.refuse_order_rewrite()` has always kept
-- them; five new ones record what an operator has since discovered, and a
-- delivery reads `coalesce(corrected_email, buyer_email)`. Nothing rewrites
-- what somebody typed at checkout.
--
-- **A granted version sits beside the order line.** `upgraded_version_id` on
-- the grant decides which file opens today; `order_lines.paid_deliverable_
-- version` goes on recording which one was bought, for ever.
--
-- **A settled anomaly keeps everything it was detected with.** The trigger
-- below widens what an operator may write by exactly three columns — when they
-- settled it, what they decided, and who they are — and refuses a second answer
-- to the same one.
--
-- **The audit trail grows an order reference**, because five of the seven
-- actions it now records are about an order rather than about a product, and
-- its `sku` becomes optional for the same reason.
--
-- What is *not* here is the point. There is no function in this migration that
-- edits a payment event, a provider identifier, a Payment State, an Order
-- Snapshot line or a stored Paid Deliverable Version. They are not refused;
-- they do not exist. The triggers from every earlier migration are untouched
-- and still say the same thing: payment truth settles once, an approved payment
-- may never be unsaid (ADR-0005, ADR-0009), and a delivered order stays
-- delivered (ADR-0010).

-- ---------------------------------------------------------------------------
-- What an operator may add
-- ---------------------------------------------------------------------------

alter table commerce.orders
  add column if not exists corrected_email text,
  add column if not exists corrected_telephone text,
  add column if not exists correction_reason text
    check (correction_reason is null or length(correction_reason) <= 200),
  add column if not exists corrected_at timestamptz,
  add column if not exists corrected_by uuid references auth.users (id),
  add column if not exists corrected_by_email text;

-- Which Paid Deliverable Version this buyer may open, when it is not the one
-- their order recorded. Never a foreign key to the order line: what was bought
-- is the line's business and may not change, and this is a separate decision
-- about what WeCreate has since given them.
alter table commerce.order_access_grants
  add column if not exists upgraded_version_id uuid
    references commerce.paid_deliverable_versions (id);

alter table commerce.order_anomalies
  add column if not exists resolution text
    check (resolution is null or length(resolution) <= 200),
  add column if not exists resolved_by uuid references auth.users (id),
  add column if not exists resolved_by_email text;

alter table commerce.audit_entries
  add column if not exists order_reference text;

-- An entry about a delivery, a correction or a settled anomaly is about an
-- order and no particular product.
alter table commerce.audit_entries alter column sku drop not null;

-- ---------------------------------------------------------------------------
-- What settling an anomaly may write, and never twice
-- ---------------------------------------------------------------------------

-- The same rule as before, widened by exactly what an operator decides: when
-- they dealt with it, what they concluded, and who they are. Everything the
-- anomaly was detected with stays as it was detected, and a row that has been
-- settled is settled — a second answer is refused rather than written over the
-- first (issue #15).
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

  if old.resolved_at is not null
     and (new.resolved_at is distinct from old.resolved_at
          or new.resolution is distinct from old.resolution
          or new.resolved_by is distinct from old.resolved_by
          or new.resolved_by_email is distinct from old.resolved_by_email)
  then
    raise exception 'commerce: an order anomaly is settled once'
      using errcode = '42501';
  end if;

  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- The rules, in the one place Postgres keeps them
-- ---------------------------------------------------------------------------

-- Spaces of every kind, and the punctuation people write telephone numbers
-- with. `normaliseTelephone()` is its twin — change one and change the other.
--
-- The Unicode spaces are written out because Postgres's `\s` is the ASCII five
-- and JavaScript's is every space there is. Without them a number pasted out of
-- a formatted page — the non-breaking spaces are exactly what a browser copies
-- — would be tidied by the application and refused here, which is the one way
-- these two could disagree about a real number somebody typed.
create or replace function commerce.tidy_telephone(p_telephone text)
  returns text
  language sql
  immutable
  set search_path = ''
as $$
  select regexp_replace(
    coalesce(p_telephone, ''),
    -- Postgres's own `\s`, then the spaces JavaScript's adds to it, then the
    -- punctuation. Written as escapes so a reader can see which characters
    -- these are.
    '[\s\u00A0\u1680\u2000-\u200A\u2028\u2029\u202F\u205F\u3000\uFEFF.\-()/]',
    '',
    'g'
  );
$$;

-- `+229•••80`: enough for an operator reading the trail to recognise which
-- number changed, and never a copy of it. `maskTelephone()` in
-- `src/commerce/contact.ts` is its twin — change one and change the other.
create or replace function commerce.mask_telephone(p_telephone text)
  returns text
  language sql
  immutable
  set search_path = ''
as $$
  select case
    when p_telephone is null or length(commerce.tidy_telephone(p_telephone)) < 6
      then '***'
    else left(commerce.tidy_telephone(p_telephone), 4)
         || '•••'
         || right(commerce.tidy_telephone(p_telephone), 2)
  end;
$$;

-- One run of whitespace between words, and none at either end.
-- `normaliseReason()` is its twin.
create or replace function commerce.tidy_reason(p_reason text)
  returns text
  language sql
  immutable
  set search_path = ''
as $$
  select btrim(regexp_replace(coalesce(p_reason, ''), '\s+', ' ', 'g'));
$$;

-- Why a motive may not be recorded, or null if it may. `reasonRefusal()` is its
-- twin: every support action asks for one, because every one of them is written
-- into a trail under somebody's name.
create or replace function commerce.reason_refusal(p_reason text)
  returns text
  language sql
  immutable
  set search_path = ''
as $$
  select case
    when length(commerce.tidy_reason(p_reason)) = 0 then 'reasonMissing'
    when length(commerce.tidy_reason(p_reason)) > 200 then 'reasonTooLong'
  end;
$$;

-- The shapes an address and a telephone have to have. The same ones the guest
-- checkout is held to (`src/commerce/contact.ts`), because a correction that
-- accepted what the checkout refuses would put a value in the delivery path
-- nothing else in this application believes in.
create or replace function commerce.is_well_formed_email(p_email text)
  returns boolean
  language sql
  immutable
  set search_path = ''
as $$
  select length(coalesce(p_email, '')) <= 254
     and p_email ~ '^[^\s@]+@[^\s@.]+(\.[^\s@.]+)+$';
$$;

create or replace function commerce.is_well_formed_telephone(p_telephone text)
  returns boolean
  language sql
  immutable
  set search_path = ''
as $$
  select p_telephone ~ '^\+[1-9][0-9]{7,14}$';
$$;

-- Where an order's messages go now: the correction if there is one, and what
-- the buyer wrote otherwise. `deliveryAddress()` is its twin.
create or replace function commerce.delivery_email(o commerce.orders)
  returns text
  language sql
  immutable
  set search_path = ''
as $$
  select coalesce(o.corrected_email, o.buyer_email);
$$;

create or replace function commerce.delivery_telephone(o commerce.orders)
  returns text
  language sql
  immutable
  set search_path = ''
as $$
  select coalesce(o.corrected_telephone, o.buyer_telephone);
$$;

-- Which Paid Deliverable Version one grant opens: the one an operator granted,
-- or the one the order line recorded. `grantedVersion()` is its twin, and
-- everything that hands over a file answers to it.
create or replace function commerce.granted_version_id(
  g commerce.order_access_grants
)
  returns uuid
  language sql
  stable
  set search_path = ''
as $$
  select coalesce(
    g.upgraded_version_id,
    (select l.paid_deliverable_version_id
       from commerce.order_lines l
      where l.id = g.order_line_id)
  );
$$;

-- One audit entry, from a Commerce Operator, in the same transaction as the
-- change it records. Written once so the seven functions that record one cannot
-- describe it differently.
create or replace function commerce.record_audit(
  p_action text,
  p_sku text,
  p_reference text,
  p_before jsonb,
  p_after jsonb
)
  returns void
  language sql
  set search_path = ''
as $$
  insert into commerce.audit_entries (
    actor_id, actor_email, action, sku, order_reference, before, after
  )
  values (
    auth.uid(), auth.jwt() ->> 'email', p_action, p_sku, p_reference,
    p_before, p_after
  );
$$;

-- ---------------------------------------------------------------------------
-- What the boundary reports, now that a correction and a grant may exist
-- ---------------------------------------------------------------------------

-- One order as anybody holding its reference may see it. The masked hint is
-- taken from where the order is actually going, because somebody recognising
-- their own address is looking for the one their receipt went to.
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
    'buyer_email_hint', commerce.mask_email(commerce.delivery_email(o)),
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

-- One order's access, now saying which version each grant actually opens. The
-- version the order recorded is beside it and unchanged: the two answer
-- different questions, and both have to stay answerable (issue #15).
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
                 'delivered_version', coalesce(
                   (select v.version
                      from commerce.paid_deliverable_versions v
                     where v.id = commerce.granted_version_id(g)),
                   l.paid_deliverable_version
                 ),
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

-- The address of the file this grant opens. Unchanged apart from which version
-- it reads: a granted upgrade is a decision about what this buyer may open, and
-- this is the one place it has to be obeyed.
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

  -- The version this grant opens: the one an operator granted, or the one the
  -- Order Snapshot recorded. Never the one on sale today.
  select v.object_path into target
    from commerce.paid_deliverable_versions v
   where v.id = commerce.granted_version_id(grant_row);

  return jsonb_build_object(
    'status', 'found',
    'object_path', target.object_path,
    'live_seconds', commerce.live_link_seconds(grant_row.link_expires_at)
  );
end;
$$;

-- The audit trail, now naming the order an entry is about when it is about one.
create or replace function public.commerce_audit_entries(p_limit integer default 50)
  returns jsonb
  language plpgsql
  stable
  security definer
  set search_path = ''
as $$
begin
  perform commerce.require_operator();

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
                 'order_reference', e.order_reference,
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

-- Claiming a delivery, unchanged apart from where it says to write. A buyer
-- whose address an operator has corrected is written to at the corrected one;
-- the Order Snapshot goes on recording what they typed.
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

  insert into commerce.order_access_grants (
    order_id, order_line_id, sku, downloads_allowed
  )
  select placed.id, l.id, l.sku, p_downloads_allowed
    from commerce.order_lines l
   where l.order_id = placed.id
  on conflict (order_line_id) do nothing;

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
  on conflict (order_id) do update
     set token_digest = excluded.token_digest,
         issued_at = now()
  returning * into held;

  return jsonb_build_object(
    'order', commerce.order_json(placed),
    'access', commerce.access_json(held),
    'claim_id', claim,
    'deliver_to', commerce.delivery_email(placed)
  );
end;
$$;

-- ---------------------------------------------------------------------------
-- The back office's own surface
-- ---------------------------------------------------------------------------

-- Orders newest first, narrowed to what an operator typed.
--
-- A reference or an address, matched anywhere in either, because those are the
-- two things somebody has in front of them when a buyer writes in. A corrected
-- address matches too: the buyer writing in is writing from the address
-- WeCreate now delivers to. `matchesOrderSearch()` is this `where`'s twin.
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
                   commerce.mask_email(commerce.delivery_email(o)),
                 'payment_state', o.payment_state,
                 'fulfillment_state', o.fulfillment_state,
                 'outstanding', coalesce((
                   select jsonb_agg(a.kind order by a.sequence_number)
                     from commerce.order_anomalies a
                    where a.order_id = o.id and a.resolved_at is null
                 ), '[]'::jsonb)
               ) as summary
          from commerce.orders o
         -- `strpos` rather than `ilike`, because what an operator typed is a
         -- reference or an address rather than a pattern: `ilike` would read a
         -- `%` in it as "everything" and hand back every order WeCreate has,
         -- while `matchesOrderSearch()` looks for those characters and finds
         -- nothing. A literal, case-insensitive containment is what both of
         -- them mean.
         where wanted = ''
            or strpos(lower(o.reference), lower(wanted)) > 0
            or strpos(lower(o.buyer_email), lower(wanted)) > 0
            or strpos(lower(coalesce(o.corrected_email, '')), lower(wanted)) > 0
         order by o.created_at desc
         limit greatest(coalesce(p_limit, 50), 0)
      ) found
  ), '[]'::jsonb);
end;
$$;

-- Everything WeCreate knows about one order, for the operator resolving a
-- problem with it.
--
-- The one read in this schema that returns a buyer's contact details, and the
-- reason it may is the same one the deliverable functions have: it is bounded
-- by an individual staff identity at assurance level 2 with the Commerce
-- Operator role, rather than by an order reference.
--
-- Access that has expired is returned rather than hidden: an operator answering
-- "why can this buyer no longer open their files" needs to be shown that it ran
-- out rather than that there is nothing there.
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
begin
  perform commerce.require_operator();

  select * into placed from commerce.orders o where o.reference = p_reference;
  if not found then
    return null;
  end if;

  select * into held
    from commerce.order_access a
   where a.order_id = placed.id;

  return jsonb_build_object(
    'order', commerce.order_json(placed),
    'buyer', jsonb_build_object(
      'full_name', placed.buyer_full_name,
      'email', placed.buyer_email,
      'telephone', placed.buyer_telephone,
      'company', placed.buyer_company
    ),
    'correction', case
      when placed.corrected_at is null then null
      else jsonb_build_object(
        'email', placed.corrected_email,
        'telephone', placed.corrected_telephone,
        'reason', placed.correction_reason,
        'corrected_at', placed.corrected_at,
        'corrected_by_email', placed.corrected_by_email
      )
    end,
    'deliver_to', commerce.delivery_email(placed),
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

-- Record that the address or telephone the buyer wrote is not where their order
-- should go.
--
-- It adds a fact and rewrites none. `readContactCorrection()` is its twin: the
-- same shapes, the same refusal for a correction that changes nothing, and the
-- same carrying forward — correcting a telephone today does not undo an address
-- corrected last week.
create or replace function public.commerce_correct_buyer_contact(
  p_reference text,
  p_email text,
  p_telephone text,
  p_reason text
)
  returns jsonb
  language plpgsql
  security definer
  set search_path = ''
as $$
declare
  placed commerce.orders;
  wanted_email text := btrim(coalesce(p_email, ''));
  wanted_telephone text := commerce.tidy_telephone(p_telephone);
  current_email text;
  current_telephone text;
  changed_email text;
  changed_telephone text;
  refusal text;
begin
  perform commerce.require_operator();

  select * into placed
    from commerce.orders o where o.reference = p_reference for update;
  if not found then
    return jsonb_build_object('status', 'refused', 'reason', 'unknownOrder');
  end if;

  current_email := commerce.delivery_email(placed);
  current_telephone := commerce.delivery_telephone(placed);

  if wanted_email <> '' and not commerce.is_well_formed_email(wanted_email) then
    return jsonb_build_object('status', 'refused', 'reason', 'emailMalformed');
  end if;
  if wanted_telephone <> ''
     and not commerce.is_well_formed_telephone(wanted_telephone)
  then
    return jsonb_build_object('status', 'refused', 'reason', 'telephoneMalformed');
  end if;

  changed_email := nullif(
    case when wanted_email = current_email then '' else wanted_email end, ''
  );
  changed_telephone := nullif(
    case when wanted_telephone = current_telephone then '' else wanted_telephone end,
    ''
  );
  if changed_email is null and changed_telephone is null then
    return jsonb_build_object('status', 'refused', 'reason', 'contactUnchanged');
  end if;

  refusal := commerce.reason_refusal(p_reason);
  if refusal is not null then
    return jsonb_build_object('status', 'refused', 'reason', refusal);
  end if;

  update commerce.orders
     set corrected_email = coalesce(changed_email, corrected_email),
         corrected_telephone = coalesce(changed_telephone, corrected_telephone),
         correction_reason = commerce.tidy_reason(p_reason),
         corrected_at = now(),
         corrected_by = auth.uid(),
         corrected_by_email = auth.jwt() ->> 'email'
   where id = placed.id
  returning * into placed;

  perform commerce.record_audit(
    'order-contact.corrected', null, placed.reference,
    jsonb_build_object(
      'email_hint', commerce.mask_email(current_email),
      'telephone_hint', commerce.mask_telephone(current_telephone)
    ),
    jsonb_build_object(
      'email_hint', commerce.mask_email(commerce.delivery_email(placed)),
      'telephone_hint',
        commerce.mask_telephone(commerce.delivery_telephone(placed)),
      'note', commerce.tidy_reason(p_reason)
    )
  );

  return jsonb_build_object('status', 'recorded');
end;
$$;

-- Replace the token that opens one order, and stop the last one working.
--
-- The grants and the allowance on them are not touched — those are the buyer's,
-- and what is being replaced is only the credential — and the deadline stays
-- where it is, because thirty days belong to the approval rather than to
-- whichever message finally carried them.
--
-- A delivery that is running right now is left alone: it is about to email a
-- token of its own, and replacing that token while the message is being written
-- is how a buyer receives an address that opens nothing.
create or replace function public.commerce_reissue_order_access(
  p_reference text,
  p_token_digest text,
  p_reason text
)
  returns jsonb
  language plpgsql
  security definer
  set search_path = ''
as $$
declare
  placed commerce.orders;
  held commerce.order_access;
  previously_issued timestamptz;
  refusal text;
begin
  perform commerce.require_operator();

  if p_token_digest !~ '^[0-9a-f]{64}$' then
    raise exception 'commerce: an access token digest is a SHA-256'
      using errcode = '22023';
  end if;

  select * into placed
    from commerce.orders o where o.reference = p_reference for update;
  if not found then
    return jsonb_build_object('status', 'refused', 'reason', 'unknownOrder');
  end if;

  refusal := commerce.reason_refusal(p_reason);
  if refusal is not null then
    return jsonb_build_object('status', 'refused', 'reason', refusal);
  end if;

  if placed.fulfillment_state = 'processing' then
    return jsonb_build_object('status', 'refused', 'reason', 'deliveryInProgress');
  end if;

  select * into held
    from commerce.order_access a where a.order_id = placed.id for update;
  if not found then
    return jsonb_build_object('status', 'refused', 'reason', 'noAccessToReissue');
  end if;

  previously_issued := held.issued_at;
  update commerce.order_access
     set token_digest = p_token_digest,
         issued_at = now()
   where id = held.id
  returning * into held;

  perform commerce.record_audit(
    'order-access.reissued', null, placed.reference,
    jsonb_build_object('issued_at', previously_issued),
    jsonb_build_object(
      'issued_at', held.issued_at,
      'note', commerce.tidy_reason(p_reason)
    )
  );

  return jsonb_build_object(
    'status', 'reissued',
    'order', commerce.order_json(placed),
    'access', commerce.access_json(held),
    'deliver_to', commerce.delivery_email(placed)
  );
end;
$$;

-- Grant one purchased product a later Paid Deliverable Version than the order
-- bought.
--
-- Forwards only. Taking a version away from somebody is not an upgrade, and
-- this is not the surface for it. The order line is untouched: it goes on
-- recording what was paid for, and the grant beside it says what may be opened.
create or replace function public.commerce_upgrade_grant_version(
  p_reference text,
  p_sku text,
  p_version_id uuid,
  p_reason text
)
  returns jsonb
  language plpgsql
  security definer
  set search_path = ''
as $$
declare
  placed commerce.orders;
  grant_row commerce.order_access_grants;
  current_version commerce.paid_deliverable_versions;
  wanted commerce.paid_deliverable_versions;
  refusal text;
begin
  perform commerce.require_operator();

  select * into placed from commerce.orders o where o.reference = p_reference;
  if not found then
    return jsonb_build_object('status', 'refused', 'reason', 'unknownOrder');
  end if;

  refusal := commerce.reason_refusal(p_reason);
  if refusal is not null then
    return jsonb_build_object('status', 'refused', 'reason', refusal);
  end if;

  select g.* into grant_row
    from commerce.order_access_grants g
   where g.order_id = placed.id and g.sku = p_sku
     for update;
  if not found then
    return jsonb_build_object('status', 'refused', 'reason', 'unknownGrant');
  end if;

  select * into current_version
    from commerce.paid_deliverable_versions v
   where v.id = commerce.granted_version_id(grant_row);

  select * into wanted
    from commerce.paid_deliverable_versions v
   where v.id = p_version_id and v.sku = p_sku;
  -- `current_version` is spelled out rather than left to the comparison: a null
  -- record makes `wanted.version <= current_version.version` null rather than
  -- false, and a null `if` does not fire — which would let an upgrade through
  -- in exactly the case where nothing is known about what this grant opens.
  if not found
     or current_version.id is null
     or wanted.version <= current_version.version
  then
    return jsonb_build_object('status', 'refused', 'reason', 'notAnUpgrade');
  end if;

  update commerce.order_access_grants
     set upgraded_version_id = wanted.id
   where id = grant_row.id;

  perform commerce.record_audit(
    'order-access.upgraded', p_sku, placed.reference,
    commerce.audit_metadata(current_version),
    commerce.audit_metadata(wanted)
      || jsonb_build_object('note', commerce.tidy_reason(p_reason))
  );

  return jsonb_build_object('status', 'recorded');
end;
$$;

-- Write down what a person decided about an order, and settle the Order Anomaly
-- they decided it about.
--
-- The whole of what this application does about a duplicate or unusual payment.
-- No refund is issued here and none ever will be: money is returned in the
-- payment provider's own dashboard, by somebody who chose to, and this records
-- that they did (issue #15).
create or replace function public.commerce_annotate_order(
  p_reference text,
  p_anomaly_id uuid,
  p_note text
)
  returns jsonb
  language plpgsql
  security definer
  set search_path = ''
as $$
declare
  placed commerce.orders;
  settled commerce.order_anomalies;
  refusal text;
begin
  perform commerce.require_operator();

  select * into placed from commerce.orders o where o.reference = p_reference;
  if not found then
    return jsonb_build_object('status', 'refused', 'reason', 'unknownOrder');
  end if;

  refusal := commerce.reason_refusal(p_note);
  if refusal is not null then
    return jsonb_build_object('status', 'refused', 'reason', refusal);
  end if;

  if p_anomaly_id is not null then
    select * into settled
      from commerce.order_anomalies a
     where a.id = p_anomaly_id and a.order_id = placed.id
       for update;
    if not found then
      return jsonb_build_object('status', 'refused', 'reason', 'unknownAnomaly');
    end if;
    if settled.resolved_at is not null then
      return jsonb_build_object(
        'status', 'refused', 'reason', 'anomalyAlreadySettled'
      );
    end if;

    update commerce.order_anomalies
       set resolved_at = now(),
           resolution = commerce.tidy_reason(p_note),
           resolved_by = auth.uid(),
           resolved_by_email = auth.jwt() ->> 'email'
     where id = settled.id;
  end if;

  perform commerce.record_audit(
    'order.annotated', null, placed.reference, null,
    jsonb_build_object('note', commerce.tidy_reason(p_note))
      || case
           when settled.id is null then '{}'::jsonb
           else jsonb_build_object('anomaly', settled.kind)
         end
  );

  return jsonb_build_object('status', 'recorded');
end;
$$;

-- Record that a Commerce Operator took up a failed delivery, and how it went.
--
-- The one audit entry not written in the same transaction as the change it
-- describes, because the change is not this function's to make: a delivery is
-- claimed and settled through `commerce_begin_fulfillment`, which carries no
-- staff identity and never will — it is reached from a webhook. What is
-- recorded here is the operator's own act, and the Fulfillment State on either
-- side of it.
create or replace function public.commerce_note_delivery_retry(
  p_reference text,
  p_before text,
  p_after text
)
  returns void
  language plpgsql
  security definer
  set search_path = ''
as $$
begin
  perform commerce.require_operator();

  if p_before not in ('not_started', 'processing', 'delivered', 'failed')
     or p_after not in ('not_started', 'processing', 'delivered', 'failed')
  then
    raise exception 'commerce: % and % are not Fulfillment States',
      p_before, p_after
      using errcode = '22023';
  end if;

  perform commerce.record_audit(
    'order-delivery.retried', null, p_reference,
    jsonb_build_object('fulfillment', p_before),
    jsonb_build_object('fulfillment', p_after)
  );
end;
$$;

-- ---------------------------------------------------------------------------
-- Grants
-- ---------------------------------------------------------------------------

-- Every one of these reads or writes commerce data under a staff identity, so
-- every one of them is granted to `authenticated` and refuses a caller who has
-- not reached assurance level 2 with the Commerce Operator role. `anon` is not
-- among them: nothing here is reachable without a session.
revoke all on function public.commerce_orders(text, integer) from public;
revoke all on function public.commerce_order_dossier(text) from public;
revoke all on function public.commerce_correct_buyer_contact(text, text, text, text)
  from public;
revoke all on function public.commerce_reissue_order_access(text, text, text)
  from public;
revoke all on function public.commerce_upgrade_grant_version(text, text, uuid, text)
  from public;
revoke all on function public.commerce_annotate_order(text, uuid, text) from public;
revoke all on function public.commerce_note_delivery_retry(text, text, text)
  from public;

grant execute on function public.commerce_orders(text, integer) to authenticated;
grant execute on function public.commerce_order_dossier(text) to authenticated;
grant execute on function public.commerce_correct_buyer_contact(text, text, text, text)
  to authenticated;
grant execute on function public.commerce_reissue_order_access(text, text, text)
  to authenticated;
grant execute on function public.commerce_upgrade_grant_version(text, text, uuid, text)
  to authenticated;
grant execute on function public.commerce_annotate_order(text, uuid, text)
  to authenticated;
grant execute on function public.commerce_note_delivery_retry(text, text, text)
  to authenticated;

-- Restated because `create or replace` on a `security definer` function is the
-- moment to be sure of who may execute it. Nothing here changed.
revoke all on function public.commerce_audit_entries(integer) from public;
grant execute on function public.commerce_audit_entries(integer) to authenticated;

revoke all on function public.commerce_download_target(text, text) from public;
grant execute on function public.commerce_download_target(text, text)
  to anon, authenticated;

revoke all on function public.commerce_begin_fulfillment(
  text, text, text, integer, integer, integer
) from public;
grant execute on function public.commerce_begin_fulfillment(
  text, text, text, integer, integer, integer
) to anon, authenticated;
