---
status: accepted
---

# Close only the direction that unsays a payment

A Payment State will be allowed to leave a refusal, and never to leave an
approval. Until now the rule enforced was narrower in wording and wider in
effect — a Payment State left `pending` exactly once — which also made a refused
order permanently unpayable. That was a stronger guarantee than the one ADR-0005
asks for, and it made the retry issue #1 promises impossible: a buyer may pay
again against the same immutable Order Snapshot for twenty-four hours, and a
retry FedaPay could never approve would be a button that cannot work.

So the closed direction is exactly the one that matters. `approved` is terminal
against every later event: a refusal, a cancellation and a provider retrying out
of order are all recorded and none of them acts, so no application bug, no
support action and no redelivery can unsay that a buyer paid. A `failed` or
`cancelled` order may be replaced by an approval and by nothing else, so a
second refusal cannot rewrite the first either. The rule lives in three places
that are written to agree — `paymentEventEffect()` in `src/commerce/orders.ts`,
`commerce.payment_event_effect`, and the `commerce.refuse_order_rewrite` trigger
that holds a statement no application wrote.

The cost is that "the Payment State moved" is no longer a proxy for "this
payment was answered", since a refused retry leaves it where it was. The public
order-state boundary therefore reports whether an attempt is still outstanding,
and the verification view waits on that rather than on a word changing.
