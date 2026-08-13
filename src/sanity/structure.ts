import type { StructureBuilder, StructureResolver } from "sanity/structure";

/**
 * The five legal documents, and the document id each one is pinned to.
 *
 * The id is the identity a checkout resolves terms by — `legal.cgv` maps to the
 * `cgv` kind in `src/managed-content/sanity/provider.ts`, and the two have to
 * stay in step. Written out rather than generated so the sidebar reads as what
 * it is: a fixed list an editor opens, never one they add to.
 *
 * Each title is the shipped document's own, from
 * `src/managed-content/default-content.ts`. An editor who renames a document
 * sees the sidebar keep the original name, which is the trade for a label that
 * does not need a content read to draw — but two *different* names for the same
 * document out of the box would be a mistake, not a trade.
 */
const LEGAL_DOCUMENTS: ReadonlyArray<{ id: string; title: string }> = [
  { id: "legal.cgv", title: "Conditions générales de vente" },
  {
    id: "legal.livraison-remboursement",
    title: "Livraison numérique et remboursement",
  },
  { id: "legal.licence", title: "Licence des produits numériques" },
  { id: "legal.confidentialite", title: "Politique de confidentialité" },
  { id: "legal.mentions-legales", title: "Mentions légales" },
];

function legalDocuments(S: StructureBuilder) {
  return S.list()
    .title("Documents légaux")
    .items(
      LEGAL_DOCUMENTS.map(({ id, title }) =>
        S.listItem()
          .title(title)
          .id(id)
          .child(S.document().schemaType("legalDocument").documentId(id)),
      ),
    );
}

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
        .title("Page services")
        .id("servicesPage")
        .child(
          S.document().schemaType("servicesPage").documentId("servicesPage"),
        ),
      S.listItem()
        .title("Page à propos")
        .id("aboutPage")
        .child(S.document().schemaType("aboutPage").documentId("aboutPage")),
      S.listItem()
        .title("Page contact")
        .id("contactPage")
        .child(S.document().schemaType("contactPage").documentId("contactPage")),
      S.listItem()
        .title("Documents légaux")
        .id("legalDocuments")
        .child(legalDocuments(S)),
      S.listItem()
        .title("Paramètres du site")
        .id("siteSettings")
        .child(
          S.document().schemaType("siteSettings").documentId("siteSettings"),
        ),
    ]);
