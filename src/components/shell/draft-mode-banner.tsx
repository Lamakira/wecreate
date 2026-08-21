/**
 * Shown only inside a preview session.
 *
 * Its job is to make it impossible to mistake a draft for the live site, and to
 * give the editor a one-click way back out of preview.
 */
export function DraftModeBanner() {
  return (
    <div
      data-testid="draft-mode-banner"
      className="fixed inset-x-0 bottom-0 z-1001 flex flex-wrap items-center justify-center gap-4 border-t border-wc-border bg-wc-pure px-gutter py-3 text-micro tracking-20 uppercase text-wc-white"
    >
      <meta name="robots" content="noindex, nofollow" />
      <span>Aperçu du contenu non publié</span>
      <a
        href="/api/draft/disable"
        className="border-b border-wc-border pb-0.5 transition-colors duration-300 hover:border-wc-white"
      >
        Quitter l&apos;aperçu
      </a>
    </div>
  );
}
