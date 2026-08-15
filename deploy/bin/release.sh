#!/usr/bin/env bash
# The only thing CI is allowed to do to this machine.
#
# Installed at ${APP_ROOT}/bin/release.sh and named as the forced command on the
# deploy key, so `ssh wecreate@host` runs this and nothing else — no shell, no
# port forwarding, no arbitrary file write. Whatever the client asked to run
# arrives as SSH_ORIGINAL_COMMAND and is matched against the four verbs below;
# anything else is refused.
#
#   ssh wecreate@host < bundle.tar.zst   # deploy: read the bundle on stdin
#   ssh wecreate@host rollback           # go back to the previous release
#   ssh wecreate@host restart            # restart the current one
#   ssh wecreate@host status             # what is running, and since when
#
# A deployment is a symlink move and a restart. A failed one puts the symlink
# back before it returns, so the previous release is what is serving — which is
# the acceptance criterion, and also the reason this script does the health
# check itself rather than leaving it to the workflow that called it.
#
# Self-contained on purpose: it does not source lib.sh, because lib.sh lives in
# the repository and this file lives on the server.

set -euo pipefail

# Beside this script when provision.sh installed it into ${APP_ROOT}/bin, one
# level up when this is the copy in the repository or in /opt. The same file
# has to work from all three, or the one that runs on every deployment is a
# different file from the one anybody reviews.
_here="$(dirname -- "$(readlink -f -- "${BASH_SOURCE[0]}")")"
if   [[ -f "${_here}/deployment.env"    ]]; then source "${_here}/deployment.env"
elif [[ -f "${_here}/../deployment.env" ]]; then source "${_here}/../deployment.env"
else echo "release: no deployment.env beside ${_here} or above it" >&2; exit 1
fi

readonly RELEASES="${APP_ROOT}/releases"
readonly CURRENT="${APP_ROOT}/current"
# What was serving before `current`. Recorded on a successful deployment, so a
# rollback goes to a release that is known to have answered rather than to
# whichever directory has the newest mtime.
readonly PREVIOUS="${APP_ROOT}/previous"
readonly LOCK="${APP_ROOT}/.deploy.lock"
readonly UNIT="${APP_USER}.service"
# A standalone bundle for this application is a few hundred megabytes at most.
# The ceiling is here so that a truncated upload, or a client sending something
# that is not a release at all, fills a temp file and stops rather than the disk.
readonly MAX_BUNDLE_BYTES=$((600 * 1024 * 1024))
readonly HEALTH_TIMEOUT=60

log()  { printf '%s\n' "$*" >&2; }
die()  { printf 'release: %s\n' "$*" >&2; exit 1; }

systemctl_() { sudo -n /usr/bin/systemctl "$1" "${UNIT}"; }

# Is the process actually answering? Not "did systemd start it" — a Next.js
# server with a broken environment starts perfectly well and then fails every
# request. Anything below 500 counts: a 404 from the origin means routing and
# rendering both work, and which page exists is not this script's business.
healthy() {
  local started=${SECONDS} deadline=$((SECONDS + HEALTH_TIMEOUT)) code
  while (( SECONDS < deadline )); do
    # No `|| echo 000` here. `-w '%{http_code}'` already prints `000` when the
    # connection fails, so the fallback would append a second one — and
    # `000000` is neither equal to `000` nor a number, so both halves of the
    # test below would pass and a dead server would report healthy. That is
    # the failure mode this whole function exists to catch.
    code="$(curl -sS -o /dev/null -w '%{http_code}' --max-time 5 \
            "http://127.0.0.1:${APP_PORT}/" 2>/dev/null)" || code="000"
    # Exactly three digits, then a numeric range. Anything below 500 counts: a
    # 404 from the origin means routing and rendering both work, and which page
    # exists is not this script's business.
    if [[ "${code}" =~ ^[0-9]{3}$ ]] && (( code >= 100 && code < 500 )); then
      log "  health: HTTP ${code} after $((SECONDS - started))s"
      return 0
    fi
    sleep 2
  done
  log "  health: no usable response in ${HEALTH_TIMEOUT}s (last: ${code:-none})"
  return 1
}

