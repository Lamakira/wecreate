import { defineCliConfig } from "sanity/cli";

import { dataset, projectId } from "./src/sanity/env";

/**
 * Configuration for the `sanity` CLI (schema deploy, dataset management,
 * typegen). The Studio itself is served by Next.js at `/studio`, so there is no
 * separate Studio deployment to manage.
 */
export default defineCliConfig({
  api: { projectId, dataset },
});
