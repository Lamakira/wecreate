#!/usr/bin/env bash
# Undo everything provision.sh did, and leave the machine as it was.
#
# **This file was written before provision.sh, on purpose.** A change to a
# server that is already serving two other people's sites is only as safe as
# the way back from it, and the way back is worth designing first — while the
# question "what exactly are we adding" is still open — rather than
# reconstructing it afterwards from memory of what got installed.
#
#   ./unprovision.sh              # remove it all, keep the release tree aside
#   ./unprovision.sh --purge      # and delete the release tree too
#   DRY_RUN=1 ./unprovision.sh    # print what would happen
#
# Safe to run on a half-provisioned machine, and safe to run twice: every step
# checks whether its thing is there before removing it.
#
# What it deliberately does not touch: nginx.conf, either neighbour's vhost,
# their certificates, Node, or any package. provision.sh never changed those,
# so there is nothing here to put back.

set -euo pipefail
source "$(dirname -- "${BASH_SOURCE[0]}")/lib.sh"

readonly PURGE="${1:-}"
readonly STAMP="$(date -u +%Y%m%dT%H%M%SZ)"
readonly UNIT="/etc/systemd/system/${APP_USER}.service"
readonly VHOST_AVAILABLE="/etc/nginx/sites-available/${APP_USER}"
readonly VHOST_ENABLED="/etc/nginx/sites-enabled/${APP_USER}"
readonly SNIPPET="/etc/nginx/snippets/${APP_USER}-origin.conf"
readonly SUDOERS="/etc/sudoers.d/${APP_USER}-deploy"
readonly CRON="/etc/cron.d/${APP_USER}-cloudflare-ips"

require_root
capture_neighbours

step "Stopping the application"
if systemctl list-unit-files "${APP_USER}.service" --no-legend 2>/dev/null | grep -q .; then
  run systemctl disable --now "${APP_USER}.service" || true
  run rm -f "${UNIT}"
  run systemctl daemon-reload
  run systemctl reset-failed "${APP_USER}.service" || true
  ok "unit removed"
else
  log "  no ${APP_USER}.service — nothing to stop"
fi

step "Removing the virtual host"
removed_nginx=0
for path in "${VHOST_ENABLED}" "${VHOST_AVAILABLE}" "${SNIPPET}"; do
  if [[ -e "${path}" || -L "${path}" ]]; then
    run rm -f "${path}"
    log "  removed ${path}"
    removed_nginx=1
  fi
done
if [[ "${removed_nginx}" == "1" ]]; then
  # The gate matters more here than on the way in: if removing our file somehow
  # left the configuration invalid, reloading would be the thing that finally
  # takes the neighbours down.
  nginx_reload
  assert_neighbours_ok
else
  log "  no WeCreate vhost present"
fi

step "Removing the certificate"
if [[ -d "/etc/letsencrypt/live/${SITE_HOST}" ]]; then
  # --cert-name, so the two certificates that were here first are not even
  # candidates for this command.
  run certbot delete --non-interactive --cert-name "${SITE_HOST}" || warn "certbot delete failed; remove /etc/letsencrypt/{live,archive,renewal}/${SITE_HOST}* by hand"
  ok "certificate for ${SITE_HOST} deleted"
else
  log "  no certificate for ${SITE_HOST}"
fi

step "Removing the deploy privileges and the schedule"
for path in "${SUDOERS}" "${CRON}"; do
  if [[ -e "${path}" ]]; then run rm -f "${path}"; log "  removed ${path}"; fi
done

step "Removing the ACME webroot"
if [[ -d "${ACME_WEBROOT}" ]]; then
  run rm -rf "${ACME_WEBROOT}"
  log "  removed ${ACME_WEBROOT}"
fi

step "The release tree"
if [[ -d "${APP_ROOT}" ]]; then
  if [[ "${PURGE}" == "--purge" ]]; then
    # It holds shared/env, which is the only copy of this deployment's secrets
    # that is not in GitHub's secret store. Saying so out loud before deleting
    # it is the point of this branch existing separately.
    warn "deleting ${APP_ROOT}, including shared/env and its secrets"
    run rm -rf "${APP_ROOT}"
    ok "purged"
  else
    run mv "${APP_ROOT}" "${APP_ROOT}.removed-${STAMP}"
    ok "moved aside to ${APP_ROOT}.removed-${STAMP} — delete it when you are satisfied, or re-run with --purge"
  fi
else
  log "  no ${APP_ROOT}"
fi

step "The system user"
if id -u "${APP_USER}" >/dev/null 2>&1; then
  run userdel "${APP_USER}" || warn "userdel failed — a process may still be running as ${APP_USER}"
  ok "user ${APP_USER} removed"
else
  log "  no ${APP_USER} user"
fi

step "Done"
assert_neighbours_ok
log ""
log "Nothing WeCreate added is left running. To prove the neighbours are as they were:"
log "  diff <(nginx -T) /var/log/${APP_USER}-deploy/baseline-*.txt   # the nginx section"
log ""
# Left behind deliberately, and there are two reasons. This script is very
# likely executing out of that directory right now, and bash reads a script
# incrementally — deleting it mid-run is a way to end up half-undone. And the
# baseline in /var/log is the evidence that the neighbours were not changed,
# which is worth more than a tidy filesystem.
log "Left in place, on purpose:"
log "  ${SERVER_DEPLOY_DIR}                    these scripts (delete by hand when done)"
log "  /var/log/${APP_USER}-deploy/            the before-and-after baselines"
[[ -d "${APP_ROOT}.removed-${STAMP}" ]] && log "  ${APP_ROOT}.removed-${STAMP}   the release tree and its secrets"
true
