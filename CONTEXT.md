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
An authorized WeCreate staff member who reviews Digital Product orders, resolves fulfillment failures, and reissues Order Access. This role does not edit payment history.
_Avoid_: Customer, content editor, site administrator

**Paid Deliverable**:
A private file purchased as a Digital Product and made accessible only through valid Order Access.
_Avoid_: CMS asset, public media, attachment

**Commerce Launch Gate**:
The approval boundary that keeps production purchasing disabled until commercial terms, legal text, real Paid Deliverables, and production integrations are ready.
_Avoid_: Development completion, staging readiness, site launch

**Custom Quote**:
A service offer whose scope or price intentionally differs from a published service pack and is explicitly approved as such.
_Avoid_: Edited pack price, discount, service pack

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

**Fulfillment State**:
The independently tracked progress of granting access or delivering confirmation after an approved payment.
_Avoid_: Payment state, order status
