---
status: accepted
---

# One application-owned boundary per external provider

Every external service will be reached through an interface this repository
defines, in the vocabulary of `CONTEXT.md`, with the vendor's SDK confined to
two places: the adapter implementing that interface, and — where the vendor also
ships an admin surface we host — that surface. Managed Content sets the pattern:
`ManagedContentProvider` is the only way content enters the application, the
Sanity adapter under `src/managed-content/sanity/` is the only implementation
that talks to Sanity, `src/sanity/` holds the Studio, its schema and the
vendor-specific halves of preview and revalidation, and a deterministic fixture
implements the same interface for tests and for a checkout with no credentials.
Route handlers stay vendor-neutral: they decide who is allowed, then delegate.

This costs a mapping layer per provider and means the CMS's own richer types are
not available to components. In exchange the black-box acceptance seam this
project depends on becomes possible: tests swap providers at the boundary and
drive the complete running application, instead of mocking internal modules that
a refactor would invalidate. It also keeps a fresh checkout runnable — the site
builds, runs and passes its tests before anyone has a Sanity project — and gives
Mux, FedaPay, Resend, Calendly and Supabase Storage a shape to arrive in.
