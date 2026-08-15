#!/usr/bin/env bash
# Decide who may reach the origin directly, and restore the visitor's real IP.
#
# Two jobs, one file, because they are the same list. With a CDN in front, every
# request nginx sees comes from Cloudflare: the peer address is an edge node, so
# `$remote_addr` is useless for logs and rate limiting until `real_ip` is told
# which peers are allowed to speak for someone else — and the origin should
# refuse anyone who is *not* on that list, or the CDN is a suggestion rather
# than a boundary.
#
#   ./refresh-cloudflare-ips.sh          # lock the origin to Cloudflare
#   ./refresh-cloudflare-ips.sh --off    # open it again (no CDN in front)
#
# Cloudflare's ranges change. This belongs in cron — see README.md, "Deploying".
#
# Run as root on the server.

set -euo pipefail
source "$(dirname -- "${BASH_SOURCE[0]}")/lib.sh"

readonly SNIPPET="/etc/nginx/snippets/${APP_USER}-origin.conf"
readonly V4_URL="https://www.cloudflare.com/ips-v4"
readonly V6_URL="https://www.cloudflare.com/ips-v6"

require_root
capture_neighbours

mkdir -p /etc/nginx/snippets

if [[ "${1:-}" == "--off" ]]; then
  step "Opening the origin to everyone (no CDN in front)"
  run_sh "cat > '${SNIPPET}' <<'EOF'
# Written by deploy/bin/refresh-cloudflare-ips.sh --off
#
# No CDN in front of this origin, so there is no list to refuse anyone against
# and no proxy whose word about the client address should be believed. The
# include in the vhost stays, so switching the lockdown on is one script run
# and one reload rather than an edit to the vhost.
allow all;
EOF"
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
total="$(printf '%s\n%s\n' "${v4}" "${v6}" | grep -c '/' || true)"
[[ "${total}" -ge 10 ]] || die "got ${total} ranges, expected at least 10 — refusing to write an allowlist that would lock the CDN out"
ok "${total} ranges"

step "Writing ${SNIPPET}"
{
  echo "# Written by deploy/bin/refresh-cloudflare-ips.sh — do not edit by hand."
  echo "# Cloudflare's ranges change; this file is regenerated on a schedule."
  echo
  echo "# Believe the CF-Connecting-IP header, but only from these peers."
  while read -r cidr; do [[ -n "${cidr}" ]] && echo "set_real_ip_from ${cidr};"; done <<<"${v4}"
  while read -r cidr; do [[ -n "${cidr}" ]] && echo "set_real_ip_from ${cidr};"; done <<<"${v6}"
  echo "real_ip_header CF-Connecting-IP;"
  echo "real_ip_recursive on;"
  echo
  echo "# And refuse anyone else. Traffic that did not come through the CDN"
  echo "# reaches nginx and stops here, which is what makes the cache in front"
  echo "# a boundary rather than a shortcut somebody can walk around."
  while read -r cidr; do [[ -n "${cidr}" ]] && echo "allow ${cidr};"; done <<<"${v4}"
  while read -r cidr; do [[ -n "${cidr}" ]] && echo "allow ${cidr};"; done <<<"${v6}"
  echo "# The deploy health check curls the origin from the machine itself."
  echo "allow 127.0.0.1;"
  echo "allow ::1;"
  echo "deny all;"
} > "${SNIPPET}.new"

run mv "${SNIPPET}.new" "${SNIPPET}"
nginx_reload
assert_neighbours_ok

step "Keeping it current"
[[ -x "${SERVER_DEPLOY_DIR}/bin/refresh-cloudflare-ips.sh" ]] || \
  warn "${SERVER_DEPLOY_DIR} does not hold a copy of these scripts — the cron entry below will not run until provision.sh has put one there"
# An allowlist that is not refreshed becomes an outage the day Cloudflare adds
# a range. Weekly, at an hour nobody is deploying. The script is idempotent and
# reloads only when nginx accepts the result, so a failed fetch leaves the
# working list in place.
readonly CRON="/etc/cron.d/${APP_USER}-cloudflare-ips"
if [[ "${DRY_RUN}" == "1" ]]; then
  log "${DIM}  would write ${CRON}${OFF}"
else
  printf '%s\n' \
    "# Written by deploy/bin/refresh-cloudflare-ips.sh" \
    "SHELL=/bin/bash" \
    "PATH=/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin" \
    "17 4 * * 1 root ${SERVER_DEPLOY_DIR}/bin/refresh-cloudflare-ips.sh >/dev/null" \
    > "${CRON}"
  chmod 0644 "${CRON}"
  ok "wrote ${CRON} (weekly)"
fi

warn "the origin now refuses anything that is not Cloudflare or localhost."
warn "if DNS for ${SITE_HOST} is not proxied (orange cloud) yet, the site is now unreachable — run with --off to undo."
