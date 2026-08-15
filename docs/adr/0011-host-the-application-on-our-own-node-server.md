---
status: accepted
---

# Host the application on our own Node server

WeCreate will serve this application as a `next start` process on its own
Paris VPS, behind the nginx that already fronts the other sites there, with
Cloudflare in front of it as a CDN. Not Vercel, which issue #1 named and which
ADR-0003 assumed when it asked for the server functions and the Supabase project
to be colocated in Paris.

The reason is commercial rather than technical. Vercel's free plan excludes
commercial use, and this site advertises a working agency's services and sells
Digital Products; its paid plan is priced per seat and per month at a level that
is out of proportion to what WeCreate is. Neither of those is an argument about
Next.js, and neither is a reason to change a line of application code.

**It is not a downgrade, and it is worth being precise about why.** Next.js
states its own requirement as *a Node.js server — that's it*: one `next start`
process handles Server Components, ISR, PPR, Cache Components, Server Functions,
the proxy and `after()` correctly. What a platform adapter buys is performance
fidelity — a static shell served at CDN latency rather than from the origin —
and a shared cache backend, which the framework recommends for deployments
running several instances so that revalidation propagates between them. WeCreate
runs one instance. The recommendation does not apply, and `updateTag()` on a
version activation reaches the only cache there is.

**It honours ADR-0003 more closely than the platform it replaces.** That decision
asks for the transactional path to sit beside the Supabase project in Paris. The
VPS is in Paris, in the same city as the project, rather than wherever a global
platform decides to run a function; the FedaPay webhook, an order read and a
delivery are a short hop rather than a continental one. Public pages still come
from a cache in front rather than from Postgres, which is the other half of what
ADR-0003 asks.

Three things change with it. Vercel Web Analytics and Speed Insights are not
available, so anonymous measurement and Core Web Vitals become Cloudflare's to
provide — which is issue #16's to settle, and its acceptance criteria say so
now. The `VERCEL_*` fallbacks in `siteUrl()` stop being reachable; the origin is
named by `NEXT_PUBLIC_SITE_URL` and by nothing else, which is what the support
route handler's origin check and every emailed Order Access address depend on.
And the request body an upload travels in is nginx's to set rather than a
platform's to cap, so the 25 MB ceiling on a Paid Deliverable Version stops
being a Commerce Launch Gate item waiting on a direct-to-storage upload.

What it costs is operations, and the cost is real. WeCreate now renews
certificates, updates an operating system, restarts a process, and owns a deploy
pipeline. `next build` saturates both cores of that machine for minutes and
would degrade the site already running there, so the build belongs in CI and
only its output belongs on the server. And one instance means the site is down
when the machine is — which is a different risk from a platform's, not a smaller
one.

Nothing else moves. Sanity, Supabase, Mux, Resend and FedaPay are reached across
the same boundaries they always were, and no code in `src/` knows where it is
deployed: one environment variable names the origin, and the acceptance suite
never asked.
