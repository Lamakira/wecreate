#!/usr/bin/env bash
# Put everything the WeCreate deployment needs on the machine, and nothing else.
#
#   DRY_RUN=1 ./provision.sh          # print every privileged command, change nothing
#   ./provision.sh                    # do it
#   DEPLOY_PUBKEY="ssh-ed25519 AAAA…" ./provision.sh   # and authorise CI to deploy
#
# Idempotent: safe to re-run, and every step checks whether its thing is
# already there. Reversible: `unprovision.sh` undoes all of it.
#
# **What it never does**, because this machine serves weact.bj and
# askive.weact.bj and those are somebody's live sites:
#
#   * no `apt install`, no `apt upgrade`, no change to Node. Next.js 16 asks for
#     >= 20.9.0 and the machine already has 20.20.0, so the shared runtime is
#     left exactly as it is — which also means weact and askive never need
#     rebuilding against a new version.
#   * no `certbot --nginx`. That plugin edits server blocks in place and would
#     have both neighbours' files in scope. `certonly --webroot` writes no
#     nginx configuration at all.
#   * no edit to nginx.conf, to sites-enabled/weact, or to sites-enabled/askive.
#     Everything added is a new file.
#   * no `next build`. That saturates both cores for minutes; ADR-0011 puts it
#     in CI for exactly that reason.
#
# Run as root on the server.

set -euo pipefail
source "$(dirname -- "${BASH_SOURCE[0]}")/lib.sh"

readonly UNIT="/etc/systemd/system/${APP_USER}.service"
readonly VHOST_AVAILABLE="/etc/nginx/sites-available/${APP_USER}"
readonly VHOST_ENABLED="/etc/nginx/sites-enabled/${APP_USER}"
readonly SNIPPET="/etc/nginx/snippets/${APP_USER}-origin.conf"
readonly SUDOERS="/etc/sudoers.d/${APP_USER}-deploy"
readonly BASELINE_DIR="/var/log/${APP_USER}-deploy"

require_root

# Which of the two HTTP/2 spellings this nginx understands. 1.25.1 replaced the
# `http2` parameter on `listen` with a directive of its own, and each version
# rejects the other's form outright — so this is read from the binary rather
# than assumed, and a machine running either one gets a vhost that loads.
nginx_version="$(nginx -v 2>&1 | sed 's|.*nginx/||; s|[^0-9.].*||')"
if [[ "$(printf '%s\n1.25.1\n' "${nginx_version}" | sort -V | head -1)" == "1.25.1" ]]; then
  HTTP2_LISTEN=""
  HTTP2_DIRECTIVE="http2 on;"
else
  HTTP2_LISTEN=" http2"
  HTTP2_DIRECTIVE="# HTTP/2 is on the listen directives above: nginx ${nginx_version} predates \`http2 on;\` (1.25.1)."
fi

# The TLS settings block, chosen the same way and for the same reason: those
# two files are installed by the certbot *nginx plugin*, which this deployment
# never runs. On a machine where an earlier site was set up with `--nginx` they
# are there and are the better thing to use; on a clean machine they are not,
# and including a missing file fails `nginx -t`.
if [[ -f /etc/letsencrypt/options-ssl-nginx.conf && -f /etc/letsencrypt/ssl-dhparams.pem ]]; then
  SSL_HARDENING='    include             /etc/letsencrypt/options-ssl-nginx.conf;\n    ssl_dhparam         /etc/letsencrypt/ssl-dhparams.pem;'
else
  SSL_HARDENING='    ssl_protocols TLSv1.2 TLSv1.3;\n    ssl_prefer_server_ciphers off;\n    ssl_session_cache shared:wecreate_SSL:10m;\n    ssl_session_timeout 1d;\n    ssl_session_tickets off;'
fi

