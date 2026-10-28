---
status: accepted
---

# Email contact form messages to WeCreate and store nothing

Amends ADR-0006. A Service Enquiry may now also start from a contact form on
`/contact`, beside WhatsApp, the Discovery Call and the administrative email.
Version one had removed the design prototype's form (issue #1, *Out of Scope*),
and ADR-0006 described a Service Enquiry as WhatsApp or a call. Version two
brings the form back (issue #55, decision 2) because WeCreate now sells Branding
and Site web as well as video, and some visitors would rather write a few lines
than open a chat or book a call.

What ADR-0006 protects does not move. A submitted form creates no order, no
payment, no reservation, no availability hold and no stored lead: the message is
sent once, by email, to the administrative address published on the page
(`settings.contact.email`), with the visitor's address as the reply-to, and it
is written nowhere else — not in the commerce data plane, not in a file, not in
a cookie. WeCreate's mailbox is the only copy. A message that could not be sent
stays in the visitor's browser with a plain explanation and the WhatsApp route,
so the visitor loses nothing and WeCreate never holds a half-received lead.

Sending goes through the existing email boundary (ADR-0008). The only addition
there is an optional reply-to on a message; the form composes its own message
and the provider adapter stays the only code that knows Resend exists. The
destination is Managed Content rather than a new environment variable, so the
address a visitor reads on `/contact` is the one their message reaches, an
editor changes both at once, and a deployment that nobody reconfigured still
delivers.

The form is public, so it carries abuse protection that costs a real visitor
nothing: a field hidden from people that only a script fills in, which is
answered as if it had worked and sends nothing; and a sliding limit per network
address and per sender address, in the same in-process limiter as the other
public surfaces (ADR-0011). There is no CAPTCHA and no third-party widget, for
the reasons ADR-0003 keeps scripts off public pages. A double submission is one
email, because the message's idempotency key is derived from what it says.

The cost is a lead that exists only in a mailbox: WeCreate cannot count
enquiries on the site, and a message lost by the mail provider after it was
accepted is lost. That is the trade ADR-0006 already made for WhatsApp and
calls, and storing leads would need a retention period and a privacy policy
change that this decision deliberately does not take.
