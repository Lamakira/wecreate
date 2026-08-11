import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",

    // The design handoff is a delivered reference artefact, not our source. It
    // is read for its decisions and recreated in `src/`; its generated
    // prototype runtime is never promoted into production.
    "docs/design_handoff_wecreate_site/**",

    // Playwright output.
    "test-results/**",
    "playwright-report/**",
  ]),
]);

export default eslintConfig;