# Substitute the @NAME@ placeholders in a template. Deliberately explicit
# rather than `envsubst`: the set of things that may be interpolated into a
# systemd unit or an nginx vhost should be a list somebody can read.
render() {
  sed -e "s|@APP_USER@|${APP_USER}|g" \
      -e "s|@APP_ROOT@|${APP_ROOT}|g" \
      -e "s|@APP_PORT@|${APP_PORT}|g" \
      -e "s|@SITE_HOST@|${SITE_HOST}|g" \
      -e "s|@ACME_WEBROOT@|${ACME_WEBROOT}|g" \
      -e "s|@MAX_BODY_SIZE@|${MAX_BODY_SIZE}|g" \
      -e "s|@HTTP2_LISTEN@|${HTTP2_LISTEN}|g" \
      -e "s|@HTTP2_DIRECTIVE@|${HTTP2_DIRECTIVE}|g" \
      -e "s|^@SSL_HARDENING@\$|${SSL_HARDENING}|" \
      "$1"
}

# Write a rendered template only if it would change, so re-running does not
# churn timestamps and, more usefully, so the log says what actually moved.
install_rendered() {
  local src="$1" dest="$2" mode="${3:-0644}"
  local tmp; tmp="$(mktemp)"
  render "${src}" > "${tmp}"
  if [[ -f "${dest}" ]] && cmp -s "${tmp}" "${dest}"; then
    log "  ${dest} unchanged"
    rm -f "${tmp}"
    return 1
  fi
  if [[ "${DRY_RUN}" == "1" ]]; then
    log "${DIM}  would write ${dest}:${OFF}"
    sed 's/^/    | /' "${tmp}" >&2
    rm -f "${tmp}"
    return 0
  fi
  install -m "${mode}" -o root -g root "${tmp}" "${dest}"
  rm -f "${tmp}"
  ok "wrote ${dest}"
  return 0
}

step "Checking what this run needs before it changes anything"
# Fail fast, and specifically *before* the first mutating step. A certificate
# with no registered address gives nobody the sixty-day warning that is the
# only thing standing between a forgotten renewal and an expired certificate,
# and finding that out after the vhost is installed and reloaded leaves the
# machine half-provisioned for no reason.
[[ -n "${ACME_EMAIL}" ]] || die "ACME_EMAIL is not set. Re-run as: ACME_EMAIL=you@example.com $0"
ok "ACME_EMAIL=${ACME_EMAIL}"

step "Checking that preflight ran"
if ! compgen -G "${BASELINE_DIR}/baseline-*.txt" >/dev/null; then
  die "no baseline in ${BASELINE_DIR}. Run preflight.sh first — without a record of what the nginx configuration looked like beforehand, there is no way to show afterwards that the neighbours were not changed."
fi
ok "baseline present: $(basename "$(ls -t "${BASELINE_DIR}"/baseline-*.txt | head -1)")"

capture_neighbours

# ---------------------------------------------------------------------------
step "A stable home for these scripts"
# ---------------------------------------------------------------------------
# Copied to a fixed path rather than left wherever this was run from. Two
# things depend on that: the weekly cron entry that refreshes the Cloudflare
# allowlist needs an absolute path that will still be there next Monday, and
# unprovision.sh needs to be on the machine it undoes — a way back that only
# exists in somebody's checkout is not a way back.
if [[ "$(readlink -f "${DEPLOY_DIR}")" != "${SERVER_DEPLOY_DIR}" ]]; then
  run install -d -m 0755 -o root -g root "${SERVER_DEPLOY_DIR}"
  run cp -a "${DEPLOY_DIR}/." "${SERVER_DEPLOY_DIR}/"
  ok "copied to ${SERVER_DEPLOY_DIR}"
  log "  from now on, operate this deployment from there:"
  log "    ${SERVER_DEPLOY_DIR}/bin/unprovision.sh"
else
  log "  already running from ${SERVER_DEPLOY_DIR}"
fi

# ---------------------------------------------------------------------------
step "The system user"
# ---------------------------------------------------------------------------
if id -u "${APP_USER}" >/dev/null 2>&1; then
  log "  ${APP_USER} already exists (uid $(id -u "${APP_USER}"))"
else
  # --system: no ageing, no mail spool, an id below 1000, out of the way of the
  # human accounts. nologin, because nothing should ever sit at a shell as this
  # user; CI reaches it through a forced command instead.
  run useradd --system --shell /usr/sbin/nologin \
      --home-dir "${APP_ROOT}" --no-create-home \
      --comment "WeCreate application" "${APP_USER}"
  ok "created ${APP_USER}"
fi

