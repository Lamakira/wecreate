#!/usr/bin/env bash
# Is the deployment's environment file complete, and is anything in it dangerous?
#
# Never prints a value. It reports, for each variable, whether it is set, how
# long it is, and what an empty one costs — because on this application an
# unset credential is not a crash, it is a feature quietly switching itself
# off. A deployment with no FEDAPAY_WEBHOOK_SECRET takes payments and approves
# none of them; one with no RESEND_API_KEY grants access and tells nobody. Both
# are the safe failure, and both are still failures, so they are worth seeing
# before a buyer finds them.
#
# It also refuses to be quiet about two things: a live payment key on a
# deployment that is meant to be a sandbox, and build-time variables written
# here where they can have no effect.
#
# Run as root on the server. Read-only.

set -euo pipefail
source "$(dirname -- "${BASH_SOURCE[0]}")/lib.sh"

readonly ENV_FILE="${APP_ROOT}/shared/env"

require_root
[[ -f "${ENV_FILE}" ]] || die "${ENV_FILE} does not exist — provision.sh has not run here"

problems=0
note() { warn "$*"; problems=$((problems + 1)); }

# Read the file without executing it: it is configuration, not a script, and
# `source` on it would run whatever a stray backtick happened to contain.
declare -A VALUE=()
while IFS= read -r line; do
  [[ "${line}" =~ ^[[:space:]]*# ]] && continue
  [[ "${line}" =~ ^[[:space:]]*$ ]] && continue
  [[ "${line}" =~ ^([A-Z_][A-Z0-9_]*)=(.*)$ ]] || continue
  key="${BASH_REMATCH[1]}"; val="${BASH_REMATCH[2]}"
  # systemd strips one layer of matching quotes; mirror that so a quoted value
  # is not reported as two characters longer than it is.
  [[ "${val}" =~ ^\"(.*)\"$ ]] && val="${BASH_REMATCH[1]}"
  [[ "${val}" =~ ^\'(.*)\'$ ]] && val="${BASH_REMATCH[1]}"
  VALUE["${key}"]="${val}"
done < "${ENV_FILE}"

report() {
  local key="$1" consequence="$2" required="$3" value="${VALUE[$1]:-}"
  if [[ -n "${value}" ]]; then
    ok "$(printf '%-32s set (%d characters)' "${key}" "${#value}")"
  elif [[ "${required}" == "required" ]]; then
    note "$(printf '%-32s EMPTY — %s' "${key}" "${consequence}")"
  else
    log "$(printf '  %-32s empty — %s' "${key}" "${consequence}")"
  fi
}

step "The file"
log "  ${ENV_FILE}"
log "  $(stat -c '%A %U:%G' "${ENV_FILE}")"
[[ "$(stat -c '%a' "${ENV_FILE}")" == "640" ]] || note "expected mode 640; anything wider lets other accounts on this machine read every credential"
[[ "$(stat -c '%U:%G' "${ENV_FILE}")" == "root:${APP_USER}" ]] || note "expected root:${APP_USER} ownership"

step "Managed Content"
report SANITY_API_READ_TOKEN      "preview of unpublished content will not work" required
report WECREATE_PREVIEW_SECRET    "no preview link for someone without a Sanity account; not needed with one editor" optional
report WECREATE_REVALIDATE_SECRET "no way to force a content refresh by hand; changes wait for the cache to expire" required
report SANITY_WEBHOOK_SECRET      "publishing does not notify the site; content appears within the hour on its own" optional

step "Commerce"
report SUPABASE_URL                  "no data plane at all: the Boutique reports nothing is on sale and /commerce says it is not configured" required
report SUPABASE_ANON_KEY             "same as above" required
report WECREATE_COMMERCE_PROVIDER    "inferred from SUPABASE_URL when empty, so this is usually harmless" optional
report WECREATE_PAYMENT_EVENT_SECRET "NO PAYMENT IS EVER APPROVED — the buyer pays and the order stays at 'verifying payment' for ever" required

step "Payments"
report FEDAPAY_SECRET_KEY                      "no payment provider: the checkout says online payment is not open yet" required
report FEDAPAY_WEBHOOK_SECRET                  "NO PAYMENT IS EVER APPROVED — deliveries cannot be proved to come from FedaPay, so every one is refused" required
report FEDAPAY_ENVIRONMENT                     "defaults to sandbox" optional
report WECREATE_LIVE_PAYMENTS_APPROVED_BY      "live payments stay in the sandbox even if FEDAPAY_ENVIRONMENT is live" optional

step "Email"
report RESEND_API_KEY       "an approved payment still grants access, but the buyer is never told — the order reads 'delivery to take up again'" required
report RESEND_FROM_ADDRESS  "same as above" required

step "Two things worth refusing"
# The one mistake on this deployment that costs real money. Naming `live`
# without recording who signed the Commerce Launch Gate is still only a name:
# the application stays in the sandbox until both are set (issue #18).
fedapay_env="${VALUE[FEDAPAY_ENVIRONMENT]:-sandbox}"
fedapay_key="${VALUE[FEDAPAY_SECRET_KEY]:-}"
approved_by="${VALUE[WECREATE_LIVE_PAYMENTS_APPROVED_BY]:-}"
if [[ "${fedapay_env}" == "live" && "${approved_by}" =~ [^[:space:]] ]]; then
  warn "FEDAPAY_ENVIRONMENT is 'live' and a named owner is recorded. This takes real money from real cards."
elif [[ "${fedapay_env}" == "live" ]]; then
  note "FEDAPAY_ENVIRONMENT is 'live' but WECREATE_LIVE_PAYMENTS_APPROVED_BY is empty. The application stays in the sandbox. Name the owner who signed docs/commerce-launch-gate.md before this takes real money."
else
  ok "FEDAPAY_ENVIRONMENT is ${fedapay_env}"
fi
# Only the prefix is examined; the key itself is never printed or compared.
if [[ -n "${fedapay_key}" ]]; then
  case "${fedapay_key}" in
    sk_sandbox_*|pk_sandbox_*) ok "FEDAPAY_SECRET_KEY is a sandbox key" ;;
    sk_live_*|pk_live_*)       note "FEDAPAY_SECRET_KEY is a LIVE key. Fetch the sandbox one instead — with FEDAPAY_ENVIRONMENT=sandbox it will simply be rejected, but it does not belong on this machine." ;;
    pk_*)                      note "FEDAPAY_SECRET_KEY holds a public key (pk_…). The secret key starts sk_; the public one is not used by this application at all." ;;
    sk_*)                      ok "FEDAPAY_SECRET_KEY looks like a secret key" ;;
    *)                         note "FEDAPAY_SECRET_KEY does not start with sk_ — check it was copied whole" ;;
  esac
fi

step "Variables that cannot work from here"
# Compiled into the bundle by `next build`. Set here they do nothing, and the
# reader who set them is entitled to be told rather than left wondering why
# the site ignores them.
misplaced=0
for key in "${!VALUE[@]}"; do
  case "${key}" in
    NEXT_PUBLIC_*|WECREATE_ALLOW_INDEXING)
      note "${key} is read at build time, not here. Set it in the GitHub Environment; this line has no effect."
      misplaced=1 ;;
  esac
done
[[ "${misplaced}" == "0" ]] && ok "none present, which is correct"

step "Verdict"
if [[ "${problems}" -gt 0 ]]; then
  die "${problems} thing(s) to settle above. The deployment will still start — it will just do less than you expect, quietly."
fi
ok "complete. Nothing here will switch itself off."
