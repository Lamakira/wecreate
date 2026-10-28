import { createCipheriv, hkdfSync, randomBytes } from "node:crypto";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { deflateSync } from "node:zlib";

import { expect, type APIRequestContext, type Page } from "@playwright/test";

import { TEST_QUESTIONNAIRE_SECRET } from "../../../playwright.config";

/**
 * The brand questionnaire as the acceptance suite meets it: a personal link
 * minted the way WeCreate's team will mint one, the messages it leaves in the
 * outbox, and the controls a client uses.
 *
 * **The token is built by hand, on purpose.** `mintInvitation` re-implements the
 * format documented at the top of `src/brand-questionnaire/invitation.ts`
 * with `node:crypto` and imports nothing from `src/`. A helper that called the
 * application's own sealing code would agree with whatever the application
 * does, including a mistake; spelled out here, a change to the token format has
 * to be a deliberate change to this file too (the same reason
 * `support/digital-cart.ts` spells out the cart cookie).
 */

// ---------------------------------------------------------------------------
// The personal link
// ---------------------------------------------------------------------------

export interface MintedInvitation {
  client: string;
  brand: string;
  pack: string;
  reference: string;
  expiresAt: Date;
}

/**
 * base64url( version · iv · ciphertext · tag )
 *
 * version 0x01 (also the AAD), iv 12 random bytes, AES-256-GCM over the JSON
 * payload { c, b, p, r, e } with `e` in whole seconds, tag 16 bytes, key
 * HKDF-SHA256(secret, salt "", info "wecreate brand questionnaire invitation v1").
 */
export function mintInvitation(
  invitation: MintedInvitation,
  secret: string = TEST_QUESTIONNAIRE_SECRET,
): string {
  const key = Buffer.from(
    hkdfSync(
      "sha256",
      secret,
      "",
      "wecreate brand questionnaire invitation v1",
      32,
    ),
  );
  const payload = JSON.stringify({
    c: invitation.client,
    b: invitation.brand,
    p: invitation.pack,
    r: invitation.reference,
    e: Math.floor(invitation.expiresAt.getTime() / 1000),
  });

  const version = Buffer.from([0x01]);
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  cipher.setAAD(version);
  const ciphertext = Buffer.concat([
    cipher.update(payload, "utf8"),
    cipher.final(),
  ]);

  return Buffer.concat([version, iv, ciphertext, cipher.getAuthTag()]).toString(
    "base64url",
  );
}

/** The address a client is sent. */
export function invitationPath(token: string): string {
  return `/questionnaire/${token}`;
}

const BASE64URL = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_";

/**
 * The same token with one character changed inside the ciphertext.
 *
 * Byte 0 is the version and 1-12 the iv, so character 24 (byte 18) is well
 * inside the encrypted payload. The result is still base64url of the same
 * length, so only authentication can refuse it.
 */
export function tamper(token: string): string {
  const index = 24;
  const original = token[index];
  const replacement = BASE64URL[(BASE64URL.indexOf(original) + 1) % 64];
  return `${token.slice(0, index)}${replacement}${token.slice(index + 1)}`;
}

const DAY_MS = 24 * 60 * 60 * 1000;

export const SAMPLE_INVITATION = {
  client: "Aïcha Dossou",
  brand: "Maison Kéré",
  pack: "Identité Complète",
  reference: "WC-Q48213",
} as const;

