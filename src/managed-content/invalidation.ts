import { revalidateTag } from "next/cache";

import {
  ALL_MANAGED_CONTENT_TAGS,
  cacheTagsForDocumentType,
} from "./tag";

function expire(tags: readonly string[]): readonly string[] {
  for (const tag of tags) {
    revalidateTag(tag, { expire: 0 });
  }
  return tags;
}

/**
 * Drop every cached published slice.
 *
 * The operator bearer token, a dataset reset, and a webhook we cannot scope
 * all take this path.
 */
export function expireAllManagedContent(): readonly string[] {
  return expire(ALL_MANAGED_CONTENT_TAGS);
}

/**
 * Drop the cached slices a publish of this document type affects.
 *
 * `documentType` is the webhook's `_type`. Absent or unrecognised values
 * expire everything, same as {@link expireAllManagedContent}.
 */
export function expireManagedContent(
  documentType?: string | null,
): readonly string[] {
  return expire(cacheTagsForDocumentType(documentType));
}
