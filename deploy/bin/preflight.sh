#!/usr/bin/env bash
# Read-only. Answers "is this machine ready, and what does it look like right
# now" before anything changes it.
#
# It writes exactly one thing, and not to anywhere the running system reads
# from: a baseline snapshot under /var/log, so that after provisioning you can
# diff the nginx configuration the server is actually running against the one
# it was running before WeCreate arrived. That diff is the evidence for the
# acceptance criterion that says the two existing sites are not changed by the
# addition — stronger than a promise, because it is checkable by somebody who
# was not here.
#
# Run as root on the server. Changes nothing else. Exits non-zero on a finding
# that would make provisioning unsafe.

set -euo pipefail
source "$(dirname -- "${BASH_SOURCE[0]}")/lib.sh"

require_root

readonly BASELINE_DIR="/var/log/${APP_USER}-deploy"
readonly STAMP="$(date -u +%Y%m%dT%H%M%SZ)"
readonly BASELINE="${BASELINE_DIR}/baseline-${STAMP}.txt"

failures=0
fail() { warn "$*"; failures=$((failures + 1)); }

step "The machine"
log "  $(. /etc/os-release && echo "${PRETTY_NAME}")  $(uname -m)  $(nproc) cores  $(free -h | awk '/^Mem:/{print $2" ram, "$3" used"}')"
log "  disk: $(df -h / | awk 'NR==2{print $4" free of "$2}')"
free_gb="$(df -BG --output=avail / | tail -1 | tr -dc '0-9')"
[[ "${free_gb}" -ge 5 ]] || fail "only ${free_gb} GB free; ${KEEP_RELEASES} releases plus a build artifact want more headroom than that"

step "Node.js"
if ! command -v node >/dev/null; then
  fail "no node on PATH — the standalone bundle needs one, and installing it is a change to the shared runtime this ticket would rather not make"
else
  node_version="$(node -p 'process.versions.node')"
  node_major="${node_version%%.*}"
  node_minor="$(cut -d. -f2 <<<"${node_version}")"
  log "  v${node_version} at $(command -v node)"
  # Next.js 16 asks for >= 20.9.0. The point of checking rather than upgrading:
  # weact and askive build their front ends with esbuild and rollup, which ship
  # native binaries compiled against a Node version, so a system upgrade means
  # reinstalling and rebuilding both before their assets are swapped in. If the
  # version already here is enough, none of that has to happen.
  if [[ "${node_major}" -gt 20 || ( "${node_major}" -eq 20 && "${node_minor}" -ge 9 ) ]]; then
    ok "satisfies Next.js 16's >= 20.9.0 — no runtime change needed"
  else
    fail "v${node_version} is below Next.js 16's >= 20.9.0. Upgrading is possible but is not free here: rebuild weact and askive against the new version and verify both serve before swapping their assets in."
  fi
fi

step "The port"
if ss -ltn "sport = :${APP_PORT}" | grep -q LISTEN; then
  fail "something already listens on ${APP_PORT}: $(ss -ltnp "sport = :${APP_PORT}" | tail -n +2)"
else
  ok "${APP_PORT} is free"
fi

step "nginx"
if ! nginx -t >/dev/null 2>&1; then
  nginx -t || true
  fail "nginx -t already fails before we touch anything — fix that first, or the first reload will look like our fault"
else
  ok "nginx -t passes right now"
fi
log "  enabled sites: $(ls /etc/nginx/sites-enabled/ | tr '\n' ' ')"
if grep -rq "default_server" /etc/nginx/sites-enabled/ 2>/dev/null; then
  log "  a default_server is claimed by: $(grep -rl 'default_server' /etc/nginx/sites-enabled/ | xargs -r -n1 basename | tr '\n' ' ')"
else
  log "  no default_server claimed — nginx falls back to the first server block"
fi
if grep -rqF "${SITE_HOST}" /etc/nginx/sites-enabled/ 2>/dev/null; then
  fail "${SITE_HOST} is already named in an enabled site — two server blocks answering one name is a coin toss"
fi

step "DNS"
public_ip="$(curl -fsS --max-time 10 https://api.ipify.org 2>/dev/null || echo unknown)"
# `|| true` on both halves: a name that does not resolve is the finding this
# section exists to report, and `getent` exits 2 when it does not. Under
# `pipefail` that would end the script here instead of printing the reason.
resolved="$(getent ahostsv4 "${SITE_HOST}" 2>/dev/null | awk 'NR==1{print $1}' || true)"
log "  this machine: ${public_ip}"
if [[ -z "${resolved}" ]]; then
  fail "${SITE_HOST} does not resolve. certbot's HTTP-01 challenge needs it pointing here before a certificate can be issued — add the A record first."
elif [[ "${resolved}" != "${public_ip}" ]]; then
  warn "${SITE_HOST} resolves to ${resolved}, not ${public_ip}. Fine if a CDN is already proxying it; fatal for an HTTP-01 challenge if it is not."
else
  ok "${SITE_HOST} resolves here"
fi

step "certbot"
if command -v certbot >/dev/null; then
  ok "$(certbot --version 2>&1)"
  log "  existing certificates: $(certbot certificates 2>/dev/null | awk '/Certificate Name:/{printf "%s ", $3}' || true)"
  # The one certbot invocation this deployment must never make is
  # `--nginx`, which edits server blocks in place — including the neighbours'.
  #
  # `|| true` again: on a machine with no renewals yet the glob matches nothing
  # and grep exits 2, which under `pipefail` would abort a read-only survey.
  installers="$(grep -h '^installer' /etc/letsencrypt/renewal/*.conf 2>/dev/null | sort -u | tr '\n' ' ' || true)"
  log "  existing renewals use: ${installers:-<none recorded>}"
else
  fail "no certbot — the certificate criterion cannot be met without it"
fi

step "What WeCreate already has here"
for thing in \
  "system user ${APP_USER}:$(id -u "${APP_USER}" >/dev/null 2>&1 && echo present || echo absent)" \
  "directory ${APP_ROOT}:$([[ -d "${APP_ROOT}" ]] && echo present || echo absent)" \
  "unit ${APP_USER}.service:$(systemctl list-unit-files "${APP_USER}.service" --no-legend 2>/dev/null | grep -q . && echo present || echo absent)" \
  "vhost:$([[ -e "/etc/nginx/sites-enabled/${APP_USER}" ]] && echo present || echo absent)"
do
  log "  ${thing%%:*}: ${thing##*:}"
done

step "The neighbours"
capture_neighbours

step "Recording a baseline at ${BASELINE}"
mkdir -p "${BASELINE_DIR}"
{
  echo "# ${APP_USER} deployment baseline, ${STAMP}"
  echo "# Diff a later capture against this to show what provisioning changed."
  echo
  echo "## nginx -T (full effective configuration)"
  nginx -T 2>/dev/null
  echo
  echo "## enabled sites"
  ls -l /etc/nginx/sites-enabled/
  echo
  echo "## running services"
  systemctl list-units --type=service --state=running --no-legend --no-pager
  echo
  echo "## listening sockets"
  ss -ltnp
  echo
  echo "## neighbour status"
  neighbour_status
} > "${BASELINE}"
ok "baseline written ($(wc -l < "${BASELINE}") lines)"

if [[ "${failures}" -gt 0 ]]; then
  die "${failures} finding(s) above. Provisioning is not safe until they are resolved."
fi

step "Ready"
ok "nothing blocks provisioning. Take a Hostinger snapshot, then run provision.sh."
