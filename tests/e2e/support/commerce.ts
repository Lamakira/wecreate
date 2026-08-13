import { expect, type APIRequestContext, type Locator, type Page } from "@playwright/test";

import {
  FIXTURE_STAFF,
  type FixtureStaffAccount,
  type FixtureStaffFactor,
} from "../../../src/commerce/fixture/staff";
import { totpCode } from "../../../src/commerce/fixture/totp";

/**
 * Commerce staff, and the things they do, expressed the way they would describe
 * them.
 *
 * Everything below goes through the running application: a real browser, the
 * real back office, the real forms. The only thing the suite reaches around is
 * returning the data plane to its seeded state between scenarios, which no
 * operator can do and no page offers.
 */

/** Administers commerce, with an authenticator already enrolled. */
export const COMMERCE_OPERATOR = FIXTURE_STAFF[0];
/** Reaches the same assurance and still may not see commerce data. */
export const CONTENT_EDITOR = FIXTURE_STAFF[1];
/** A Commerce Operator on their first day: a password and nothing else. */
export const NEW_OPERATOR = FIXTURE_STAFF[2];

export class CommerceDataPlane {
  constructor(private readonly request: APIRequestContext) {}

  /** Return the commerce data plane to its seeded state. */
  async reset(): Promise<void> {
    const response = await this.request.post("/api/test/commerce", {
      data: { action: "reset" },
    });
    if (response.status() === 404) {
      throw new Error(
        "The commerce test hook is not mounted. Playwright reuses an " +
          "already-running server outside CI, so this usually means a server " +
          "started by hand is holding the port. Stop it and re-run.",
      );
    }
    if (!response.ok()) {
      throw new Error(
        `Commerce test hook failed: ${response.status()} ${await response.text()}`,
      );
    }
  }
}

/** The code this staff member's authenticator is showing right now. */
export function code(factor: FixtureStaffFactor | string): string {
  return totpCode(typeof factor === "string" ? factor : factor.secret);
}

/**
 * A six-digit code this secret is certainly not producing.
 *
 * Derived rather than guessed: the three codes a real authenticator would be
 * accepted for are computed and avoided, so "wrong code refused" cannot pass by
 * coincidence.
 */
export function wrongCode(factor: FixtureStaffFactor): string {
  const now = Date.now();
  const accepted = new Set(
    [-1, 0, 1].map((drift) => totpCode(factor.secret, now + drift * 30_000)),
  );
  for (let candidate = 0; candidate < 1000; candidate += 1) {
    const written = String(candidate).padStart(6, "0");
    if (!accepted.has(written)) return written;
  }
  throw new Error("every candidate code was valid, which cannot happen");
}

/**
 * Press a control in the back office and wait for the server to have answered.
 *
 * Every action here is a form submission, and the next step of a scenario is
 * usually another one. Without this, a test navigates away while the previous
 * submission is still in flight and cancels it — which reads as the application
 * losing an upload rather than as the test racing itself.
 */
export async function press(page: Page, control: Locator): Promise<void> {
  const answered = page.waitForResponse(
    (response) =>
      response.request().method() === "POST" &&
      new URL(response.url()).pathname.startsWith("/commerce"),
  );
  await control.click();
  await answered;
}

/** Sign in with a password only. Assurance level 1: not enough for anything. */
export async function enterPassword(
  page: Page,
  staff: FixtureStaffAccount,
): Promise<void> {
  await page.goto("/commerce/connexion");
  await page.getByLabel("Adresse e-mail").fill(staff.email);
  await page.getByLabel("Mot de passe").fill(staff.password);
  await press(page, page.getByRole("button", { name: "Se connecter" }));
}

/** Sign in completely: a password, then a code from the staff member's phone. */
export async function signIn(
  page: Page,
  staff: FixtureStaffAccount,
  factor: FixtureStaffFactor = staff.factors[0],
): Promise<void> {
  await enterPassword(page, staff);
  await page.getByLabel("Code de vérification").fill(code(factor));
  await press(page, page.getByRole("button", { name: "Vérifier" }));
}

/** Upload a file as the next Paid Deliverable Version of a product. */
export async function uploadDeliverable(
  page: Page,
  input: { sku: string; fileName: string; contents: string; mimeType?: string },
): Promise<void> {
  await page.getByLabel("Produit").selectOption(input.sku);
  await page.getByLabel("Fichier").setInputFiles({
    name: input.fileName,
    mimeType: input.mimeType ?? "application/pdf",
    buffer: Buffer.from(input.contents, "utf8"),
  });
  await press(page, page.getByRole("button", { name: "Téléverser" }));
}

/** Put one version on sale, and wait until it is. */
export async function activateVersion(
  page: Page,
  sku: string,
  version: number,
): Promise<void> {
  const panel = deliverablePanel(page, sku);
  await press(
    page,
    panel.getByRole("button", { name: `Activer la version ${version}` }),
  );
}

/** One product's panel in the back office. */
export function deliverablePanel(page: Page, sku: string) {
  return page.locator(`[data-testid="deliverable"][data-sku="${sku}"]`);
}

/**
 * Put Digital Products on sale: a file for each, and the decision to sell that
 * version of it.
 *
 * The commerce half of "may WeCreate sell this?", performed the way a Commerce
 * Operator performs it — signing in, uploading, activating. The editorial half
 * is the caller's, through the Managed Content hook: a published product marked
 * *En vente*, under an approved licence.
 */
export async function putOnSale(
  page: Page,
  skus: readonly string[],
): Promise<void> {
  await signIn(page, COMMERCE_OPERATOR);

  for (const sku of skus) {
    await uploadDeliverable(page, {
      sku,
      fileName: `${sku.toLowerCase()}.zip`,
      contents: `fichier livré pour ${sku}`,
      mimeType: "application/zip",
    });
    await expect(deliverablePanel(page, sku).getByTestId("version")).toHaveCount(
      1,
    );

    await activateVersion(page, sku, 1);
    await expect(
      deliverablePanel(page, sku).getByTestId("active-version"),
    ).toHaveText("Version 1 en vente");
  }
}
