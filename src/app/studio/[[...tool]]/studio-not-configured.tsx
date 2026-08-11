/**
 * What `/studio` shows before a Sanity project exists.
 *
 * The site itself keeps working in this state — it falls back to the fixture
 * content provider — so this is a setup prompt, not an error page.
 */
export function StudioNotConfigured() {
  return (
    <main className="mx-auto max-w-[70ch] px-gutter py-section">
      <h1 className="m-0 font-display text-section font-medium">
        Studio non configuré
      </h1>
      <p className="mt-6 text-body-lg font-light text-wc-soft">
        Aucun projet Sanity n&apos;est associé à ce déploiement. Le site
        fonctionne avec le contenu de démonstration intégré.
      </p>
      <p className="mt-6 text-body font-light text-wc-soft">
        Pour activer l&apos;édition, renseignez les variables suivantes puis
        redéployez :
      </p>
      <ul className="mt-4 list-none space-y-2 p-0 font-mono text-body-sm text-wc-soft">
        <li>NEXT_PUBLIC_SANITY_PROJECT_ID</li>
        <li>NEXT_PUBLIC_SANITY_DATASET</li>
        <li>SANITY_API_READ_TOKEN</li>
      </ul>
      <p className="mt-6 text-body-sm font-light text-wc-muted-2">
        La procédure complète est décrite dans le README du projet.
      </p>
    </main>
  );
}