# ---------------------------------------------------------------------------
step "The release tree"
# ---------------------------------------------------------------------------
run install -d -m 0755 -o "${APP_USER}" -g "${APP_USER}" "${APP_ROOT}"
run install -d -m 0755 -o "${APP_USER}" -g "${APP_USER}" "${APP_ROOT}/releases"
run install -d -m 0755 -o "${APP_USER}" -g "${APP_USER}" "${APP_ROOT}/bin"
run install -d -m 0750 -o root         -g "${APP_USER}" "${APP_ROOT}/shared"
ok "${APP_ROOT}/{releases,bin,shared}"

if [[ ! -f "${APP_ROOT}/shared/env" ]]; then
  step "The environment file"
  # 0640 root:wecreate — the application reads it, the application cannot
  # rewrite it, and no release contains it, so a rollback cannot resurrect a
  # credential that was rotated.
  if [[ "${DRY_RUN}" == "1" ]]; then
    log "${DIM}  would write ${APP_ROOT}/shared/env from deploy/env.server.example${OFF}"
  else
    install -m 0640 -o root -g "${APP_USER}" \
      "${DEPLOY_DIR}/env.server.example" "${APP_ROOT}/shared/env"
    warn "${APP_ROOT}/shared/env is a template. Fill it in before the first deploy — the service will not start usefully without it."
  fi
else
  log "  ${APP_ROOT}/shared/env already exists — left alone"
fi

# ---------------------------------------------------------------------------
step "The service"
# ---------------------------------------------------------------------------
if install_rendered "${DEPLOY_DIR}/wecreate.service" "${UNIT}"; then
  run systemctl daemon-reload
fi
# Enabled, not started: there is no release to run yet. `enable` is what makes
# the criterion about coming back after a reboot true.
run systemctl enable "${APP_USER}.service" >/dev/null
ok "${APP_USER}.service enabled (not started — no release yet)"

# ---------------------------------------------------------------------------
step "Deploy privileges"
# ---------------------------------------------------------------------------
# The deploy runs as ${APP_USER} and has to restart one unit. Rather than give
# it a shell as root, it gets exactly these six verbs on exactly this unit.
# `reset-failed` is here because a release that failed its way into the unit's
# start limit cannot be restarted until the limit is cleared — including by the
# rollback that would fix it.
sudoers_body="${APP_USER} ALL=(root) NOPASSWD: \
/usr/bin/systemctl restart ${APP_USER}.service, \
/usr/bin/systemctl start ${APP_USER}.service, \
/usr/bin/systemctl stop ${APP_USER}.service, \
/usr/bin/systemctl reset-failed ${APP_USER}.service, \
/usr/bin/systemctl is-active ${APP_USER}.service, \
/usr/bin/systemctl show ${APP_USER}.service"
if [[ "${DRY_RUN}" == "1" ]]; then
  log "${DIM}  would write ${SUDOERS}:${OFF}"
  log "    | ${sudoers_body}"
else
  tmp="$(mktemp)"; printf '%s\n' "${sudoers_body}" > "${tmp}"
  # A malformed file in sudoers.d breaks sudo for everyone on the machine,
  # which on this box includes whatever the other sites' operator does. Never
  # install one that has not been parsed.
  visudo -c -q -f "${tmp}" || { rm -f "${tmp}"; die "generated sudoers file does not parse — nothing installed"; }
  install -m 0440 -o root -g root "${tmp}" "${SUDOERS}"
  rm -f "${tmp}"
  ok "wrote ${SUDOERS} (six verbs, one unit)"
fi

# ---------------------------------------------------------------------------
step "The on-server release script"
# ---------------------------------------------------------------------------
if [[ "${DRY_RUN}" == "1" ]]; then
  log "${DIM}  would install ${APP_ROOT}/bin/release.sh${OFF}"
else
  install -m 0755 -o root -g "${APP_USER}" \
    "${DEPLOY_DIR}/bin/release.sh" "${APP_ROOT}/bin/release.sh"
  install -m 0644 -o root -g "${APP_USER}" \
    "${DEPLOY_DIR}/deployment.env" "${APP_ROOT}/bin/deployment.env"
  ok "installed ${APP_ROOT}/bin/release.sh"
