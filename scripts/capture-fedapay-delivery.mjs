/**
 * Capture one FedaPay webhook delivery, exactly as it arrived.
 *
 *     pnpm capture:fedapay [outfile] [port]
 *
 * The provider-contract suite is the only thing in this repository that can
 * prove the FedaPay adapter reads a real signature and a real event — see
 * `tests/contract/fedapay.spec.ts`. It cannot provoke a webhook itself, because
 * a webhook goes to a public address. So it runs against a delivery captured
 * here, and this is the tool that captures one. `README.md`, *Setting up
 * FedaPay*, has the whole procedure: expose this with a tunnel, point a FedaPay
 * sandbox endpoint at it, and make a sandbox payment.
 *
 * **The body is written as the bytes that arrived and is never parsed on the
 * way.** A signature is over bytes: a body that has been through `JSON.parse`
 * and back — or copied out of a dashboard that pretty-printed it — is a
 * different body, and a capture of it would fail to verify no matter how
 * correct the adapter is. That is the whole reason this file exists rather than
 * an instruction to copy and paste.
 *
 * **Sandbox only.** A live delivery carries a real buyer's contact details, and
 * this writes them to disk in the clear. The contract suite refuses to run
 * against the live API for the same reason.
 *
 * Written in plain Node with no dependencies and no build step, because it is
 * run by a person once, on a laptop, at the moment a FedaPay endpoint is being
 * set up. It is not part of the application and nothing in `src/` imports it.
 */

import { createServer } from "node:http";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

/**
 * `/.wecreate/` is gitignored, so a capture cannot be committed by accident.
 * Keep it there: the file holds a valid signature and a buyer's details.
 */
const OUT = path.resolve(process.argv[2] ?? ".wecreate/fedapay-delivery.json");
const PORT = Number(process.argv[3] ?? 4488);

const server = createServer((request, response) => {
  const chunks = [];
  request.on("data", (chunk) => chunks.push(chunk));
  request.on("end", async () => {
    const body = Buffer.concat(chunks).toString("utf8");
    const signature = request.headers["x-fedapay-signature"] ?? "";

    // Answered first, so FedaPay records the delivery as accepted and does not
    // redeliver while the file is still being written.
    response.writeHead(200, { "content-type": "application/json" });
    response.end('{"received":true}');

    if (request.method !== "POST") return;

    if (!signature) {
      console.warn(
        `A POST arrived with no X-FEDAPAY-SIGNATURE (${body.length} bytes). Nothing written.`,
      );
      return;
    }

    await mkdir(path.dirname(OUT), { recursive: true });
    await writeFile(
      OUT,
      `${JSON.stringify({ signature, body }, null, 2)}\n`,
      "utf8",
    );

    // Read only to name the event in this line. The capture above is already
    // written, and is unaffected by whatever this finds.
    let name = "an unreadable event";
    try {
      name = JSON.parse(body).name ?? "an event with no name";
    } catch {
      // Left as it is.
    }

    console.log(`Captured ${name} (${body.length} bytes) → ${OUT}`);
    console.log(`  X-FEDAPAY-SIGNATURE: ${signature}`);
    console.log(
      "  Point FEDAPAY_WEBHOOK_DELIVERY at that file and run pnpm test:contract.",
    );
  });
});

server.listen(PORT, () => {
  console.log(`Listening on http://127.0.0.1:${PORT}. Expose it with a tunnel.`);
  console.log(`Writing to ${OUT}. Every delivery overwrites the last.`);
  console.log("Sandbox only. Stop with Ctrl-C once you have the event you want.");
});
