"use server";

import { createHash } from "node:crypto";

import { updateTag } from "next/cache";
import { redirect } from "next/navigation";

import { readBoutique } from "@/managed-content";

import type { CommerceMessageKey } from "./messages";
import { administersCommerce, mayEnrolSecondFactor } from "./operators";
import { deliverableContentType, uploadRefusal } from "./paid-deliverables";
import { getCommerceProvider, type CommerceProvider } from "./provider";
import {
  clearOperatorSession,
  clearPendingEnrolment,
  readOperatorCredentials,
  readPendingEnrolment,
  readSignedInOperator,
  writeOperatorCredentials,
  writePendingEnrolment,
} from "./session";
import { PAID_DELIVERABLES_TAG } from "./tag";
import type { CommerceOperator, OperatorCredentials } from "./types";

/**
 * Everything a Commerce Operator can do, as actions the browser posts to.
 *
 * Each one is an entry point in its own right — a form is not a security
 * boundary, and a page that refuses to render an upload control does not stop
 * anyone posting to this — so every action asks who is signed in and what they
 * may do before it touches anything. Postgres asks the same questions again
 * (`supabase/migrations/`); these checks exist so a refusal is a French
 * sentence rather than a stack trace.
 *
 * They redirect rather than return, and carry their outcome in the address, so
 * the back office works with scripting disabled like the rest of the site.
 */

function back(path: string, message?: CommerceMessageKey): never {
  redirect(message ? `${path}?message=${message}` : path);
}

/**
 * Where a request that may not do this is sent.
 *
 * A session that exists and is simply not allowed goes to the back office,
 * which explains why — that it needs a code, or that this account does not
 * administer commerce. Showing it the sign-in form would be a lie, and telling
 * it the session expired would be a different one. No session at all is the
 * only case where "sign in again" is the truth.
 */
function refuse(operator: CommerceOperator | undefined): never {
  if (operator) {
    redirect("/commerce");
  }
  back("/commerce/connexion", "sessionExpired");
}

interface Working {
  provider: CommerceProvider;
  credentials: OperatorCredentials;
  operator: CommerceOperator;
}

/**
 * Who is doing this, or nobody: the one gate every action passes through.
 *
 * `permitted` is what this action requires of them — administering commerce for
 * the deliverables, or being allowed to enrol a factor for the enrolment ones.
 * Written once because it is the check that must not be forgotten, and a check
 * repeated five times is a check that will eventually be repeated four.
 */
async function working(
  permitted: (operator: CommerceOperator | undefined) => boolean,
): Promise<Working> {
  const provider = await getCommerceProvider();
  const credentials = await readOperatorCredentials();
  const operator = await readSignedInOperator();

  if (!provider || !credentials || !operator || !permitted(operator)) {
    refuse(operator);
  }
  return { provider, credentials, operator };
}

/** Sign in with an individual staff account. Never enough on its own. */
export async function signInAction(formData: FormData): Promise<void> {
  const provider = await getCommerceProvider();
  if (!provider) back("/commerce/connexion", "signInRefused");

  const outcome = await provider.signIn(
    String(formData.get("email") ?? ""),
    String(formData.get("password") ?? ""),
  );
  if (outcome.status === "refused") {
    back("/commerce/connexion", "signInRefused");
  }

  await writeOperatorCredentials(outcome.credentials);
  back("/commerce/connexion");
}

/** Raise the session to assurance level 2 with a code from an enrolled factor. */
export async function verifySecondFactorAction(formData: FormData): Promise<void> {
  const provider = await getCommerceProvider();
  const credentials = await readOperatorCredentials();
  if (!provider || !credentials) back("/commerce/connexion", "sessionExpired");

  const outcome = await provider.verifySecondFactor(credentials, {
    factorId: String(formData.get("factorId") ?? ""),
    code: String(formData.get("code") ?? ""),
  });
  if (outcome.status === "refused") {
    back("/commerce/connexion", "codeRefused");
  }

  await writeOperatorCredentials(outcome.credentials);
  back("/commerce");
}

export async function signOutAction(): Promise<void> {
  const provider = await getCommerceProvider();
  const credentials = await readOperatorCredentials();
  if (provider && credentials) {
    await provider.signOut(credentials);
  }
  await clearOperatorSession();
  back("/commerce/connexion", "signedOut");
}