/** A link valid for ten more days. */
export function sampleInvitation(
  overrides: Partial<MintedInvitation> = {},
): MintedInvitation {
  return {
    ...SAMPLE_INVITATION,
    expiresAt: new Date(Date.now() + 10 * DAY_MS),
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// The outbox
// ---------------------------------------------------------------------------

export interface QuestionnaireAttachment {
  filename: string;
  contentType: string;
  /** base64 */
  content: string;
}

export interface QuestionnaireMessage {
  to: string;
  subject: string;
  body: string;
  html: string;
  idempotencyKey: string;
  replyTo?: string;
  attachments?: QuestionnaireAttachment[];
}

/** Everything the fixture email provider has been asked to send, oldest first. */
export async function questionnaireMessages(
  request: APIRequestContext,
): Promise<QuestionnaireMessage[]> {
  const response = await request.get("/api/test/email");
  expect(response.ok(), "the email test hook answers").toBeTruthy();
  return ((await response.json()) as { messages: QuestionnaireMessage[] })
    .messages;
}

export const TEAM_ADDRESS = "wecreate08@gmail.com";
export const CLIENT_EMAIL = "aicha@exemple.test";

// ---------------------------------------------------------------------------
// Storage
// ---------------------------------------------------------------------------

const ACCEPTANCE_DIRECTORY = path.join(process.cwd(), ".wecreate", "acceptance");

/** The files the questionnaire has no business touching, as text or "absent". */
export interface StorageSnapshot {
  commerce: string | "absent";
  content: string | "absent";
  /** File names in the acceptance directory, outbox files and temp files left out. */
  files: string[];
}

async function textOrAbsent(file: string): Promise<string> {
  try {
    return await readFile(file, "utf8");
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return "absent";
    throw error;
  }
}

/**
 * What the fixture commerce data plane and content store hold right now.
 *
 * Reads the stores directly for the reason `support/order-access.ts` does: that
 * nothing about the client is written anywhere is a durable outcome no page can
 * show, and asking the application would be asking the code whose storage is in
 * question. The outbox files are excluded because the email provider is the one
 * place the answers are meant to go.
 */
export async function storageSnapshot(): Promise<StorageSnapshot> {
  let names: string[] = [];
  try {
    names = await readdir(ACCEPTANCE_DIRECTORY);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
  }
  return {
    commerce: await textOrAbsent(
      process.env.WECREATE_COMMERCE_FIXTURE_FILE ??
        path.join(ACCEPTANCE_DIRECTORY, "commerce.json"),
    ),
    content: await textOrAbsent(
      process.env.WECREATE_FIXTURE_FILE ??
        path.join(ACCEPTANCE_DIRECTORY, "content.json"),
    ),
    files: names
      .filter(
        (name) =>
          name !== "outbox.json" &&
          name !== "outbox.json.outage.json" &&
          !name.endsWith(".tmp"),
      )
      .sort(),
  };
}

// ---------------------------------------------------------------------------
// Files to attach
// ---------------------------------------------------------------------------

const CRC_TABLE = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});

function crc32(bytes: Buffer): number {
  let c = 0xffffffff;
  for (const byte of bytes) c = CRC_TABLE[(c ^ byte) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type: string, data: Buffer): Buffer {
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, "ascii"), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([length, body, crc]);
}

/**
 * A valid one-pixel PNG of (at least) `sizeBytes`, made unique by `seed`.
 *
 * The padding is a text chunk, which every decoder skips, so the file is a real
 * image of exactly the size asked for (never below the ~70 bytes a PNG needs).
 * Two seeds give two different files, which is what lets a scenario prove the
 * bytes that arrive are the bytes that were chosen.
 */
