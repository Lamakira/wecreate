import type { StructureResolver } from "sanity/structure";

/**
 * The Studio's navigation.
 *
 * The pages are singletons, so they are listed as documents to open rather than
 * folders to create things in — there is no "new page" path in the sidebar at
 * all. Portfolio Projects are the one exception, and the only collection here:
 * WeCreate grows them.
 */
export const structure: StructureResolver = (S) =>
  S.list()
    .title("Contenu WeCreate")
    .items([
      S.listItem()
        .title("Page d'accueil")
        .id("homePage")
        .child(S.document().schemaType("homePage").documentId("homePage")),
      S.listItem()
        .title("Projets")
        .id("portfolioProjects")
        .child(
          S.documentTypeList("portfolioProject")
            .title("Projets")
            .defaultOrdering([{ field: "publishedAt", direction: "desc" }]),
        ),
      S.listItem()
        .title("Page portfolio")
        .id("portfolioPage")
        .child(
          S.document().schemaType("portfolioPage").documentId("portfolioPage"),
        ),
      S.listItem()
        .title("Paramètres du site")
        .id("siteSettings")
        .child(
          S.document().schemaType("siteSettings").documentId("siteSettings"),
        ),
    ]);
