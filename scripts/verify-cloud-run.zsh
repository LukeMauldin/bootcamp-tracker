#!/usr/bin/env zsh
set -euo pipefail

PROJECT_ID="${PROJECT_ID:-ch-bootcamp-496001}"
REGION="${REGION:-us-central1}"
SERVICE_NAME="${SERVICE_NAME:-bootcamp-tracker}"
SERVICE_URL="${1:-}"

require() {
  if ! command -v "$1" >/dev/null 2>&1; then
    print -u2 "Missing required command: $1"
    exit 1
  fi
}

require curl

if [[ -z "${SERVICE_URL}" ]]; then
  require gcloud
  SERVICE_URL="$(gcloud run services describe "${SERVICE_NAME}" \
    --project "${PROJECT_ID}" \
    --region "${REGION}" \
    --format='value(status.url)')"
fi

if [[ -z "${SERVICE_URL}" ]]; then
  print -u2 "Could not determine Cloud Run service URL."
  exit 1
fi

print "Verifying ${SERVICE_URL}"

health="$(curl -fsS --retry 6 --retry-delay 5 --connect-timeout 10 --max-time 30 "${SERVICE_URL}/api/healthz")"
if [[ "${health}" != *'"ok":true'* ]]; then
  print -u2 "Unexpected health response: ${health}"
  exit 1
fi

tmp_html="$(mktemp)"
tmp_js="$(mktemp)"
trap 'rm -f "${tmp_html}" "${tmp_js}"' EXIT

http_status="$(curl -fsS -L -o "${tmp_html}" -w '%{http_code}' --connect-timeout 10 --max-time 30 "${SERVICE_URL}/")"
if [[ "${http_status}" != "200" ]]; then
  print -u2 "Expected 200 for /, got ${http_status}"
  exit 1
fi

asset_path="$(sed -nE 's/.*src="([^"]*assets\/[^"]+\.js)".*/\1/p' "${tmp_html}" | head -n 1)"
if [[ -z "${asset_path}" ]]; then
  print -u2 "Could not find built JS asset in index.html"
  exit 1
fi

if [[ "${asset_path}" == /* ]]; then
  asset_url="${SERVICE_URL}${asset_path}"
else
  asset_url="${SERVICE_URL}/${asset_path}"
fi

curl -fsS -L -o "${tmp_js}" --connect-timeout 10 --max-time 30 "${asset_url}"

if grep -q 'SET_IN_CLOUD_BUILD_TRIGGER\|keyString:' "${tmp_js}"; then
  print -u2 "Built JS contains placeholder or malformed Firebase config."
  exit 1
fi

if ! grep -q "${PROJECT_ID}" "${tmp_js}"; then
  print -u2 "Built JS does not contain expected Firebase project ID ${PROJECT_ID}."
  exit 1
fi

print "Deployment verification passed."
