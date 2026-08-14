import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";

import type { EmailProvider } from "../provider";
import { EmailProviderUnreachable, type TransactionalEmail } from "../types";

/**
 * A deterministic email provider: an outbox on disk, and nothing sent anywhere.
 *
 * This is the provider fake the acceptance suite runs the real application
 * against. The receipt is composed by the real fulfillment workflow, addressed
 * to the real buyer and carries the real Order Access token — only the carrier
 * is replaced, which is what lets a scenario read the message the way somebody
 * opening their mail reads it (through `/api/test/email`) and then follow the
 * address in it.
 *
 * File-backed for the reason the commerce fixture is: the test process and the
 * application server are two processes and have to be looking at the same
 * outbox.
 *
 * **It honours the idempotency key itself**, because Resend does. A second send
 * under a key already in the outbox is accepted and adds nothing — so a
 * webhook redelivery producing one receipt is a claim the suite can actually
 * hold, rather than one that happens to be true of the application's own
 * bookkeeping.
 */

/** A buyer whose receipt this provider refuses, whatever it says. */
export const UNREACHABLE_RECIPIENT = "panne-resend@exemple.test";

export interface SentEmail extends TransactionalEmail {
  sentAt: string;
}

function outboxPath(): string {
  return (
    process.env.WECREATE_EMAIL_FIXTURE_FILE ??
    path.join(process.cwd(), ".wecreate", "outbox.json")
  );
}

/*
 * `turbopackIgnore` for the reason the other fixtures use it: the bundler would
 * otherwise resolve this dynamic path by tracing the whole project into the
 * server bundle. Nothing here is part of a production deployment.
 */

export async function readOutbox(): Promise<SentEmail[]> {
  try {
    const raw = await readFile(/* turbopackIgnore: true */ outboxPath(), "utf8");
    return JSON.parse(raw) as SentEmail[];
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return [];
    }
    throw error;
  }
}

async function writeOutbox(messages: SentEmail[]): Promise<void> {
  const file = outboxPath();
  await mkdir(/* turbopackIgnore: true */ path.dirname(file), {
    recursive: true,
  });

  // Written to a sibling and renamed into place, so a reader sees one whole
  // outbox or the other.
  const temporary = `${file}.${process.pid}.tmp`;
  await writeFile(
    /* turbopackIgnore: true */ temporary,
    `${JSON.stringify(messages, null, 2)}\n`,
    "utf8",
  );
  await rename(/* turbopackIgnore: true */ temporary, file);
}

/** Empty the outbox. */
export async function resetOutbox(): Promise<void> {
  await writeOutbox([]);
}

export const fixtureEmailProvider: EmailProvider = {
  id: "fixture",

  async send(message: TransactionalEmail): Promise<void> {
    if (message.to.trim().toLowerCase() === UNREACHABLE_RECIPIENT) {
      throw new EmailProviderUnreachable("POST /emails answered 502");
    }

    const outbox = await readOutbox();
    if (outbox.some((sent) => sent.idempotencyKey === message.idempotencyKey)) {
      return;
    }

    await writeOutbox([
      ...outbox,
      { ...message, sentAt: new Date().toISOString() },
    ]);
  },
};
