import { NextResponse } from "next/server";

import { openPurchasedFile } from "@/fulfillment";
import { siteUrl } from "@/site-config";

/**
 * Where *Télécharger* goes: a temporary private address, or back to the page
 * with a reason.
 *
 * **It is a `POST` because pressing it spends something.** A `GET` could be
 * prefetched by a browser, followed by a scanner or replayed out of history,
 * and each of those would spend one of a buyer's five downloads for them.
 *
 * **What authorises it is the cookie, not the form.** The buyer's token is
 * `SameSite=Lax` and `httpOnly`, which means a form on somebody else's site
 * cannot make this request carry it at all — a cross-site `POST` arrives with
 * no access and is answered with the same redirect a browser holding nothing
 * gets. The `Origin` check below is the second line rather than the first, and
 * is skipped when the header is absent because clients that are not browsers do
 * not send one.
 *
 * **The address it redirects to is never rendered.** It exists to be followed,
 * once, for a few minutes. Nothing prints it, nothing logs it, and it does not
 * come back through a page — see `openDownload` on the commerce boundary.
 *
 * Next.js matches this static segment before the sibling `[jeton]`, which is
 * what lets both live under `/commande/acces`; a token could not be this word
 * in any case, since one is forty-three characters of base64url.
 */

/** Back to the page, with or without something to say. */
function back(problem?: string): NextResponse {
  return new NextResponse(null, {
    status: 303,
    headers: {
      // Relative, so the browser resolves it against the address it dialled
      // rather than against a `Host` header somebody else chose.
      location: problem ? `/commande/acces?probleme=${problem}` : "/commande/acces",
      "cache-control": "no-store, must-revalidate",
    },
  });
}

export async function POST(request: Request): Promise<Response> {
  const origin = request.headers.get("origin");
  if (origin && origin !== siteUrl()) {
    return back();
  }

  const form = await request.formData();
  const sku = form.get("sku");
  if (typeof sku !== "string" || !sku) {
    return back();
  }

  const opened = await openPurchasedFile(sku);
  if (opened.status === "refused") {
    // The reason and nothing else — no token, no address, no order. Issue #1
    // asks for repeated token guessing and exhausted allowances to be
    // noticeable, and this is the line that makes them so.
    console.warn(`A download was refused: ${opened.reason}.`);
    // The same reason, in a word this application put there and this
    // application reads back. The page turns it into a French sentence; nothing
    // from the address bar is ever printed.
    return back(opened.reason);
  }

  return new NextResponse(null, {
    status: 303,
    headers: {
      location: opened.url,
      // A private address, for one browser, for a few minutes. Nothing between
      // here and the buyer may keep it.
      "cache-control": "no-store, must-revalidate",
    },
  });
}
