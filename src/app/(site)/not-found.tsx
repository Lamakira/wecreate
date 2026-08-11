import { CtaLink } from "@/components/primitives/cta-link";

/**
 * What a visitor gets when the thing they asked for is not there.
 *
 * It is also what a Portfolio Project that has not been published, or has not
 * passed its publication gate, resolves to — the same answer as a slug that
 * never existed, so nothing here hints that a different one would be given to
 * someone else.
 *
 * On a route with a dynamic segment the response has already begun streaming by
 * the time the project is known to be missing, so the status is 200 rather than
 * 404. Next.js injects `<meta name="robots" content="noindex">` for exactly this
 * case; returning a real 404 status would mean resolving every slug in a proxy
 * before the response starts, which puts a content read on every request into
 * the portfolio (ADR-0003).
 */
export default function NotFound() {
  return (
    <section className="wc-container py-section" data-testid="not-found">
      <p className="m-0 mb-[22px] text-micro tracking-32 uppercase text-wc-muted-2">
        Page introuvable
      </p>
      <h1 className="m-0 max-w-[22ch] font-display text-page-title font-medium">
        Cette page n&apos;existe <em className="italic">pas</em>.
      </h1>
      <p className="mt-heading-gap max-w-[52ch] border-t border-wc-line-dark pt-6 text-body-lg font-light text-wc-soft">
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
