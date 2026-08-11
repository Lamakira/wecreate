---
status: superseded by ADR-0006
---

# Separate editorial and commerce administration

Sanity will own Managed Content and public media, while a protected staff back office backed by Supabase will expose Reservation Requests, orders, payment states, Availability Holds, and Order Access operations. Paid Deliverables and financial history will never be editable through the CMS, trading a second administration surface for a clear security boundary between editorial autonomy and commerce operations.
