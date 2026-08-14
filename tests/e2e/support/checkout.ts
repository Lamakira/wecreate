import { expect, type Page } from "@playwright/test";

/**
 * Guest checkout, driven the way a buyer drives it.
 *
 * Two things here are stand-ins for something outside the application, and both
 * sit at the same outbound boundary the rest of the suite fakes at.
 *
 * `FEDAPAY_HOSTED_ORIGIN` is where the fixture payment provider sends a buyer.
 * It is not a real address and nothing resolves it: `interceptHostedPayment()`
 * answers it in the browser, so a scenario can follow the redirect and read what
 * WeCreate asked the provider for without a request ever leaving the machine.
 *
 * `PROVIDER_FAILURE_EMAIL` is the fixture's documented way to be unreachable —
 * the same trick a real payment sandbox plays with a card number that always
 * declines. It is spelled out here rather than imported so that changing how the
 * fixture fails has to be a deliberate change to this file too.
 */

/** Where the fixture payment provider hosts its page. Never resolved. */
export const FEDAPAY_HOSTED_ORIGIN = "https://hosted.fedapay.test";

/** A buyer whose payment page the provider will not open. */
export const PROVIDER_FAILURE_EMAIL = "panne-fedapay@exemple.test";

/** What a valid guest types into the form. */
export interface GuestInput {
  fullName?: string;
  email?: string;
  telephone?: string;
  company?: string;
  /** Whether to tick every legal acceptance. */
  acceptLegal?: boolean;
}

/**
 * Answer the provider's hosted page in this browser.
 *
 * The buyer really does leave WeCreate — the redirect is the behaviour under
 * test — and lands on a page this fake serves, which prints the address it was
 * reached at so a scenario can assert what WeCreate handed the provider.
 */
export async function interceptHostedPayment(page: Page): Promise<void> {
  await page.route(`${FEDAPAY_HOSTED_ORIGIN}/**`, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "text/html; charset=utf-8",
      body: '<!doctype html><html lang="fr"><body><h1>Page de paiement</h1></body></html>',
    });
  });
}

/** Fill the guest form. Anything not named is left as the caller found it. */
export async function fillGuestDetails(
  page: Page,
  input: GuestInput = {},
): Promise<void> {
  const {
    fullName = "Armand Kpodjedo",
    email = "armand@exemple.test",
    telephone = "+229 01 97 80 80 80",
    company,
    acceptLegal = true,
  } = input;

  await page.getByLabel("Nom complet").fill(fullName);
  await page.getByLabel("Email de livraison").fill(email);
  await page.getByLabel("Téléphone international").fill(telephone);
  if (company !== undefined) {
    await page.getByLabel(/Entreprise/).fill(company);
  }

  if (acceptLegal) {
    const acceptances = page.getByTestId("legal-acceptance");
    for (const box of await acceptances.all()) {
      await box.check();
    }
  }
}

/**
 * Press a checkout control and wait for the server to have answered.
 *
 * Every one of them is a form submission and the next step of a scenario is
 * usually another, so without this a test navigates away while the previous
 * submission is in flight and cancels it.
 */
async function press(page: Page, testId: string): Promise<void> {
  const answered = page.waitForResponse(
    (response) =>
      response.request().method() === "POST" &&
      new URL(response.url()).pathname.startsWith("/commande"),
  );
  await page.getByTestId(testId).click();
  await answered;
}

/** Press *Continuer vers FedaPay*. */
export async function submitCheckout(page: Page): Promise<void> {
  await press(page, "checkout-submit");
}

/** The order reference the black ticket is printing. */
export async function ticketReference(page: Page): Promise<string> {
  return (await page.getByTestId("ticket-reference").innerText()).trim();
}

/** Everything the browser was served while loading this page. */
export function collectResponseBodies(page: Page): { bodies: string[] } {
  const collected = { bodies: [] as string[] };

  page.on("response", (response) => {
    const type = response.headers()["content-type"] ?? "";
    if (!/javascript|html|json/.test(type)) return;
    response
      .text()
      .then((body) => collected.bodies.push(body))
      .catch(() => {
        // A response the browser cancelled has no body to read, and a scenario
        // asserting what was *not* sent is not weakened by one going missing.
      });
  });

  return collected;
}

/** Assert that a checkout surface is showing this heading. */
export async function expectHeading(page: Page, heading: string): Promise<void> {
  await expect(page.getByTestId("checkout-heading")).toHaveText(heading);
}
