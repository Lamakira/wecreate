## Agent skills

### Issue tracker

Issues and specs are tracked with GitHub Issues. See `docs/agents/issue-tracker.md`.

### Triage labels

The default five-role triage vocabulary is used. See `docs/agents/triage-labels.md`.

### Domain docs

This repository uses the single-context layout. See `docs/agents/domain.md`.

## The application

Setup, environment variables, the Managed Content boundary and how to run the
acceptance suite are documented in `README.md`. Read it before changing code.

Two rules that are easy to break without noticing:

- **External services are reached through an application-owned interface**
  (ADR-0008). A vendor SDK may be imported from exactly two places: the adapter
  that implements the interface (`src/managed-content/sanity/`) and the vendor's
  own authoring surface (`src/sanity/`, plus `sanity.config.ts` /
  `sanity.cli.ts`, which are the Studio). No component, page, route handler or
  shared helper imports it — where a route handler needs vendor behaviour, it
  calls into `src/sanity/` (see `src/sanity/preview.ts`). The same shape applies
  to every provider added later.
- **Tests live at one seam.** `tests/e2e` drives the complete running
  application through a browser, with provider fakes at the outbound boundary.
  Do not add component tests or mock internal modules.

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
