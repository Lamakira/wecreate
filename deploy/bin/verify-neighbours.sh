#!/usr/bin/env bash
# Show that adding WeCreate changed nothing about the sites that were here first.
#
# The acceptance criterion is "nginx serves it [...] alongside the existing
# sites, and neither of those is changed by the addition". A script that says so
# is worth nothing; this one compares the nginx configuration the server is
# actually running against the one recorded before provisioning touched
# anything, and prints every line that differs and does not belong to WeCreate.
#
# An empty list is the evidence. Somebody who was not here can run this and see
# it for themselves.
#
# Run as root on the server, any time. Read-only. Exits non-zero if a line that
# is not ours moved.

set -euo pipefail
source "$(dirname -- "${BASH_SOURCE[0]}")/lib.sh"

readonly BASELINE_DIR="/var/log/${APP_USER}-deploy"

require_root

step "The baseline"
baseline="$(ls -t "${BASELINE_DIR}"/baseline-*.txt 2>/dev/null | head -1 || true)"
[[ -n "${baseline}" ]] || die "no baseline in ${BASELINE_DIR} — preflight.sh never ran here, so there is nothing to compare against"
ok "$(basename "${baseline}")  ($(stat -c %y "${baseline}" | cut -d. -f1))"

before="$(mktemp)"; after="$(mktemp)"

# The baseline holds several sections; only the first is the nginx dump. `sed`
# takes everything between its heading and the next one, then drops both.
sed -n '/^## nginx -T/,/^## enabled sites/p' "${baseline}" | sed '1d;$d' > "${before}"
nginx -T 2>/dev/null > "${after}" || true

step "What changed in the effective nginx configuration"
# Compared file by file rather than line by line, and the distinction matters.
# A line-level diff cannot tell WeCreate's `proxy_buffering off;` from somebody
# else's — neither line names us. But `nginx -T` prints every file it loaded
# behind a `# configuration file <path>:` header, so the configuration can be
# split back into the files it came from, and then the question becomes exact:
# did any file that existed before provisioning change?
split_dir_before="$(mktemp -d)"; split_dir_after="$(mktemp -d)"
trap 'rm -rf "${before}" "${after}" "${split_dir_before}" "${split_dir_after}"' EXIT

split_by_file() {
  awk -v out="$2" '
    /^# configuration file .*:$/ {
      path = $4; sub(/:$/, "", path)
      name = path; gsub(/\//, "%", name)
      dest = out "/" name
      print path > (out "/.paths")
      next
    }
    dest { print >> dest }
  ' "$1"
  touch "$2/.paths"
  # Strip trailing blank lines from every extracted file. The baseline's copy of
  # the dump is a slice cut out of a larger document, so whichever file happened
  # to be last in it loses or gains a blank line at the seam — which would show
  # up here as "this file changed" on a machine where nothing had. A trailing
  # newline is not a configuration change, and reporting one as such would teach
  # the reader to ignore this script's output.
  local f
  for f in "$2"/*; do
    [[ -f "${f}" ]] || continue
    printf '%s\n' "$(cat "${f}")" > "${f}"
  done
}
split_by_file "${before}" "${split_dir_before}"
split_by_file "${after}"  "${split_dir_after}"

foreign=""
added=""
while read -r path; do
  [[ -n "${path}" ]] || continue
  name="${path//\//%}"
  if [[ -f "${split_dir_before}/${name}" ]]; then
    if ! diff -q "${split_dir_before}/${name}" "${split_dir_after}/${name}" >/dev/null; then
      foreign+="${path}"$'\n'
    fi
  else
    added+="${path}"$'\n'
  fi
done < <(sort -u "${split_dir_after}/.paths")

# A file that was loaded before and is not loaded now is as much a change as an
# edited one — more, in fact.
removed=""
while read -r path; do
  [[ -n "${path}" ]] || continue
  grep -qxF "${path}" "${split_dir_after}/.paths" || removed+="${path}"$'\n'
done < <(sort -u "${split_dir_before}/.paths")

log "  files loaded before: $(sort -u "${split_dir_before}/.paths" | grep -c . || true)"
log "  files loaded now:    $(sort -u "${split_dir_after}/.paths" | grep -c . || true)"

if [[ -n "${added}" ]]; then
  log ""
  log "  new files, which should be WeCreate's and nothing else:"
  # `>&2` like every other line here. Without it this list goes to stdout while
  # the headings go to stderr, and the two arrive interleaved over ssh — the
  # list printed above its own title, which is how a reader ends up trusting
  # the wrong summary.
  printf '%s' "${added}" | sed 's/^/    + /' >&2
fi

if [[ -z "${foreign}" && -z "${removed}" ]]; then
  ok "no file that existed before provisioning has changed, and none has gone away"
else
  [[ -n "${foreign}" ]] && { warn "files that existed before and have CHANGED:"; printf '%s' "${foreign}" | sed 's/^/    ~ /' >&2; }
  [[ -n "${removed}" ]] && { warn "files that were loaded before and are no longer:"; printf '%s' "${removed}" | sed 's/^/    - /' >&2; }
fi

step "Are they serving?"
# Compared against the same capture provisioning used, so this answers the
# question the criterion actually asks: are they still doing what they did.
recorded="$(sed -n '/^## neighbour status/,$p' "${baseline}" | sed '1d' | grep '=' || true)"
now="$(neighbour_status)"
drift=0
while read -r line; do
  [[ -z "${line}" ]] && continue
  host="${line%%=*}"; was="${line##*=}"
  is="$(grep -F "${host}=" <<<"${now}" | head -1 || true)"; is="${is##*=}"
  if [[ "${was}" == "${is}" ]]; then
    ok "${host}: ${is}, the same as before provisioning"
  else
    warn "${host}: was ${was}, now ${is}"
    drift=1
  fi
done <<<"${recorded}"

step "WeCreate itself"
own="$(curl -sS -o /dev/null -w '%{http_code}' --max-time 15 "https://${SITE_HOST}/" 2>/dev/null)" || own="000"
log "  https://${SITE_HOST}/ answers ${own}"
case "${own}" in
  000) log "  (nothing listening yet, or the name does not resolve from here)" ;;
  502) log "  (nginx is up; the application is not running — expected before the first deployment)" ;;
esac

if [[ -n "${foreign}" || -n "${removed}" || "${drift}" == "1" ]]; then
  die "something that is not WeCreate's changed. Compare by hand against ${baseline} before going further."
fi

step "Verified"
ok "the sites that were here first are configured and serving exactly as they were."
