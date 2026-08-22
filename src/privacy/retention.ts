import "server-only";

import { resolveCommerceProviderId } from "@/commerce/provider";
import { readEffectiveLegalTerms } from "@/managed-content";

/**
 * How long WeCreate keeps a buyer's contact details, when it keeps them at
 * all.
 *
 * Issue #1 is explicit: collect only what a checkout needs, make
 * retention/deletion configurable, and do not invent a period in code. There
 * is no default here. An unset variable is not "three years" and not "forever
 * with a shrug" — it is a deployment that will not forget anything, because
 * forgetting is a legal act and the privacy policy has not named a period
 * this process is allowed to apply.
 *
 * Even a configured number is inert until the privacy policy in force is
 * WeCreate's approved text. A placeholder revision is not a period anybody
 * agreed to, and silently applying one would be claiming it.
 */

export type PersonalDataRetention =
  | { status: "unconfigured" }
  | { status: "gated" }
  | { status: "configured"; days: number };

/**
 * The period this deployment may apply, or why it may not apply one.
 *
 * `unconfigured` is the absence of a number. `gated` is a number that the
 * privacy policy in force has not approved. `configured` is both, and is the
 * only status under which anything is forgotten.
 */
export async function personalDataRetention(): Promise<PersonalDataRetention> {
  const days = configuredDays();
  if (days === undefined) return { status: "unconfigured" };

  const terms = await readEffectiveLegalTerms();
  const privacy = terms.inForce.find(
    (revision) => revision.kind === "confidentialite",
  );
  if (privacy?.status !== "approved") return { status: "gated" };

  return { status: "configured", days };
}

function configuredDays(): number | undefined {
  const raw = process.env.WECREATE_PERSONAL_DATA_RETENTION_DAYS;
  if (!raw) return undefined;

  const days = Number(raw);
  if (!Number.isInteger(days) || days < 1) return undefined;
  return days;
}

/**
 * Apply the period this process is allowed to apply, or forget nobody.
 *
 * The number never comes from the caller. A job, a test hook and a named
 * operator all go through here, so an unapproved privacy policy or a missing
 * variable cannot be bypassed by passing `30` (issue #17).
 */
export async function applyPersonalDataRetention(): Promise<{
  retention: PersonalDataRetention;
  forgotten?: number;
}> {
  const retention = await personalDataRetention();
  if (retention.status !== "configured") {
    return { retention };
  }

  const forgotten = await forgetForProvider(retention.days);
  return { retention, forgotten };
}

async function forgetForProvider(days: number): Promise<number> {
  if (resolveCommerceProviderId() !== "fixture") {
    // There is no service role (src/commerce/supabase/client.ts). On Supabase
    // the data-plane job is `commerce.forget_personal_data`, run from the SQL
    // editor with the period this function has just approved — never with a
    // number the caller invented.
    console.error(
      "Personal-data retention on this data plane is applied in SQL. See README.md.",
    );
    return 0;
  }

  const { forgetPersonalData } = await import("@/commerce/fixture/store");
  return forgetPersonalData(days);
}
