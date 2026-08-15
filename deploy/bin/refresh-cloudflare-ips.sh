#!/usr/bin/env bash
# Decide who may reach the origin directly, and restore the visitor's real IP.
#
# Two jobs, and getting them to coexist is the whole difficulty. With a CDN in
# front, every request nginx sees comes from an edge node: the peer address is
# Cloudflare's, so `$remote_addr` is useless for logs and rate limiting until
# `real_ip` is told which peers may speak for someone else — and the origin
# should refuse anyone who is *not* one of those peers, or the CDN is a
# suggestion rather than a boundary.
#
# **Why this is not `allow`/`deny`.** The obvious spelling — `set_real_ip_from`
# plus `allow <cloudflare ranges>; deny all;` — is silently backwards. nginx's
# realip module runs at POST_READ, before the access module, so by the time
# `allow`/`deny` is evaluated `$remote_addr` has already been *replaced* by the
# CF-Connecting-IP header. The allowlist then compares Cloudflare's ranges
# against the visitor's own address and refuses every genuine request, while a
# forged CF-Connecting-IP inside a Cloudflare range is let through. Measured,
# not theorised: real visitor 403, forged header 200.
#
# So the decision is made against `$realip_remote_addr`, which is the address
# the connection actually came from — what realip saw before it rewrote
# anything. That needs a `geo` block, which is an http-level directive, so it
# goes in its own file under conf.d rather than as an edit to nginx.conf.
#
#   ./refresh-cloudflare-ips.sh          # lock the origin to Cloudflare
#   ./refresh-cloudflare-ips.sh --off    # open it again (no CDN in front)
#
# Cloudflare's ranges change; this installs a weekly cron to re-fetch them.
#
# Run as root on the server.

set -euo pipefail
source "$(dirname -- "${BASH_SOURCE[0]}")/lib.sh"

readonly SNIPPET="/etc/nginx/snippets/${APP_USER}-origin.conf"
readonly GEO="/etc/nginx/conf.d/${APP_USER}-cdn.conf"
readonly CRON="/etc/cron.d/${APP_USER}-cloudflare-ips"
readonly V4_URL="https://www.cloudflare.com/ips-v4"
readonly V6_URL="https://www.cloudflare.com/ips-v6"

require_root
capture_neighbours

# Write a file through the dry-run gate, so that `DRY_RUN=1` really does leave
# the filesystem alone — including the temporary it would otherwise have used.
# Reads its content on stdin.
install_file() {
  local dest="$1" body
  body="$(cat)"
  if [[ "${DRY_RUN}" == "1" ]]; then
    log "${DIM}  would write ${dest}:${OFF}"
    sed 's/^/    | /' <<<"${body}" >&2
    return 0
  fi
  local tmp; tmp="$(mktemp)"
  printf '%s\n' "${body}" > "${tmp}"
  install -m 0644 -o root -g root "${tmp}" "${dest}"
  rm -f "${tmp}"
  ok "wrote ${dest}"
}

run install -d -m 0755 -o root -g root /etc/nginx/snippets
run install -d -m 0755 -o root -g root /etc/nginx/conf.d

if [[ "${1:-}" == "--off" ]]; then
  step "Opening the origin to everyone (no CDN in front)"
  install_file "${SNIPPET}" <<EOF
# Written by deploy/bin/refresh-cloudflare-ips.sh --off
#
# No CDN in front of this origin, so there is no list to refuse anyone against
# and no proxy whose word about the client address should be believed. The
# include in the vhost stays, so switching the lockdown on is one script run
# and one reload rather than an edit to a live vhost.
EOF
  # Removed rather than neutered: the vhost only references \$${APP_USER}_from_cdn
  # while the lockdown is on, so leaving a stale geo block behind would be one
  # more thing to explain to whoever reads this configuration next.
  [[ -f "${GEO}" ]] && run rm -f "${GEO}"
  [[ -f "${CRON}" ]] && run rm -f "${CRON}"
  nginx_reload
  assert_neighbours_ok
  ok "origin open — the CDN criterion of issue #42 is not met in this state"
  exit 0
fi

