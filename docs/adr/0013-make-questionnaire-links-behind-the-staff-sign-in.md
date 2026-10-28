---
status: accepted
---

# Make questionnaire links behind the staff sign-in

Amends ADR-0006. The tool WeCreate's team uses to make a client's Questionnaire
Invitation (issue #63) lives in the staff back office, at
`/commerce/questionnaire`, behind the sign-in that already protects it. The
handoff marked it "à protéger par mot de passe"; a password shared between the
team would be the shared account the back office was built to avoid, so it is
the individual staff sign-in instead: an account of one's own, a password and a
code from one's own authenticator.

**Why inside rather than beside.** The staff session is a cookie scoped to
`/commerce`, and that scope is what keeps it off every public page. A tool at
another address would need the cookie widened to it, which loosens the one
property the session is built on, or a second sign-in, which is the shared
password again. Under `/commerce` it inherits everything the back office
already has: no site chrome, `noindex` on every deployment, and a data plane
that has to exist before anybody can sign in at all.

**What ADR-0006 protects does not move.** The back office still holds Digital
Product commerce and no Service Enquiry: the tool reads no order, writes no row,
names nobody in the audit trail and touches no commerce data. It turns four
words into a sealed link (`sealInvitation`, `src/brand-questionnaire/`) and
forgets them; the staff member sends the link from their own WhatsApp or mail
client, and the client's number and address never leave their browser.

**Any staff member, not only a Commerce Operator.** Making a link is Branding
work, not commerce administration, so the tool asks for a fully authenticated
staff account — signed in, second factor proved — and not for the
`commerce_operator` role. Staff accounts are created by WeCreate one per person
and sign-up is disabled, so "has an account and its authenticator" is exactly
"is on WeCreate's team". A Content Editor refused by the commerce pages is
pointed to the tool from that refusal.

The cost is a tool whose address says *commerce* when it is not, and a
dependency on the commerce data plane for a feature that stores nothing: a
deployment without Supabase cannot make links. Both are cheaper than a second
way to sign in.