fi

if [[ -n "${DEPLOY_PUBKEY:-}" ]]; then
  step "Authorising CI"
  run install -d -m 0700 -o "${APP_USER}" -g "${APP_USER}" "${APP_ROOT}/.ssh"
  # A forced command, so this key cannot open a shell, forward a port or copy a
  # file somewhere of its own choosing. It can do one thing: hand a release
  # tarball to release.sh on stdin. If the key leaks, that is the whole of what
  # the holder gets — and release.sh refuses anything that is not a bundle
  # built from this repository.
  authorized="command=\"${APP_ROOT}/bin/release.sh\",restrict ${DEPLOY_PUBKEY}"
  if [[ "${DRY_RUN}" == "1" ]]; then
    log "${DIM}  would append to ${APP_ROOT}/.ssh/authorized_keys:${OFF}"
    log "    | ${authorized}"
  else
    touch "${APP_ROOT}/.ssh/authorized_keys"
    if grep -qF "${DEPLOY_PUBKEY}" "${APP_ROOT}/.ssh/authorized_keys"; then
      log "  key already authorised"
    else
      printf '%s\n' "${authorized}" >> "${APP_ROOT}/.ssh/authorized_keys"
      ok "authorised one key, restricted to release.sh"
    fi
    chown "${APP_USER}:${APP_USER}" "${APP_ROOT}/.ssh/authorized_keys"
    chmod 0600 "${APP_ROOT}/.ssh/authorized_keys"
  fi
  if grep -qE '^\s*(AllowUsers|AllowGroups)' /etc/ssh/sshd_config /etc/ssh/sshd_config.d/*.conf 2>/dev/null; then
    warn "sshd restricts who may log in — add ${APP_USER} to that list or CI cannot connect"
  fi
else
  log "  DEPLOY_PUBKEY not set — CI is not authorised yet. Re-run with it to add the key."
fi

# ---------------------------------------------------------------------------
step "The ACME webroot"
# ---------------------------------------------------------------------------
# Its own directory, so proving this name never needs write access to anything
# a neighbour serves from.
run install -d -m 0755 -o root -g root "${ACME_WEBROOT}"
run install -d -m 0755 -o root -g root "${ACME_WEBROOT}/.well-known"
ok "${ACME_WEBROOT}"

# ---------------------------------------------------------------------------
step "The origin allowlist placeholder"
# ---------------------------------------------------------------------------
# Open, for now. The vhost includes this path unconditionally, and an nginx
# `include` of a missing file is a config error — so the file has to exist
# before the vhost does, and turning the CDN lockdown on later is then one
# script run rather than an edit to a live vhost.
run install -d -m 0755 -o root -g root /etc/nginx/snippets
if [[ ! -f "${SNIPPET}" ]]; then
  if [[ "${DRY_RUN}" == "1" ]]; then
    log "${DIM}  would write ${SNIPPET} (allow all)${OFF}"
  else
    printf '%s\n' \
      "# Placeholder written by provision.sh. No CDN in front of this origin yet." \
      "# deploy/bin/refresh-cloudflare-ips.sh replaces this with the lockdown." \
      "allow all;" > "${SNIPPET}"
    ok "wrote ${SNIPPET} (open)"
  fi
else
  log "  ${SNIPPET} already exists — left alone"
fi

# ---------------------------------------------------------------------------
step "The virtual host, first pass (HTTP only)"
# ---------------------------------------------------------------------------
if [[ ! -d "/etc/letsencrypt/live/${SITE_HOST}" ]]; then
  install_rendered "${DEPLOY_DIR}/nginx/wecreate-bootstrap.conf" "${VHOST_AVAILABLE}" || true
  [[ -L "${VHOST_ENABLED}" ]] || run ln -s "${VHOST_AVAILABLE}" "${VHOST_ENABLED}"
  nginx_reload
  assert_neighbours_ok

  step "The certificate"
  if ! run certbot certonly --webroot --webroot-path "${ACME_WEBROOT}" \
      --domain "${SITE_HOST}" \
      --email "${ACME_EMAIL}" --agree-tos --no-eff-email \
      --non-interactive --keep-until-expiring; then
    warn "certbot could not prove ${SITE_HOST}."
    warn "The usual cause is DNS: the HTTP-01 challenge is fetched from the public"
    warn "internet over port 80, so ${SITE_HOST} has to resolve to this machine and"
    warn "reach it. If a CDN is already proxying the name, either let its challenge"
    warn "through or turn the proxy off until the certificate exists."
    warn ""
    warn "What is on the machine now: the HTTP-only vhost, answering 404 for this"
    warn "name and nothing else. Both neighbours are untouched. Re-run this script"
    warn "once DNS is right, or undo with unprovision.sh."
    die "stopping before the TLS vhost, which would fail nginx -t without a certificate"
  fi
  ok "certificate issued for ${SITE_HOST}"
  # Renewal is systemd's `certbot.timer`, which is already running for the two
  # certificates that were here first; this one joins them with no new schedule
  # to forget about. It renews over the same webroot, which is why the port-80
  # block in the full vhost keeps the challenge location.
else
  log "  certificate for ${SITE_HOST} already exists"
fi

# ---------------------------------------------------------------------------
step "Making a renewed certificate actually get served"
# ---------------------------------------------------------------------------
# The half of "automatically renewed" that `certonly` does not do. certbot
# writes the new files and stops; nginx went on holding the old certificate in
# memory, and would keep serving it until something reloaded — which, with no
# installer plugin involved, nothing ever does. The failure arrives sixty days
# later as an expired certificate on a site nobody touched.
#
# A deploy hook rather than `--deploy-hook` on the command above, because the
# renewal config was written when the certificate was first issued and a flag
# passed now would not be in it. This runs for every certificate on the
# machine, which is what the neighbours want too, and only when something was
# actually renewed.
run install -d -m 0755 -o root -g root /etc/letsencrypt/renewal-hooks/deploy
if [[ "${DRY_RUN}" == "1" ]]; then
  log "${DIM}  would write /etc/letsencrypt/renewal-hooks/deploy/reload-nginx${OFF}"
else
  tmp="$(mktemp)"
  cat > "${tmp}" <<'HOOK'
#!/bin/sh
# Installed by WeCreate's deploy/bin/provision.sh.
#
# certbot renews a certificate on disk; nginx keeps serving the one it loaded
# at startup until it is told otherwise. Without this, "automatically renewed"
# is only half true and the site serves an expired certificate.
#
# Tested before reloading: a reload on a broken configuration is refused, but
# checking first turns a silent no-op into a message in the renewal log.
nginx -t && systemctl reload nginx
HOOK
  install -m 0755 -o root -g root "${tmp}" /etc/letsencrypt/renewal-hooks/deploy/reload-nginx
  rm -f "${tmp}"
  ok "installed /etc/letsencrypt/renewal-hooks/deploy/reload-nginx"
fi

if systemctl is-enabled certbot.timer >/dev/null 2>&1; then
  ok "certbot.timer is enabled — renewal is scheduled"
else
  warn "certbot.timer is not enabled. Nothing will renew this certificate: systemctl enable --now certbot.timer"
fi

# ---------------------------------------------------------------------------
step "The virtual host, second pass (TLS)"
# ---------------------------------------------------------------------------
install_rendered "${DEPLOY_DIR}/nginx/wecreate.conf" "${VHOST_AVAILABLE}" || true
[[ -L "${VHOST_ENABLED}" ]] || run ln -s "${VHOST_AVAILABLE}" "${VHOST_ENABLED}"
nginx_reload
assert_neighbours_ok

# ---------------------------------------------------------------------------
step "Provisioned"
# ---------------------------------------------------------------------------
log ""
log "  The machine is ready and the application is not running, because no"
log "  release has been deployed to it yet. What is left:"
log ""
log "    1. Fill in ${APP_ROOT}/shared/env (secrets; see deploy/env.server.example)."
log "    2. Apply supabase/migrations/ to the target project."
log "    3. Push, or run the Deploy workflow, to build in CI and swap a release in."
log ""
log "  To undo everything above:  deploy/bin/unprovision.sh"
log "  To show the neighbours are unchanged:"
log "    diff <(nginx -T 2>/dev/null) ${BASELINE_DIR}/baseline-*.txt"