activate() {
  local release="$1"
  # Two steps rather than `ln -sfn` onto the live path: `mv -T` replaces the
  # symlink atomically, so there is no instant where `current` does not exist.
  ln -sfn "${RELEASES}/${release}" "${CURRENT}.new"
  mv -Tf "${CURRENT}.new" "${CURRENT}"

  # A previous release that failed five times in a minute leaves the unit in a
  # start-limit state, where `restart` refuses outright — including the restart
  # that would have fixed it.
  systemctl_ reset-failed || true
  # Neither of these is allowed to end the script. `set -e` on a failed restart
  # would exit with the new symlink in place and the rollback below never run;
  # whether this release actually works is `healthy()`'s question, and it is
  # about to be asked.
  systemctl_ restart || true
}

prune() {
  local keep="${KEEP_RELEASES}" current stale old keepers pinned others_kept
  current="$(basename "$(readlink -f "${CURRENT}")")"
  keepers="${current}"
  if [[ -L "${PREVIOUS}" ]]; then
    keepers+=$'\n'"$(basename "$(readlink -f "${PREVIOUS}")")"
  fi
  # Never prune what is running or what a rollback would land on, whatever
  # their age — a release that has been live for a while must not delete the
  # one it would fall back to. Both are excluded from the list below *and*
  # counted against KEEP_RELEASES, so what survives is the number
  # `deployment.env` promises rather than that number plus the pinned ones.
  pinned="$(grep -c . <<<"${keepers}" || true)"
  others_kept=$(( keep > pinned ? keep - pinned : 0 ))
  #
  # `tail -n +N` prints *from* line N, so the first line to drop is one past
  # the last one kept — `+${keep}` would have kept one fewer than asked.
  #
  # `|| true`, and collected before the loop rather than piped into it: with a
  # single release on disk `grep -v` matches nothing and exits 1, which under
  # `pipefail` would fail a deployment that had already succeeded.
  stale="$(ls -1t "${RELEASES}" 2>/dev/null | grep -vFxf <(printf '%s\n' "${keepers}") | tail -n "+$(( others_kept + 1 ))" || true)"
  [[ -z "${stale}" ]] && return 0
  while read -r old; do
    [[ -n "${old}" ]] || continue
    rm -rf "${RELEASES:?}/${old}"
    log "  pruned ${old}"
  done <<<"${stale}"
}

