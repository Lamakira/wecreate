import { LegalAcceptanceNote } from "@/components/legal/legal-acceptance-note";
import { LegalApprovalNotice } from "@/components/legal/legal-approval-notice";
import { LegalPlaceholderNotice } from "@/components/legal/legal-placeholder-notice";
import { LegalRevisionHistory } from "@/components/legal/legal-revision-history";
import { LegalSupersededNotice } from "@/components/legal/legal-superseded-notice";
import { formatEffectiveDate } from "@/lib/format";
import type { LegalDocumentInForce } from "@/managed-content";
import type { LegalCheckoutTerms } from "@/managed-content/legal";
import type { LegalRevision } from "@/managed-content/types";

interface LegalDocumentViewProps {
  /** The document, the revision that applies today, and what it said before. */
  inForce: LegalDocumentInForce;
  /**
   * The revision being read. Defaults to the one in force; the archive route
   * passes an older one, which is the only difference between the two pages.
   */
  revision?: LegalRevision;
  /**
   * Whether WeCreate may sell yet. Passed only in preview: which documents are
   * still waiting for approved text is what an editor needs to know, not a
   * visitor.
   */
  checkout?: LegalCheckoutTerms;
}

/**
 * One legal document, read.
 *
 * The same component serves the document's own address and one archived
 * revision of it, because they are the same text seen from two dates — an
 * archived revision that rendered differently would be a second version of
 * WeCreate's terms, which is the opposite of the point.
 *
 * Three things sit between the title and the text, in this order: whether the
 * revision is still in force, whether WeCreate has approved it, and what
 * accepting it does. A visitor reaches the words already knowing what they are
 * looking at.
 */
export function LegalDocumentView({
  inForce,
  revision = inForce.current,
  checkout,
}: LegalDocumentViewProps) {
  const { document, current, history } = inForce;

  return (
    <article className="wc-container pt-[clamp(28px,5vw,64px)] pb-section-sm">
      <p className="m-0 mb-[22px] text-micro tracking-32 uppercase text-wc-muted-2">
        Informations légales
      </p>
      <h1 className="m-0 max-w-[22ch] font-display text-page-title font-medium">
        {document.title}
      </h1>
      <p className="mt-heading-gap max-w-[62ch] text-body-lg font-light text-wc-soft">
        {document.summary}
      </p>

      <dl
        data-testid="legal-revision-meta"
        className="mt-heading-gap flex flex-wrap gap-x-10 gap-y-3 border-t border-wc-line-dark pt-6"
      >
        <div>
          <dt className="m-0 text-micro tracking-20 uppercase text-wc-muted-2">
            En vigueur depuis
          </dt>
          <dd className="m-0 mt-1 text-body-sm font-light text-wc-white">
            {formatEffectiveDate(revision.effectiveFrom)}
          </dd>
        </div>
        <div>
          <dt className="m-0 text-micro tracking-20 uppercase text-wc-muted-2">
            Révision
          </dt>
          <dd className="m-0 mt-1 text-body-sm font-light text-wc-white">
            {revision.id}
          </dd>
        </div>
      </dl>

      <div className="mt-heading-gap flex max-w-[70ch] flex-col gap-5">
        {revision.id === current.id ? null : (
          <LegalSupersededNotice
            slug={document.slug}
            replacedOn={current.effectiveFrom}
          />
        )}

        {revision.status === "placeholder" ? <LegalPlaceholderNotice /> : null}

        {checkout ? <LegalApprovalNotice checkout={checkout} /> : null}

        <LegalAcceptanceNote kind={document.kind} />
      </div>

      <div className="mt-section-xs flex max-w-[70ch] flex-col gap-heading-gap">
        {revision.sections.map((section) => (
          <section key={section.key} data-testid="legal-section">
            <h2 className="m-0 mb-4 font-display text-product-title font-medium">
              {section.heading}
            </h2>
            {section.paragraphs.map((paragraph, index) => (
              <p
                key={index}
                className="m-0 mb-4 text-body font-light text-wc-soft last:mb-0"
              >
                {paragraph}
              </p>
            ))}
          </section>
        ))}
      </div>

      <div className="max-w-[70ch]">
        <LegalRevisionHistory
          slug={document.slug}
          history={history}
          current={current}
        />
      </div>
    </article>
  );
}
