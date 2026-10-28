import { CtaLink } from "@/components/primitives/cta-link";

/**
 * What a visitor reads when the thing they asked for is not there.
 *
 * The body only, without header or footer: the 404 page wraps it in the site
 * chrome it reads itself, and a route that has already read the site (a missing
 * Portfolio Project or Digital Product) wraps it in its own `SitePage`, so the
 * answer costs no second provider round trip.
 */
export function NotFoundContent() {
  return (
    <section className="wc-container py-section" data-testid="not-found">
      <p className="m-0 mb-[22px] text-micro tracking-32 uppercase text-wc-text-muted">
        Page introuvable
      </p>
      <h1 className="m-0 max-w-[22ch] font-display text-page-title font-medium">
        Cette page n&apos;existe <em className="italic">pas</em>.
      </h1>
      <p className="mt-heading-gap max-w-[52ch] border-t border-wc-line pt-6 text-body-lg font-light text-wc-text-soft">
        Le lien est peut-être ancien, ou le projet n&apos;est pas encore publié.
      </p>
      <div className="mt-heading-gap flex flex-wrap gap-3">
        <CtaLink
          cta={{ label: "Voir le portfolio", href: "/portfolio" }}
          variant="ghost"
        />
        <CtaLink
          cta={{ label: "Retour à l'accueil", href: "/" }}
          variant="ghost"
        />
      </div>
    </section>
  );
}