deploy() {
  local bundle release previous needs_node built_on
  bundle="$(mktemp "${APP_ROOT}/.incoming-XXXXXX.tar.zst")"
  # shellcheck disable=SC2064
  trap "rm -f '${bundle}'" EXIT

  log "reading bundle from stdin"
  head -c "${MAX_BUNDLE_BYTES}" > "${bundle}"
  [[ -s "${bundle}" ]] || die "empty bundle on stdin"
  log "  $(du -h "${bundle}" | cut -f1)"

  tar --zstd -tf "${bundle}" >/dev/null 2>&1 || die "stdin is not a zstd tar archive"

  # BUILD_INFO is `KEY=value` lines written by the workflow. Extracted once and
  # read with sed rather than sourced: this file arrived over the wire, and
  # sourcing it would be running it.
  local build_info
  build_info="$(tar --zstd -xOf "${bundle}" ./BUILD_INFO 2>/dev/null || true)"
  [[ -n "${build_info}" ]] || die "no BUILD_INFO in the bundle — this was not built by the deploy workflow"

  release="$(sed -n 's/^RELEASE=//p' <<<"${build_info}" | head -1)"
  needs_node="$(sed -n 's/^NODE_MIN=//p' <<<"${build_info}" | head -1)"
  built_on="$(sed -n 's/^NODE_BUILD=//p' <<<"${build_info}" | head -1)"
  # Anchored, and checked before the value is ever used as a path: `release` is
  # the one thing from the bundle that becomes a directory name.
  [[ "${release}" =~ ^[A-Za-z0-9._-]+$ ]] || die "RELEASE '${release}' is not a safe directory name"
  [[ "${needs_node}" =~ ^[0-9]+(\.[0-9]+){0,2}$ ]] || die "BUILD_INFO carries no usable NODE_MIN"

  # A minimum, not an equality. CI builds on a newer Node than this machine
  # runs, and that is deliberate: pnpm 11 refuses to start on Node 20, while
  # the server's Node is fixed because changing it would mean rebuilding the
  # two other sites here first. What actually has to hold is that this Node
  # satisfies what the bundle declares it needs — the framework's own
  # `engines.node`, copied into BUILD_INFO at build time.
  local have_node
  have_node="$(node -p 'process.versions.node')"
  if [[ "$(printf '%s\n%s\n' "${needs_node}" "${have_node}" | sort -V | head -1)" != "${needs_node}" ]]; then
    die "bundle needs Node >= ${needs_node}, this machine runs ${have_node}"
  fi
  log "  node ${have_node} (built on ${built_on:-unknown}, needs >= ${needs_node})"

  # The origin is compiled into the bundle and cannot be corrected here, so a
  # bundle built for the wrong host is not something this machine can fix — it
  # can only decline to serve it. Getting this wrong is not a broken page: it
  # is a working page that emails buyers an Order Access address on a hostname
  # this deployment does not answer to, and that address has to keep resolving
  # for ever.
  #
  # A warning rather than a refusal when BUILD_INFO carries no ORIGIN at all,
  # so a bundle built before this field existed still deploys.
  local origin
  origin="$(sed -n 's/^ORIGIN=//p' <<<"${build_info}" | head -1)"
  if [[ -z "${origin}" ]]; then
    log "  origin: not recorded in this bundle — cannot check it against ${SITE_HOST}"
  elif [[ "${origin#*://}" != "${SITE_HOST}" && "${origin#*://}" != "${SITE_HOST}/" ]]; then
    die "bundle was built with NEXT_PUBLIC_SITE_URL=${origin}, but this machine serves ${SITE_HOST}. Every canonical URL and every emailed Order Access address in it would name the wrong host."
  else
    log "  origin ${origin}"
  fi

  if [[ -d "${RELEASES}/${release}" ]]; then
    log "release ${release} is already unpacked — reusing it"
  else
    log "unpacking ${release}"
    rm -rf "${RELEASES}/.${release}.partial"
    mkdir -p "${RELEASES}/.${release}.partial"
    tar --zstd -xf "${bundle}" -C "${RELEASES}/.${release}.partial"
    [[ -f "${RELEASES}/.${release}.partial/server.js" ]] || die "no server.js in the bundle"
    # Only now does it become a release. An interrupted transfer leaves a
    # .partial directory that nothing will ever activate.
    mv -T "${RELEASES}/.${release}.partial" "${RELEASES}/${release}"
  fi

  previous=""
  [[ -L "${CURRENT}" ]] && previous="$(basename "$(readlink -f "${CURRENT}")")"

  log "activating ${release}${previous:+ (previous: ${previous})}"
  activate "${release}"

  if healthy; then
    log "deployed ${release}"
    # Remember what was serving before this, so `rollback` goes back to a
    # release that is known to have answered rather than to whichever directory
    # happens to be newest.
    if [[ -n "${previous}" && -d "${RELEASES}/${previous}" ]]; then
      ln -sfn "${RELEASES}/${previous}" "${PREVIOUS}.new"
      mv -Tf "${PREVIOUS}.new" "${PREVIOUS}"
    fi
    prune
    exit 0
  fi

  # The criterion this exists for: a failed deployment leaves the previous one
  # serving.
  log "new release is not healthy"
  if [[ -n "${previous}" && -d "${RELEASES}/${previous}" ]]; then
    log "rolling back to ${previous}"
    activate "${previous}"
    if healthy; then
      # Delete it. A release that failed its health check is not a rollback
      # target, and leaving it on disk makes it the newest thing there — which
      # is exactly what a later `rollback` would reach for.
      rm -rf "${RELEASES:?}/${release}"
      die "deployment of ${release} failed; ${previous} is serving again"
    fi
    die "deployment of ${release} failed AND rollback to ${previous} did not come up — the site is down, look at: journalctl -u ${UNIT} -n 100"
  fi
  # Kept on disk, unlike above: with nothing to fall back to the site is down
  # either way, and the unpacked release is what there is to look at.
  die "deployment of ${release} failed and there is no previous release to fall back to"
}

