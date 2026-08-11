import type { StructureResolver } from "sanity/structure";

/**
 * The Studio's navigation.
 *
 * Both content types are singletons, so they are listed as documents to open
 * rather than folders to create things in. There is no "new document" path in
 * the sidebar at all.
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
        .title("Paramètres du site")
        .id("siteSettings")
        .child(
          S.document().schemaType("siteSettings").documentId("siteSettings"),
        ),
    ]);
