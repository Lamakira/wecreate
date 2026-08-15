# WeCreate

The shared language for WeCreate's portfolio, digital commerce, and service-enquiry experience.

## Language

**Digital Product**:
An ebook, guide, LUT, or preset paid for in full online and delivered automatically after payment confirmation.
_Avoid_: Download, article, digital service

**Service Enquiry**:
A visitor's transition from a service offer into a WhatsApp conversation or scheduled call with WeCreate. It creates no website order, payment, reservation, or availability hold.
_Avoid_: Reservation request, booking, service order

**Discovery Call**:
A 30-minute Calendly conversation used to understand a prospective service project. Booking one is a Service Enquiry, not a reservation or commitment.
_Avoid_: Consultation order, service booking, reservation

**Portfolio Project**:
A client-approved body of WeCreate work presented with its editorial context, poster, and adaptive playback asset.
_Avoid_: Video file, gallery item, post

**Playback Asset**:
A public video prepared for adaptive streaming and referenced by a Portfolio Project or hero. It is distinct from WeCreate's archival master.
_Avoid_: Master file, Paid Deliverable, CMS attachment

**Managed Content**:
Portfolio projects, products, prices, and editorial copy that WeCreate can maintain without developer intervention.
_Avoid_: Hard-coded content, static content

**Order Snapshot**:
The immutable product names, prices, Paid Deliverable Versions, and quantities captured when a customer starts an order. Later Managed Content changes do not alter it.
_Avoid_: Live product data, current catalogue

**Digital Cart**:
An anonymous collection of distinct Digital Products intended for immediate online purchase. Service offers and Service Enquiries never enter it.
_Avoid_: Service cart, reservation cart, basket

**Order Access**:
A customer's time-limited ability to open a paid digital order and request expiring download links without creating an account.
_Avoid_: Customer account, permanent download URL

**Commerce Operator**:
An authorized WeCreate staff member who uploads and activates Paid Deliverable Versions, reviews Digital Product orders, resolves fulfillment failures, and reissues Order Access. Each holds an individual account and acts under it; the role does not edit payment history.
_Avoid_: Customer, content editor, site administrator, shared admin account

**Paid Deliverable**:
A private file purchased as a Digital Product and made accessible only through valid Order Access.
_Avoid_: CMS asset, public media, attachment

**Legal Document**:
One of WeCreate's five published legal texts: CGV, digital delivery and refund terms, Digital Product licence, privacy policy, or mentions légales. Its words and its address are editorial; which five exist is not.
_Avoid_: Terms page, legal notice, editorial page

**Legal Revision**:
The immutable, dated text of a Legal Document from one day onwards. Publishing new terms adds a revision; it never rewrites the one an Order Snapshot references. The revision in force is the most recent one whose date has arrived — the only one a checkout may present for acceptance.
_Avoid_: Legal update, current terms, CMS revision

**Commerce Launch Gate**:
The approval boundary that keeps production purchasing disabled until commercial terms, legal text, real Paid Deliverables, and production integrations are ready.
_Avoid_: Development completion, staging readiness, site launch

**Custom Quote**:
A service offer whose scope or price intentionally differs from a published service pack and is explicitly approved as such.
_Avoid_: Edited pack price, discount, service pack

**Commerce Audit Entry**:
The append-only record of one action a Commerce Operator took: who, when, which product, and safe before/after metadata. It is never rewritten or deleted, and never carries a secret, a token, or the address of a stored file.
_Avoid_: Log line, activity feed, change history

**Paid Deliverable Version**:
The immutable revision of a Paid Deliverable referenced by an Order Snapshot. Replacing a product file creates a new version rather than changing previous purchases.
_Avoid_: Current file, latest upload, CMS revision

**Purchase-Enabled Product**:
A published Digital Product that may be used to create a new Order Snapshot. Publishing its page and enabling its purchase are separate decisions.
_Avoid_: Published product, available file, active page

**Archived Product**:
A Digital Product removed from new sales while remaining identifiable in historical orders and existing access grants.
_Avoid_: Deleted product, unpublished order item

**Payment State**:
The independently tracked outcome of collecting money for a Digital Product order.
_Avoid_: Order status, fulfillment status

**Payment Prospect**:
What can still happen to an order's payment: a payment awaiting a verified
outcome, one that may be attempted again against the same Order Snapshot, or an
order nothing more will be collected for. It is a separate question from the
Payment State, because the same recorded refusal may be retried today and be a
dead end tomorrow.
_Avoid_: Payment status, retry state, order state

**Fulfillment State**:
The independently tracked progress of granting access or delivering confirmation after an approved payment.
_Avoid_: Payment state, order status

**Order Anomaly**:
Something that happened to an order which no automatic rule could settle, kept
for a Commerce Operator to resolve: a second transaction approved for one order,
a payment provider contradicting itself, a delivery that failed. It is not a
state an order is in and never changes one — it records that a person has
something to decide, and holds the provider's own identifiers rather than
anything the provider sent.
_Avoid_: Error, exception, failed order, alert
