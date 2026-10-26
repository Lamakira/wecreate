import { NotFoundContent } from "@/components/shell/not-found-content";
import { SitePage } from "@/components/shell/site-page";
import { DEFAULT_SITE_CONTENT } from "@/managed-content/default-content";

/**
 * What a visitor gets for a URL that no route answers.
 *
 * **It reads no Managed Content.** Next.js renders this file's element into the
 * response of every page in the `(site)` segment, not only when something is
 * missing, because the not-found boundary is handed it as a prop. A provider
 * read here would therefore be a second round trip on every cold render of
 * every public page — the one thing issue #24 promises never to cost. So the
 * header, footer and legal links on this page are the bundled defaults, and the
 * title is the shared layout's. That is a known limitation of unknown URLs only:
 * a missing Portfolio Project, Digital Product, legal document or legal
 * revision renders `NotFoundContent` inside its own route, with the editor's
 * chrome and metadata, and never answers from this file.
 *
 * Whatever reaches this file answers 200 with `noindex` rather than 404 on a
 * route with a dynamic segment: the response has already begun streaming by
 * the time the thing is known to be missing, and Next.js injects
 * `<meta name="robots" content="noindex">` for exactly that case. Returning a
 * real 404 status would mean resolving every slug in a proxy before the
 * response starts, which puts a content read on every request (ADR-0003).
 */
export default function NotFound() {
  const { settings, legalDocuments } = DEFAULT_SITE_CONTENT;

  return (
    <SitePage settings={settings} legalDocuments={legalDocuments}>
      <NotFoundContent />
    </SitePage>
  );
}
