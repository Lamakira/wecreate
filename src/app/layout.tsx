import type { ReactNode } from "react";

import { ClientErrorReporter } from "@/components/monitoring/client-reporter";

import "./globals.css";

/**
 * The document shell.
 *
 * Deliberately thin: it holds only what `/studio` and the public site share.
 * Everything visual — header, footer, grain, SEO — lives in the `(site)`
 * layout, so the Studio is not wrapped in the marketing chrome.
 *
 * The two font preloads are the latin subsets that carry French text. They are
 * fetched in parallel with the HTML instead of after the stylesheet resolves,
 * which is what keeps the hero's Largest Contentful Paint inside budget on a
 * mobile connection.
 */
export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="fr">
      <head>
        <link
          rel="preload"
          href="/fonts/inter-latin.woff2"
          as="font"
          type="font/woff2"
          crossOrigin="anonymous"
        />
        <link
          rel="preload"
          href="/fonts/playfair-display-latin.woff2"
          as="font"
          type="font/woff2"
          crossOrigin="anonymous"
        />
      </head>
      <body>
        <ClientErrorReporter />
        {children}
      </body>
    </html>
  );
}