/**
 * Store an uploaded file as the next immutable Paid Deliverable Version.
 *
 * The checksum is computed here, from the bytes that arrived, rather than taken
 * from the browser: it is the file's identity, an Order Snapshot will reference
 * the version it names, and a value a client supplied is not evidence of what
 * was stored.
 *
 * A new version is never on sale by itself. Activating one is a separate,
 * deliberate action, so uploading a replacement cannot change what a customer
 * receives by accident.
 */
export async function uploadVersionAction(formData: FormData): Promise<void> {
  const { provider, credentials } = await working(administersCommerce);

  const sku = String(formData.get("sku") ?? "");
  const file = formData.get("file");
  const fileName = file instanceof File ? file.name : "";
  const byteSize = file instanceof File ? file.size : 0;

  // The published, unarchived catalogue. A draft product has no stable identity
  // yet, and a withdrawn one is owed nothing new — whoever bought it keeps the
  // version their Order Snapshot recorded, and no future purchase can be made.
  const { products } = await readBoutique();
  const refusal = uploadRefusal(
    { sku, fileName, byteSize },
    products.map((product) => product.sku),
  );
  if (refusal || !(file instanceof File)) {
    back("/commerce", refusal ?? "emptyFile");
  }

  const bytes = new Uint8Array(await file.arrayBuffer());
  const outcome = await provider.createPaidDeliverableVersion(credentials, {
    sku,
    fileName,
    // The extension decides what this file is. What the browser called it is
    // not consulted.
    contentType: deliverableContentType(fileName) ?? "application/octet-stream",
    bytes,
    checksum: createHash("sha256").update(bytes).digest("hex"),
  });

  back(
    "/commerce",
    outcome.status === "created" ? "versionCreated" : "alreadyStored",
  );
}

/**
 * Make one existing version the one future purchases receive.
 *
 * Nothing about any other version changes, including the one being replaced: a
 * past Order Snapshot keeps the version it recorded, and this is only a
 * decision about what is sold next. The cached answer the Boutique renders from
 * is expired here, which is what makes a product go on sale on the next request
 * rather than whenever a cache happened to turn over.
 */
export async function activateVersionAction(formData: FormData): Promise<void> {
  const { provider, credentials } = await working(administersCommerce);

  const outcome = await provider.activatePaidDeliverableVersion(credentials, {
    sku: String(formData.get("sku") ?? ""),
    versionId: String(formData.get("versionId") ?? ""),
  });
  if (outcome.status === "refused") {
    back("/commerce", "activationRefused");
  }

  updateTag(PAID_DELIVERABLES_TAG);
  back("/commerce", "versionActivated");
}

/**
 * Begin enrolling an authenticator — the first one, or the backup that keeps a
 * lost phone from locking WeCreate out of its own commerce data.
 */
export async function enrolFactorAction(formData: FormData): Promise<void> {
  const { provider, credentials } = await working(mayEnrolSecondFactor);

  const ticket = await provider.enrolSecondFactor(credentials, {
    label: String(formData.get("label") ?? ""),
  });
  await writePendingEnrolment({
    factorId: ticket.factorId,
    label: String(formData.get("label") ?? "").trim() || "Facteur de secours",
    secret: ticket.secret,
    uri: ticket.uri,
  });
  back("/commerce/securite");
}

/** Finish enrolment by proving the authenticator produces the right codes. */
export async function confirmFactorAction(formData: FormData): Promise<void> {
  // The enrolment this finishes was begun by someone allowed to begin it, and
  // the same person has to still be here to finish it.
  const { provider, credentials } = await working(mayEnrolSecondFactor);
  const pending = await readPendingEnrolment();
  if (!pending) {
    back("/commerce/securite");
  }

  const outcome = await provider.confirmSecondFactor(credentials, {
    factorId: pending.factorId,
    code: String(formData.get("code") ?? ""),
  });
  if (outcome.status === "refused") {
    back("/commerce/securite", "factorRefused");
  }

  await writeOperatorCredentials(outcome.credentials);
  await clearPendingEnrolment();
  back("/commerce/securite", "factorAdded");
}
