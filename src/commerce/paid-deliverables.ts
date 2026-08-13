import type { AuditMetadata, PaidDeliverableVersion } from "./types";

/**
 * The rules a Paid Deliverable Version is created under.
 *
 * Pure functions over what an upload contains, like `digital-products.ts` is a
 * pure rule over content. Nothing here knows that Supabase exists, which is what
 * lets the fixture and the real adapter enforce exactly the same thing.
 */

/**
 * What WeCreate sells: a document, or an archive of them.
 *
 * The extension decides, and the browser's declared content type is not
 * consulted at all — it is supplied by the client and a Commerce Operator's
 * machine is not a trusted source for what a file is. A LUT pack is a `.zip` of
 * `.cube` files rather than a family of its own, because that is what a buyer
 * downloads.
 */
export const ALLOWED_DELIVERABLE_TYPES: Record<string, string> = {
  ".pdf": "application/pdf",
  ".epub": "application/epub+zip",
  ".zip": "application/zip",
};

/**
 * The largest file this back office accepts.
 *
 * An upload travels through the application rather than straight to storage, so
 * this is bounded by the request body a deployment will carry — see
 * `serverActions.bodySizeLimit` in `next.config.ts`, and the note in the README
 * about what has to change before a larger deliverable can be uploaded on a
 * platform with its own body limit.
 */
export const MAX_DELIVERABLE_BYTES = 25 * 1024 * 1024;

/**
 * A product reference that may be part of an address.
 *
 * WeCreate writes its own SKUs — `EBK-01`, `LUT-03` — and the Studio refuses to
 * change or duplicate one. What it cannot guarantee is that a reference typed
 * years ago is safe to use as part of a storage address, and this is where the
 * bytes' address is derived from it, so the shape is checked here too. A `/` or
 * a `..` in a SKU would otherwise decide where a private file is written.
 */
const SAFE_PRODUCT_REFERENCE = /^[A-Za-z0-9][A-Za-z0-9._-]*$/;

export function isSafeProductReference(sku: string): boolean {
  return SAFE_PRODUCT_REFERENCE.test(sku) && !sku.includes("..");
}

/** Why an upload was not turned into a Paid Deliverable Version. */
export type UploadRefusal =
  | "unknownProduct"
  | "unsafeProductReference"
  | "emptyFile"
  | "fileTooLarge"
  | "unsupportedType"
  | "alreadyStored";

/** French wording for each refusal, shown to the Commerce Operator who tried. */
export const UPLOAD_REFUSAL_LABELS: Record<UploadRefusal, string> = {
  unknownProduct: "Choisissez un produit avant de téléverser un fichier.",
  unsafeProductReference:
    "La référence de ce produit ne peut pas identifier un fichier. Corrigez-la dans le Studio : lettres, chiffres, point, tiret et tiret bas seulement.",
  emptyFile: "Ce fichier est vide.",
  fileTooLarge: `Ce fichier dépasse ${MAX_DELIVERABLE_BYTES / (1024 * 1024)} Mo.`,
  unsupportedType: `Format non accepté. Formats acceptés : ${Object.keys(
    ALLOWED_DELIVERABLE_TYPES,
  ).join(", ")}.`,
  alreadyStored:
    "Ce fichier est déjà stocké. Un remplacement doit être un fichier différent, et devient une nouvelle version.",
};

/** The file's extension, lowercased, or `""` when it has none. */
export function fileExtension(fileName: string): string {
  const dot = fileName.lastIndexOf(".");
  return dot === -1 ? "" : fileName.slice(dot).toLowerCase();
}

/**
 * What this file is, decided by its extension rather than by what the browser
 * claimed. `undefined` means WeCreate does not deliver files of this kind.
 */
export function deliverableContentType(fileName: string): string | undefined {
  return ALLOWED_DELIVERABLE_TYPES[fileExtension(fileName)];
}

/** An upload as it arrives, before anything has been stored. */
export interface DeliverableUpload {
  sku: string;
  fileName: string;
  byteSize: number;
}

/**
 * Why this upload may not become a version, or `undefined` if it may.
 *
 * `alreadyStored` is not decided here: it is what storage answers when the
 * bytes are already there, and only storage can know that.
 */
export function uploadRefusal(
  upload: DeliverableUpload,
  knownSkus: readonly string[],
): UploadRefusal | undefined {
  if (!upload.sku || !knownSkus.includes(upload.sku)) return "unknownProduct";
  if (!isSafeProductReference(upload.sku)) return "unsafeProductReference";
  if (upload.byteSize <= 0) return "emptyFile";
  if (upload.byteSize > MAX_DELIVERABLE_BYTES) return "fileTooLarge";
  if (!deliverableContentType(upload.fileName)) return "unsupportedType";
  return undefined;
}

/**
 * Where the bytes are kept, derived from the product and the file's own
 * checksum.
 *
 * Content-addressed on purpose: an object's name is what is inside it, so
 * storing a version can only ever write bytes that are not already there.
 * Uploading the same file again resolves to the same address, the store refuses
 * to write over it, and the operator is told it is already a version — which is
 * how "a replacement is a new version, never an overwrite" is enforced by the
 * shape of the thing rather than by remembering to check.
 */
export function deliverableObjectPath(
  sku: string,
  checksum: string,
  fileName: string,
): string {
  return `${sku}/${checksum}${fileExtension(fileName)}`;
}

/** The number the next version for this SKU takes. */
export function nextVersionNumber(
  existing: readonly PaidDeliverableVersion[],
): number {
  return existing.reduce((highest, one) => Math.max(highest, one.version), 0) + 1;
}

/** The safe half of a version: what it is, never where it is kept. */
export function auditMetadata(
  version: PaidDeliverableVersion | undefined | null,
): AuditMetadata | null {
  if (!version) return null;
  return {
    version: version.version,
    fileName: version.fileName,
    checksum: version.checksum,
  };
}

/** Enough of a checksum to recognise a file by, without a wall of hexadecimal. */
export function shortChecksum(checksum: string): string {
  return checksum.slice(0, 12);
}