step "Fetching Cloudflare's published ranges"
v4="$(curl -fsS --max-time 20 "${V4_URL}")" || die "could not fetch ${V4_URL}"
v6="$(curl -fsS --max-time 20 "${V6_URL}")" || die "could not fetch ${V6_URL}"

# A truncated or error-page response would otherwise be written out as a very
# short allowlist, which locks the site away from its own CDN. Cloudflare
# publishes roughly fifteen v4 ranges and half a dozen v6; anything under ten
# lines total is not that list.
ranges="$(printf '%s\n%s\n' "${v4}" "${v6}" | grep '/' || true)"
total="$(grep -c '/' <<<"${ranges}" || true)"
[[ "${total}" -ge 10 ]] || die "got ${total} ranges, expected at least 10 — refusing to write an allowlist that would lock the CDN out"
ok "${total} ranges"

step "Writing ${GEO}"
# `geo` is http-level, so this is a new file in conf.d rather than an edit to
# nginx.conf. Keyed on $realip_remote_addr — the peer nginx actually accepted
# the connection from — which is the whole point of this file existing.
#
# The two loopback entries are for the deploy health check, which curls the
# origin from the machine itself.
{
  echo "# Written by deploy/bin/refresh-cloudflare-ips.sh — do not edit by hand."
  echo "# Cloudflare's ranges change; this file is regenerated weekly."
  echo "#"
  echo "# 1 when the connection came from the CDN (or from this machine), 0"
  echo "# otherwise. Keyed on \$realip_remote_addr rather than \$remote_addr:"
  echo "# real_ip has already overwritten the latter with the CF-Connecting-IP"
  echo "# header by the time anything reads it, so testing that would compare"
  echo "# Cloudflare's ranges against the visitor's own address and refuse"
  echo "# every genuine request."
  echo "geo \$realip_remote_addr \$${APP_USER}_from_cdn {"
  echo "    default 0;"
  echo "    127.0.0.1 1;"
  echo "    ::1 1;"
  while read -r cidr; do [[ -n "${cidr}" ]] && echo "    ${cidr} 1;"; done <<<"${ranges}"
  echo "}"
} | install_file "${GEO}"

step "Writing ${SNIPPET}"
{
  echo "# Written by deploy/bin/refresh-cloudflare-ips.sh — do not edit by hand."
  echo
  echo "# Believe the CF-Connecting-IP header, but only from these peers."
  while read -r cidr; do [[ -n "${cidr}" ]] && echo "set_real_ip_from ${cidr};"; done <<<"${ranges}"
  echo "real_ip_header CF-Connecting-IP;"
  echo "real_ip_recursive on;"
  echo
  echo "# And refuse anyone else. Traffic that did not come through the CDN"
  echo "# reaches nginx and stops here, which is what makes the cache in front"
  echo "# a boundary rather than a shortcut somebody can walk around."
  echo "#"
  echo "# \`if\` in a server block is usually a mistake; \`return\` is one of the"
  echo "# two things it is documented as safe for."
  echo "if (\$${APP_USER}_from_cdn = 0) {"
  echo "    return 403;"
  echo "}"
} | install_file "${SNIPPET}"

nginx_reload
assert_neighbours_ok

step "Keeping it current"
[[ -x "${SERVER_DEPLOY_DIR}/bin/refresh-cloudflare-ips.sh" ]] || \
  warn "${SERVER_DEPLOY_DIR} does not hold a copy of these scripts — the cron entry below will not run until provision.sh has put one there"
# An allowlist that is not refreshed becomes an outage the day Cloudflare adds
# a range. Weekly, at an hour nobody is deploying. The script is idempotent and
# reloads only when nginx accepts the result, so a failed fetch leaves the
# working list in place.
install_file "${CRON}" <<EOF
# Written by deploy/bin/refresh-cloudflare-ips.sh
SHELL=/bin/bash
PATH=/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin
17 4 * * 1 root ${SERVER_DEPLOY_DIR}/bin/refresh-cloudflare-ips.sh >/dev/null
EOF

warn "the origin now refuses anything that did not arrive through Cloudflare."
warn "if DNS for ${SITE_HOST} is not proxied (orange cloud) yet, the site is now unreachable — run with --off to undo."