rollback() {
  local current previous
  [[ -L "${CURRENT}" ]] || die "nothing is deployed"
  current="$(basename "$(readlink -f "${CURRENT}")")"
  # The recorded pointer first: it names a release that was serving, which
  # `ls -1t` cannot tell you. The mtime heuristic is the fallback for a machine
  # provisioned before the pointer existed.
  previous=""
  if [[ -L "${PREVIOUS}" && -d "$(readlink -f "${PREVIOUS}")" ]]; then
    previous="$(basename "$(readlink -f "${PREVIOUS}")")"
    [[ "${previous}" == "${current}" ]] && previous=""
  fi
  [[ -n "${previous}" ]] || previous="$(ls -1t "${RELEASES}" | grep -vFx "${current}" | head -1 || true)"
  [[ -n "${previous}" ]] || die "no earlier release on disk to roll back to"
  log "rolling back from ${current} to ${previous}"
  activate "${previous}"
  healthy || die "rollback to ${previous} did not come up — journalctl -u ${UNIT} -n 100"
  # Cleared rather than repointed at what we just left, so rolling back twice
  # keeps going backwards instead of toggling between two releases.
  rm -f "${PREVIOUS}"
  log "rolled back to ${previous}"
}

status() {
  printf 'release:  %s\n' "$([[ -L "${CURRENT}" ]] && basename "$(readlink -f "${CURRENT}")" || echo '<none>')"
  printf 'rollback: %s\n' "$([[ -L "${PREVIOUS}" ]] && basename "$(readlink -f "${PREVIOUS}")" || echo '<newest other release>')"
  printf 'unit:     %s\n' "$(systemctl_ is-active || true)"
  # `show` with no flags, then parsed here. The sudoers rule names the exact
  # command line this key may run, and `systemctl_` forwards only the verb and
  # the unit — a `--property=` would not match the rule and would not be
  # forwarded either.
  printf 'since:    %s\n' "$(systemctl_ show 2>/dev/null | sed -n 's/^ActiveEnterTimestamp=//p' | head -1 || true)"
  printf 'on disk:  %s\n' "$(ls -1t "${RELEASES}" 2>/dev/null | tr '\n' ' ')"
  # `|| true`: nothing is deployed yet is a perfectly good answer to `status`,
  # not a reason to exit non-zero.
  [[ -f "${CURRENT}/BUILD_INFO" ]] && sed 's/^/build:    /' "${CURRENT}/BUILD_INFO" || true
}

main() {
  case "${SSH_ORIGINAL_COMMAND:-deploy}" in
    ""|deploy)  deploy ;;
    rollback)   rollback ;;
    restart)    systemctl_ restart; healthy || die "did not come back up"; log "restarted" ;;
    status)     status ;;
    *)          die "refused: this key may only run deploy, rollback, restart or status" ;;
  esac
}

# One deployment at a time. Two overlapping symlink swaps would leave the
# service running a release neither of them thinks it activated.
exec 9>"${LOCK}"
flock -n 9 || die "another deployment is in progress"
main
