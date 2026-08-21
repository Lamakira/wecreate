import "server-only";

import { createClient, type SanityClient } from "next-sanity";

import { apiVersion, dataset, projectId, readToken } from "./env";
import type { ContentPerspective } from "@/managed-content/types";

/**
 * A Sanity client scoped to one content perspective.
 *
 * Draft reads bypass the CDN and require the server-only read token, which is
 * how unpublished content stays out of ordinary public requests: a request
 * without an authenticated preview session never constructs that client at all.
 *
 * Published reads keep the `published` perspective — they still cannot see
 * drafts. They carry the same token when it is set, because the anonymous API
 * on this project returns products and not the legal documents an editor has
 * published. Presentation sees those documents (it is authenticated). The
 * public site must too, or checkout stays blocked on placeholder terms.
 */
export function getSanityClient(perspective: ContentPerspective): SanityClient {
  if (perspective === "drafts") {
    if (!readToken) {
      throw new Error(
        "Previewing drafts requires SANITY_API_READ_TOKEN to be set.",
      );
    }
    return createClient({
      projectId,
      dataset,
      apiVersion,
      useCdn: false,
      perspective: "drafts",
      token: readToken,
    });
  }

  return createClient({
    projectId,
    dataset,
    apiVersion,
    useCdn: !readToken,
    perspective: "published",
    ...(readToken ? { token: readToken } : {}),
  });
}
