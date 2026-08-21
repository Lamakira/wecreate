import { jsonLdText } from "@/seo/json-ld";

/**
 * One Schema.org graph, in the page.
 *
 * A native script tag rather than a metadata field: Next.js has no JSON-LD
 * slot, and this is how its own guide says to emit structured data.
 */
export function JsonLdScript({ data }: { data: object }) {
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: jsonLdText(data) }}
    />
  );
}
