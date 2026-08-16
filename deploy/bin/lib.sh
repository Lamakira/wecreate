#!/usr/bin/env bash
# Shared machinery for the provisioning scripts.
#
# The one idea in this file: **this machine was serving two other sites before
# WeCreate arrived, and it has to still be serving them afterwards.** So no
# script here changes shared state without checking the neighbours immediately
# after, and every one of them aborts on the step that broke something rather
# than carrying on to the next.
#
# Sourced, never executed.

set -euo pipefail

DEPLOY_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)"
# shellcheck source=../deployment.env
source "${DEPLOY_DIR}/deployment.env"

# `DRY_RUN=1` prints every privileged command instead of running it. It is not
# a courtesy: it is how the diff of what a script is about to do to a live
# server can be read before it does it.
: "${DRY_RUN:=0}"

readonly RED=$'\033[31m' GREEN=$'\033[32m' YELLOW=$'\033[33m' DIM=$'\033[2m' OFF=$'\033[0m'

log()  { printf '%s\n' "$*" >&2; }
step() { printf '\n%s==>%s %s\n' "${YELLOW}" "${OFF}" "$*" >&2; }
ok()   { printf '%s  ok%s %s\n' "${GREEN}" "${OFF}" "$*" >&2; }
warn() { printf '%s  !!%s %s\n' "${YELLOW}" "${OFF}" "$*" >&2; }
die()  { printf '%s ERR%s %s\n' "${RED}" "${OFF}" "$*" >&2; exit 1; }

# Run a command, or print it under DRY_RUN. Everything that writes to the
# server goes through this, which is what makes the dry run trustworthy: a
# command that skipped it would not appear in the preview.
run() {
  if [[ "${DRY_RUN}" == "1" ]]; then
    printf '%s  would run:%s %s\n' "${DIM}" "${OFF}" "$*" >&2
    return 0
  fi
  "$@"
}

require_root() {
  [[ "${EUID}" -eq 0 ]] || die "run this as root on the server (it edits /etc and creates a system user)"
}

# ---------------------------------------------------------------------------
# The neighbours
# ---------------------------------------------------------------------------

# One HTTPS request per existing site, from the server itself. Returns the
# status codes so a caller can compare them across a change rather than assert
# a particular one — askive might legitimately answer 302 today and 200
# tomorrow, and what matters is that the answer did not become a 502.
neighbour_status() {
  local host status
  for host in ${NEIGHBOURS}; do
    # No `|| echo "000"`: `-w '%{http_code}'` already prints `000` on a failed
    # connection, and appending a second one produces `000000`, which then
    # compares unequal to `000` — so an unreachable neighbour would be recorded
    # as having been fine, and the check that is supposed to stop the script
    # would wave it through.
    status="$(curl -sS -o /dev/null -w '%{http_code}' --max-time 10 "https://${host}/" 2>/dev/null)" || status="000"
    [[ "${status}" =~ ^[0-9]{3}$ ]] || status="000"
    printf '%s=%s\n' "${host}" "${status}"
  done
}

# Capture the neighbours' answers before a change. Call once, early.
NEIGHBOURS_BEFORE=""
capture_neighbours() {
  if [[ -z "${NEIGHBOURS// /}" ]]; then
    log "${DIM}  no neighbours declared — nothing on this machine to protect${OFF}"
    return 0
  fi
  NEIGHBOURS_BEFORE="$(neighbour_status)"
  log "${DIM}  neighbours before: $(tr '\n' ' ' <<<"${NEIGHBOURS_BEFORE}")${OFF}"
  local line
  while read -r line; do
    [[ -z "${line}" ]] && continue
    if [[ "${line##*=}" == "000" ]]; then
      warn "${line%%=*} was already unreachable before this script ran"
    fi
  done <<<"${NEIGHBOURS_BEFORE}"
  # A `while` loop exits with the status of the last command in its body, and
  # under `set -e` a final iteration whose test was simply false would end the
  # script. Say so explicitly rather than depend on which branch ran last.
  return 0
}

# Compare against the capture and abort if a site that was answering has
# stopped. Called after every step that touches nginx.
assert_neighbours_ok() {
  local after before_line host was now
  [[ "${DRY_RUN}" == "1" ]] && return 0
  [[ -z "${NEIGHBOURS_BEFORE}" ]] && return 0
  after="$(neighbour_status)"
  while read -r before_line; do
    [[ -z "${before_line}" ]] && continue
    host="${before_line%%=*}"
    was="${before_line##*=}"
    # `|| true`: grep exits 1 when the host is not in the second capture at
    # all, and under `pipefail` that would abort the very check that is meant
    # to report it.
    now="$(grep -F "${host}=" <<<"${after}" | head -1 || true)"
    now="${now##*=}"
    [[ -z "${now}" ]] && now="000"
    if [[ "${was}" != "000" && ( "${now}" == "000" || "${now}" =~ ^5 ) ]]; then
      die "${host} answered ${was} before this step and ${now} after it — stopping here. Run deploy/bin/unprovision.sh to undo."
    fi
  done <<<"${NEIGHBOURS_BEFORE}"
  ok "neighbours still serving: $(tr '\n' ' ' <<<"${after}")"
}

# ---------------------------------------------------------------------------
# nginx
# ---------------------------------------------------------------------------

# The hard gate. nginx refuses to load a broken config on reload, but it will
# happily *keep running the old one* and leave you thinking the change landed,
# so the test is run explicitly and its failure is fatal.
nginx_test() {
  if [[ "${DRY_RUN}" == "1" ]]; then
    log "${DIM}  would run: nginx -t${OFF}"
    return 0
  fi
  nginx -t >/dev/null 2>&1 || {
    nginx -t || true
    die "nginx -t failed — nothing was reloaded, the running config is unchanged"
  }
  ok "nginx -t passes"
}

# `reload`, never `restart`. A reload starts new workers on the new config and
# lets the old ones finish their requests; a restart drops every connection
# both neighbours currently have open.
nginx_reload() {
  nginx_test
  run systemctl reload nginx
  ok "nginx reloaded"
}
