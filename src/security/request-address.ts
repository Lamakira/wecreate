import "server-only";

/**
 * Who is calling, as far as rate limits are concerned.
 *
 * Prefers `X-Real-IP`, which nginx sets to the address the connection actually
 * came from (`deploy/nginx/wecreate.conf`). `X-Forwarded-For` is the fallback
 * for a proxy that only sets that. Neither header is trusted on a process that
 * is reachable from the internet: production Node listens on loopback behind
 * nginx, which overwrites both before the request arrives.
 *
 * The acceptance suite talks to Node directly, so a scenario that needs its
 * own bucket sets `X-Real-IP` on the request. Everybody else shares `local`.
 */
export function requestAddress(headers: Headers): string {
  const realIp = headers.get("x-real-ip")?.trim();
  if (realIp) return realIp;

  const forwarded = headers.get("x-forwarded-for");
  if (forwarded) {
    const [first] = forwarded.split(",");
    const address = first?.trim();
    if (address) return address;
  }

  return "local";
}
