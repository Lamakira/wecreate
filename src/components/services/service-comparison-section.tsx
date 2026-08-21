import { Reveal } from "@/components/primitives/reveal";
import type { ServiceComparisonContent } from "@/managed-content/types";

interface ServiceComparisonSectionProps {
  comparison: ServiceComparisonContent;
}

/**
 * The Entreprises packs side by side, on the light band.
 *
 * A real table: a caption naming it, column headers for the packs and a row
 * header for each criterion, so a screen reader announces "Pack Croissance,
 * Vidéos par mois, 8" rather than a bare number. `scope` is what makes those
 * associations, and it is the whole reason this is not a grid of divs.
 *
 * Narrow screens scroll it sideways inside its own container rather than
 * squeezing the page: the wrapper is focusable and labelled so a keyboard user
 * can reach the scroll it creates.
 */
export function ServiceComparisonSection({
  comparison,
}: ServiceComparisonSectionProps) {
  return (
    <section
      aria-labelledby="service-comparison-heading"
      data-surface="light"
      className="bg-wc-white py-section-sm text-wc-pure"
    >
      <div className="wc-container">
        <Reveal>
          <p className="m-0 mb-3.5 text-micro tracking-30 uppercase text-wc-muted-on-light">
            {comparison.kicker}
          </p>
          <h2
            id="service-comparison-heading"
            className="m-0 mb-heading-gap font-display text-[clamp(28px,4vw,54px)] font-medium"
          >
            {comparison.title}
          </h2>
        </Reveal>

        <div
          data-testid="service-comparison-scroller"
          tabIndex={0}
          role="region"
          aria-label={comparison.caption}
          className="max-w-full min-w-0 overflow-x-auto"
        >
          <table className="w-full min-w-[620px] border-collapse text-body-sm">
            <caption className="sr-only">{comparison.caption}</caption>
            <thead>
              <tr>
                <th
                  scope="col"
                  className="border-b border-wc-pure px-3 py-3.5 text-left text-micro font-semibold tracking-20 uppercase"
                >
                  <span className="sr-only">Critère</span>
                </th>
                {comparison.columns.map((column) => (
                  <th
                    key={column}
                    scope="col"
                    className="border-b border-wc-pure px-3 py-3.5 text-left text-micro font-semibold tracking-20 uppercase"
                  >
                    {column}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {comparison.rows.map((row) => (
                <tr key={row.key}>
                  <th
                    scope="row"
                    className="border-b border-wc-line-light px-3 py-3.5 text-left font-normal text-wc-muted-on-light"
                  >
                    {row.label}
                  </th>
                  {row.values.map((value, index) => (
                    <td
                      key={comparison.columns[index] ?? index}
                      className="border-b border-wc-line-light px-3 py-3.5"
                    >
                      {value}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}