export function pngBytes(sizeBytes = 200, seed = "a"): Buffer {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(1, 0);
  ihdr.writeUInt32BE(1, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 2; // truecolour
  const idat = deflateSync(Buffer.from([0, 200, 160, 40])) // filter byte + one RGB pixel;
  const signature = Buffer.from("89504e470d0a1a0a", "hex");
  const fixed = Buffer.concat([
    signature,
    chunk("IHDR", ihdr),
    chunk("IDAT", idat),
    chunk("IEND", Buffer.alloc(0)),
  ]);
  // A text chunk costs 12 bytes of framing plus "Comment\0".
  const overhead = 12 + 8;
  const padding = Math.max(0, sizeBytes - fixed.length - overhead);
  const text = chunk(
    "tEXt",
    Buffer.concat([
      Buffer.from("Comment\0", "latin1"),
      Buffer.from(seed.repeat(Math.ceil(padding / seed.length) || 1).slice(0, padding), "latin1"),
    ]),
  );
  // tEXt goes before IDAT so the file stays well-formed.
  const head = fixed.subarray(0, 8 + 25);
  const tail = fixed.subarray(8 + 25);
  return Buffer.concat([head, text, tail]);
}

/** A Playwright `setInputFiles` payload. */
export function pngFile(name: string, sizeBytes = 200, seed = name) {
  return { name, mimeType: "image/png", buffer: pngBytes(sizeBytes, seed) };
}

// ---------------------------------------------------------------------------
// Controls
// ---------------------------------------------------------------------------

export const ATTACHMENT_LABEL = /^Inspirations/;

/** Arrive by the personal link, the way a client does, and land on the form. */
export async function openQuestionnaire(page: Page, token: string): Promise<void> {
  await page.goto(invitationPath(token));
  await expect(page).toHaveURL(/\/questionnaire$/);
}

export function stepHeading(page: Page) {
  return page.getByTestId("questionnaire-step");
}

/** The step heading reads this and holds focus: what a screen reader announces. */
export async function expectStep(page: Page, n: number, label: string): Promise<void> {
  await expect(stepHeading(page)).toHaveText(`Étape ${n} sur 5 · ${label}`);
  await expect(stepHeading(page)).toBeFocused();
}

export async function next(page: Page): Promise<void> {
  await page.getByRole("button", { name: "Suivant" }).click();
}

export async function previous(page: Page): Promise<void> {
  await page.getByRole("button", { name: "Précédent" }).click();
}

export async function send(page: Page): Promise<void> {
  await page.getByRole("button", { name: "Envoyer le questionnaire" }).click();
}

export async function fillText(page: Page, label: string, value: string): Promise<void> {
  await page.getByLabel(label, { exact: true }).fill(value);
}

export function axisRadio(page: Page, axis: string, point: number) {
  return page
    .getByRole("group", { name: axis, exact: true })
    .getByRole("radio", { name: `${point} sur 5`, exact: true });
}

/** What the journey answers. Several tests assert these strings in the emails. */
export const ANSWERS = {
  sector: "Cosmétique naturelle",
  pitch: "Des soins au karité fabriqués à Calavi",
  story: "Fondée en 2021 par une famille de productrices de karité.",
  launch: "janvier 2027",
  audience: "Femmes actives de 25 à 40 ans",
  problem: "Trouver des soins naturels et fiables",
  price: "Premium",
  zones: ["Calavi", "Cotonou"],
  values: "exigence, proximité, élégance",
  never: "bon marché",
  axis: { name: "Classique ou Moderne", point: 4 },
  admire: "Aesop, pour sa sobriété",
  colorsLike: "ocre, ivoire",
  colorsAvoid: "rose bonbon",
  logos: ["Monogramme", "Typographique"],
  competitors: "Une marque concurrente de Cotonou",
  supports: ["Packaging", "Site web"],
  notes: "Merci de prévoir une version sur fond sombre.",
} as const;

export interface JourneyOptions {
  /** Files to attach on step 4. */
  files?: ReturnType<typeof pngFile>[];
  /** Fill the email on step 5 (default true). */
  email?: string | false;
}

/**
 * Fill steps 1 to 4 with the journey's answers and stop on step 5, email filled.
 *
 * Starts on step 1 with the brand prefilled from the link, the state
 * `openQuestionnaire` leaves the page in.
 */
export async function fillUntilLastStep(
  page: Page,
  options: JourneyOptions = {},
): Promise<void> {
  await fillText(page, "Secteur d'activité", ANSWERS.sector);
  await fillText(page, "Ce que vous faites, en une phrase", ANSWERS.pitch);
  await fillText(page, "Histoire de la marque", ANSWERS.story);
  await fillText(page, "Date de lancement ou d'ouverture", ANSWERS.launch);
  await next(page);
  await expectStep(page, 2, "Cible");

  await fillText(page, "À qui vendez-vous ?", ANSWERS.audience);
  await fillText(page, "Quel problème résolvez-vous pour eux ?", ANSWERS.problem);
  await page.getByRole("radio", { name: ANSWERS.price, exact: true }).check();
  for (const zone of ANSWERS.zones) {
    await page.getByRole("checkbox", { name: zone, exact: true }).check();
  }
  await next(page);
  await expectStep(page, 3, "Personnalité");

  await fillText(page, "Vos 3 valeurs principales", ANSWERS.values);
  await fillText(page, "Ce que votre marque ne doit jamais être", ANSWERS.never);
  await axisRadio(page, ANSWERS.axis.name, ANSWERS.axis.point).check();
  await next(page);
  await expectStep(page, 4, "Goûts visuels");

  await fillText(page, "Marques que vous admirez, et pourquoi", ANSWERS.admire);
  await fillText(page, "Couleurs souhaitées", ANSWERS.colorsLike);
  await fillText(page, "Couleurs à éviter", ANSWERS.colorsAvoid);
  for (const logo of ANSWERS.logos) {
    await page.getByRole("checkbox", { name: logo, exact: true }).check();
  }
  if (options.files?.length) {
    await page.getByLabel(ATTACHMENT_LABEL).setInputFiles(options.files);
    await expect(page.getByTestId("attachment-list").getByRole("listitem")).toHaveCount(
      options.files.length,
    );
  }
  await next(page);
  await expectStep(page, 5, "Supports");

  await fillText(page, "Vos principaux concurrents", ANSWERS.competitors);
  for (const support of ANSWERS.supports) {
    await page.getByRole("checkbox", { name: support, exact: true }).check();
  }
  await fillText(page, "Autre chose à nous dire ?", ANSWERS.notes);
  if (options.email !== false) {
    await fillText(page, "Votre email", options.email ?? CLIENT_EMAIL);
  }
}
