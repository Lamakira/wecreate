import type { Metadata } from "next";

import type { SeoDefaults } from "@/managed-content/types";

import { pageOpenGraph } from "./open-graph";

/**
 * The editor-owned metadata a public route must carry itself.
 *
 * The shared `(site)` layout cannot supply any of this. Its metadata would have
 * to come from a Managed Content read of its own, and under Cache Components a
 * layout and a page are separate work units — a second read there is a second
 * provider round trip on every render. So each route sets its metadata from the
 * same cached read its body uses, through this helper, and an editor's
 * `siteSettings.seo` (template, site name, default description, default image)
 * reaches every page without the layout reading anything.
 *
 * Because the route owns its title, it also owns the template. Next.js applies a
 * parent `title.template` to a child's title, but never to a title in the same
 * segment — so the layout's template would skip the homepage and apply to
 * everything else. Instead of relying on that, the title is emitted as
 * `title.absolute` with the CMS template already applied, and the homepage opts
 * out with `template: false`.
 *
 * With no `page` — a route that has no title of its own — the site's default
 * title and description stand in.
 */
export function pageMetadata(
  seo: SeoDefaults,
  page?: {
    title: string;
    description?: string;
    imageUrl?: string | null;
  },
  options: {
    /** Apply `seo.titleTemplate`. Off for the homepage, whose title is the brand's own. */
    template?: boolean;
  } = {},
): Metadata {
  const { template = true } = options;
  const description = page?.description ?? seo.defaultDescription;
  const title = page
    ? template
      ? applyTitleTemplate(seo.titleTemplate, page.title)
      : page.title
    : seo.defaultTitle;

  return {
    title: { absolute: title },
    description,
    applicationName: seo.siteName,
    openGraph: pageOpenGraph(
      {
        title: page?.title ?? seo.defaultTitle,
        description,
        imageUrl: page?.imageUrl,
      },
      seo,
    ),
  };
}

/** Next.js's own substitution: every `%s` in the template becomes the title. */
function applyTitleTemplate(template: string, title: string): string {
  // A function replacer, so a `$&` in an editor's title is text, not a pattern.
  return template.replaceAll("%s", () => title);
}
