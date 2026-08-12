import { Reveal } from "@/components/primitives/reveal";
import { SectionKicker } from "@/components/primitives/section-kicker";
import type { CapabilityColumn as CapabilityColumnContent } from "@/managed-content/types";

interface CapabilityColumnProps {
  column: CapabilityColumnContent;
  /** Identifies this column's heading, so the section is named by it. */
  id: string;
}

/**
 * One column of what WeCreate is made of: *L'équipe*, *L'équipement*.
 *
 * The team column names roles, not people. WeCreate has approved no team
 * identities for publication, and a name invented here would be indistinguishable
 * from a real one to the visitor reading it — so the content model has no field
 * for a person at all, and this renders whatever the editor writes once WeCreate
 * decides who is named.
 */
export function CapabilityColumn({ column, id }: CapabilityColumnProps) {
  const headingId = `${id}-heading`;

  return (
    <section aria-labelledby={headingId}>
      <Reveal>
        <SectionKicker as="h2" id={headingId}>
          {column.kicker}
        </SectionKicker>
        <ul className="flex list-none flex-col gap-[18px] p-0">
          {column.items.map((item) => (
            <li key={item.key} className="border-t border-wc-line-dark pt-4">
              <h3 className="m-0 mb-1.5 text-[15px] font-medium">{item.title}</h3>
              <p className="m-0 text-body-sm font-light text-wc-muted-2">
                {item.description}
              </p>
            </li>
          ))}
        </ul>
      </Reveal>
    </section>
  );
}
