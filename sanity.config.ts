import { visionTool } from "@sanity/vision";
import { defineConfig } from "sanity";
import { presentationTool } from "sanity/presentation";
import { structureTool } from "sanity/structure";
import { muxInput } from "sanity-plugin-mux-input";

import { apiVersion, dataset, projectId } from "./src/sanity/env";
import { SINGLETON_TYPES, schemaTypes } from "./src/sanity/schema";
import { structure } from "./src/sanity/structure";
import { siteUrl } from "./src/site-config";

const singletonTypes: readonly string[] = SINGLETON_TYPES;

/**
 * The Studio Content Editors work in, mounted at `/studio` inside the
 * application itself. Same origin as the site, so the Presentation tool can
 * open a real preview of the real Next.js pages rather than an approximation.
 *
 * `projectId` falls back to a placeholder so a checkout with no Sanity project
 * still builds; the Studio route renders setup instructions instead of a
 * broken editor in that case.
 */
export default defineConfig({
  name: "wecreate",
  title: "WeCreate",
  basePath: "/studio",
  projectId: projectId || "unconfigured",
  dataset,

  schema: {
    types: schemaTypes,
    // Singletons are opened from the sidebar, never created from a template.
    templates: (templates) =>
      templates.filter(({ schemaType }) => !singletonTypes.includes(schemaType)),
  },

  document: {
    // Editors draft, publish and revert the two singletons. They cannot create
    // or delete them.
    actions: (actions, { schemaType }) =>
      singletonTypes.includes(schemaType)
        ? actions.filter(({ action }) =>
            ["publish", "discardChanges", "restore"].includes(action ?? ""),
          )
        : actions,
  },

  plugins: [
    structureTool({ structure }),
    // Video uploads go straight from the Studio to Mux, which transcodes them
    // and issues the playback identity (ADR-0007). An editor drops in a file;
    // they never see, type or manage a playback id.
    //
    // Nothing is stored above 1080p and no downloadable rendition is generated:
    // the website streams WeCreate's work, and the archival master stays off it.
    muxInput({ max_resolution_tier: "1080p", static_renditions: [] }),
    presentationTool({
      previewUrl: {
        origin: siteUrl(),
        preview: "/",
        previewMode: {
          enable: "/api/draft/enable",
          disable: "/api/draft/disable",
        },
      },
    }),
    visionTool({ defaultApiVersion: apiVersion }),
  ],
});
