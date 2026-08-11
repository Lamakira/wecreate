import "server-only";

import { createClient, type SanityClient } from "next-sanity";

import { apiVersion, dataset, projectId, readToken } from "./env";
import type { ContentPerspective } from "@/managed-content/types";

/**
 * A Sanity client scoped to one content perspective.
 *
 * Published reads go through Sanity's CDN and need no credentials. Draft reads
 * bypass the CDN and require the server-only read token, which is how
 * unpublished content stays out of ordinary public requests: a request without
 * an authenticated preview session never constructs this client at all.
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
    useCdn: true,
    perspective: "published",
  });
}
