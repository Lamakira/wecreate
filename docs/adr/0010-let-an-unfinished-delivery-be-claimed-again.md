---
status: accepted
---

# Let an unfinished delivery be claimed again

A delivery will be claimable again once it has stopped: after one that failed,
and after one abandoned unfinished for longer than a stated window. Until now a
Fulfillment State could leave `not_started` exactly once, which made "one
approval delivers once" true by making a second delivery impossible — and, with
it, made every delivery that did not succeed permanently unfinished. A receipt
that could not be sent left an order at *Livraison à reprendre* with nothing in
this application able to take it up, and a process that stopped between claiming
an order and finishing it left one at *Préparation en cours* for ever, which is
worse: nothing had failed, so nothing said so.

The guarantee ADR-0005 actually asks for is that a delivery happens once, not
that it is attempted once. So what is closed is narrower and exact. `delivered`
is terminal in every direction — a buyer who has their files does not stop
having them because a later process was confused — and a claim somebody is
holding right now is theirs. Everything else may be taken up. What makes that
safe is that the durable half is idempotent rather than repeated: the grants are
made once per order line and a buyer's allowance is never reset by a second
delivery, and one order holds one live Order Access token, reissued in place
with its thirty days still measured from the approval.

Two things follow that are easy to get wrong. A claim is now held by a *caller*
rather than by a state, so settling one names it: a request that gave up ten
minutes ago and finally reports its failure would otherwise mark an order failed
that had just been delivered by the request that replaced it. And a receipt's
idempotency key names the issuance rather than the order, because a delivery
taken up again emails a fresh token — a key naming only the order would have the
provider swallow the second message as a repeat of one the buyer never received.

Reissuing on every claim is the deliberate half of that, and it is not free.
Only the digest of a token is kept, so a delivery being taken up cannot email
the address the last one did; it can only email a new one. The rule that falls
out is the one worth keeping — *the last receipt WeCreate sent always carries a
live address* — and the price is a narrow case where a receipt was accepted and
the settlement that should have followed it was not: the buyer holds a working
link, the claim goes stale, and the delivery that takes it up replaces their
link with the one in a second message. If that second message also fails they
are left holding a dead address, at *Livraison à reprendre*, with the support
route the page already offers. The alternative is a delivery that can be taken
up and has nothing usable to send, which is worse.

The cost is a window, and a wrong guess in either direction is a real failure: too
short and a slow mail provider is treated as a dead process, which is how a buyer
gets two receipts; too long and a delivery WeCreate could have finished sits
there instead. It is `FULFILLMENT_STALL_SECONDS` in
`src/commerce/order-access.ts`, fifteen minutes, comfortably longer than any
request this application survives.

What is still not here is a person deciding to retry one. Redelivery by the
payment provider is what takes an unfinished delivery up today, which covers the
outage that ends within a provider's retry schedule and nothing beyond it. The
back office retry, and reissuing a token to a corrected address, are issue #15's
— and the anomalies recorded here are what that surface will open on.
