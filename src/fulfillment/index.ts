import "server-only";

import {
  DOWNLOADS_PER_GRANT,
  FULFILLMENT_STALL_SECONDS,
  ORDER_ACCESS_DAYS,
  PRIVATE_LINK_SECONDS,
} from "@/commerce/order-access";
import { getCommerceProvider } from "@/commerce/provider";
import type { OpenDownloadOutcome } from "@/commerce/provider";
import type { OrderAccess } from "@/commerce/types";
import { getEmailProvider } from "@/email/provider";
import { readSiteSettings } from "@/managed-content";
import { siteUrl } from "@/site-config";

import { composeReceipt } from "./receipt";
import { readAccessToken } from "./session";
import { accessTokenDigest, newAccessToken } from "./token";

/**
 * What an approved payment turns into.
 *
 * Fulfillment is the other half of an order and it moves on its own
 * (ADR-0005). Payment truth is settled by the time anything here runs, and
 * nothing here can move it back: the worst this module can do is record that a
 * delivery has to be taken up again, which is exactly what it does when the
 * receipt cannot be sent.
 *
 * **It happens once per approval, and the data plane decides that.**
 * `beginFulfillment` claims the order; a second caller — a redelivered webhook,
 * a retry, another process — is refused and does nothing. So the idempotency
 * that matters is not this module remembering what it has done, which would be
 * one process's opinion, but a claim two callers cannot both win.
 *
 * **A delivery that did not finish may be taken up, and this is where it is**
 * (ADR-0010). Nothing here decides that either: the same claim admits an order
 * whose delivery failed and one abandoned unfinished, and refuses one that is
 * running or already done. What that costs this module is one thing — the claim
 * it settles has to be named, because by the time a stalled request reports its
 * failure the delivery may belong to somebody else.
 *
 * **The order it does things in is the guarantee.** The grants are made first,
 * inside the claim, and the receipt is attempted after — so a buyer whose email
 * never went out still owns everything they paid for, and their page can say
 * so. The reverse would mean a message pointing at access that does not exist.
 */

/**
 * Deliver one approved order, as far as it can be delivered.
 *
 * Never throws. It runs inside the request a payment provider is waiting on,
 * and that request owes an acknowledgement for an event that was recorded —
 * a provider told "failed" redelivers forever, and redelivering will not fix a
 * mail outage. What a failure produces instead is a Fulfillment State saying so
 * and a line in the log naming the order.
 */
export async function deliverApprovedOrder(reference: string): Promise<void> {
  const commerce = await getCommerceProvider();
  if (!commerce) return;

  const token = newAccessToken();
  let claimed;
  try {
    claimed = await commerce.beginFulfillment({
      reference,
      // The token itself never leaves this function. What is stored is its
      // digest, and what is sent is the address carrying it.
      tokenDigest: accessTokenDigest(token),
      accessDays: ORDER_ACCESS_DAYS,
      downloadsAllowed: DOWNLOADS_PER_GRANT,
      stalledSeconds: FULFILLMENT_STALL_SECONDS,
    });
  } catch (error) {
    // Nothing was claimed, so nothing has to be unwound: the order is exactly
    // where it was, and the next delivery to reach it finds it that way.
    console.error(`Claiming order ${reference} for delivery failed.`, error);
    return;
  }

  if (claimed.status === "refused") {
    // Already delivered, being delivered right now, or never approved. All
    // three are somebody else's business and none of them is an error.
    return;
  }

  try {
    const email = await getEmailProvider();
    if (!email) {
      // No mail provider configured. The grants stand and the buyer has no way
      // to know about them, which is a failed delivery rather than a delivered
      // one — saying otherwise would be the one lie this slice avoids.
      throw new Error("this deployment has no email provider");
    }

    const settings = await readSiteSettings();
    await email.send(
      composeReceipt({
        order: claimed.order,
        access: claimed.access,
        deliverTo: claimed.deliverTo,
        accessUrl: `${siteUrl()}/commande/acces/${token}`,
        supportEmail: settings.contact.email,
      }),
    );
    if (!(await commerce.settleFulfillment(reference, "delivered", claimed.claimId))) {
      // The claim was taken up by somebody else while this delivery was
      // running, so the receipt that just went out is a second one. Nothing to
      // undo — the grants and the access are one order's, not one delivery's —
      // but it is the line that explains a buyer holding two messages.
      console.warn(
        `Order ${reference} was delivered under a claim that had already been taken up.`,
      );
    }
  } catch (error) {
    // Correlated by the order reference, which is not a secret and is what an
    // operator has in front of them. Never the address, never the token, never
    // the message (issue #1).
    console.error(`Delivering order ${reference} failed.`, error);
    // Named with this claim, so a delivery that took over from this one while
    // it was away is not the one marked failed.
    await commerce
      .settleFulfillment(reference, "failed", claimed.claimId)
      .catch((settling: unknown) => {
        console.error(
          `Recording the failed delivery of order ${reference} failed too.`,
          settling,
        );
      });
  }
}

/**
 * What the buyer holding this browser's token may still open, or nothing.
 *
 * An unreachable data plane answers "nothing", which the page reports as an
 * access it cannot open rather than as an error: a buyer is told to try again
 * and their allowance is untouched, because nothing was spent.
 */
export async function readAccessInProgress(): Promise<OrderAccess | undefined> {
  const token = await readAccessToken();
  if (!token) return undefined;

  const commerce = await getCommerceProvider();
  if (!commerce) return undefined;

  try {
    return await commerce.readOrderAccessByToken(accessTokenDigest(token));
  } catch (error) {
    // The token is not in the message: a log line is the last place a working
    // credential should be able to end up.
    console.error("Reading Order Access failed.", error);
    return undefined;
  }
}

/**
 * What one order's buyer may still open, for the paid checkout view.
 *
 * Reached with the order reference rather than the token, so it shows and never
 * opens — the address in the buyer's mail is what authorises a download.
 */
export async function readAccessForOrder(
  reference: string,
): Promise<OrderAccess | undefined> {
  const commerce = await getCommerceProvider();
  if (!commerce) return undefined;

  try {
    return await commerce.readOrderAccess(reference);
  } catch (error) {
    console.error(`Reading the access of order ${reference} failed.`, error);
    return undefined;
  }
}

/**
 * Hand this browser a temporary private address for one purchased file.
 *
 * Everything that decides whether it may have one is on the other side of the
 * commerce boundary, in a transaction — see `openDownload`. What is here is the
 * unreachable case, which answers `unavailable` rather than throwing: a store
 * that did not respond must cost the buyer nothing.
 */
export async function openPurchasedFile(
  sku: string,
): Promise<OpenDownloadOutcome> {
  const token = await readAccessToken();
  if (!token) {
    return { status: "refused", reason: "unknownAccess" };
  }

  const commerce = await getCommerceProvider();
  if (!commerce) {
    return { status: "refused", reason: "unavailable" };
  }

  try {
    return await commerce.openDownload({
      tokenDigest: accessTokenDigest(token),
      sku,
      linkSeconds: PRIVATE_LINK_SECONDS,
    });
  } catch (error) {
    console.error("Opening a purchased file failed.", error);
    return { status: "refused", reason: "unavailable" };
  }
}
