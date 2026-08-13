import { request as httpRequest } from "node:http";

/**
 * One GET, with a `Host` header the caller chose.
 *
 * Playwright's own request client will not send a forged `Host` — it rewrites
 * the header to match the address it dialled, which is the sensible thing for a
 * browser-shaped client to do and useless for asking what this application does
 * when somebody lies to it. A poisoned `Host` is the whole of the question here,
 * so the request is made at the level where the header is still ours to set.
 *
 * Still black-box: this speaks HTTP to the running application and reads the
 * response, exactly as the rest of the suite does through a different client.
 */
export function getWithForgedHost(
  baseURL: string,
  path: string,
  forgedHost: string,
): Promise<{ status: number; location: string | undefined }> {
  const target = new URL(baseURL);

  return new Promise((resolve, reject) => {
    const call = httpRequest(
      {
        host: target.hostname,
        port: target.port,
        path,
        method: "GET",
        headers: { Host: forgedHost },
      },
      (response) => {
        // Drained rather than read: the status line and the `Location` are the
        // whole of what is being asked, and an unread response holds the socket
        // open.
        response.resume();
        resolve({
          status: response.statusCode ?? 0,
          location: response.headers.location,
        });
      },
    );

    call.on("error", reject);
    call.end();
  });
}
