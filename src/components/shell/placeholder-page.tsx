import { CtaLink } from "@/components/primitives/cta-link";

interface PlaceholderPageProps {
  /** The page's navigation label. */
  title: string;
}

/**
 * A route that exists so navigation works, and says plainly that its content is
 * still to come.
 *
 * The six-link navigation ships with the homepage, so these routes have to
 * resolve — a nav that 404s is not a usable nav. It carries none of the real
 * page's editorial copy: each owning ticket brings its own approved wording
 * along with the page itself. See the comment in each page file for which
 * ticket that is.
 */
export function PlaceholderPage({ title }: PlaceholderPageProps) {
  return (
    <section className="mx-auto max-w-site px-gutter py-section">
      <p className="m-0 mb-[22px] text-micro tracking-32 uppercase text-wc-muted-2">
        Bientôt disponible
      </p>
      <h1 className="m-0 max-w-[22ch] font-display text-page-title font-medium">
        {title}
      </h1>
      <p className="mt-heading-gap max-w-[52ch] border-t border-wc-line-dark pt-6 text-body-lg font-light text-wc-soft">
        Cette page arrive bientôt. En attendant, écrivez-nous : nous répondons
        sous 24-48h.
      </p>
      <div className="mt-heading-gap flex flex-wrap gap-3">
        <CtaLink cta={{ label: "Retour à l'accueil", href: "/" }} variant="ghost" />
      </div>
    </section>
  );
}
