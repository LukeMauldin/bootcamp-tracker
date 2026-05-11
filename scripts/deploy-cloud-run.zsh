#!/usr/bin/env zsh
set -euo pipefail

PROJECT_ID="${PROJECT_ID:-ch-bootcamp-496001}"
REGION="${REGION:-us-central1}"
AR_REPOSITORY="${AR_REPOSITORY:-app}"
IMAGE_NAME="${IMAGE_NAME:-bootcamp}"
SERVICE_NAME="${SERVICE_NAME:-bootcamp-tracker}"
BUCKET="${BUCKET:-ch-bootcamp-496001-uploads}"
RUNTIME_SA="${RUNTIME_SA:-bootcamp-runtime@${PROJECT_ID}.iam.gserviceaccount.com}"
BUILD_SA="${BUILD_SA:-bootcamp-builder@${PROJECT_ID}.iam.gserviceaccount.com}"
CONFIG_FILE="${CONFIG_FILE:-client/.env.production}"

require() {
  if ! command -v "$1" >/dev/null 2>&1; then
    print -u2 "Missing required command: $1"
    exit 1
  fi
}

read_env_value() {
  local file="$1"
  local key="$2"
  local line

  if [[ ! -f "${file}" ]]; then
    return 0
  fi

  line="$(grep -E "^${key}=" "${file}" | tail -n 1 || true)"
  if [[ -n "${line}" ]]; then
    print -r -- "${line#*=}"
  fi
}

trim_value() {
  print -r -- "$1" | sed -E 's/^[[:space:]]+//; s/[[:space:]]+$//'
}

normalize_api_key() {
  local value
  value="$(trim_value "$1")"
  value="${value#keyString:}"
  trim_value "${value}"
}

require gcloud
require git
require grep
require sed
require curl

if [[ ! -f "${CONFIG_FILE}" && -f client/.env.local ]]; then
  CONFIG_FILE="client/.env.local"
fi

VITE_FIREBASE_API_KEY="${VITE_FIREBASE_API_KEY:-$(read_env_value "${CONFIG_FILE}" VITE_FIREBASE_API_KEY)}"
VITE_FIREBASE_AUTH_DOMAIN="${VITE_FIREBASE_AUTH_DOMAIN:-$(read_env_value "${CONFIG_FILE}" VITE_FIREBASE_AUTH_DOMAIN)}"
VITE_FIREBASE_PROJECT_ID="${VITE_FIREBASE_PROJECT_ID:-$(read_env_value "${CONFIG_FILE}" VITE_FIREBASE_PROJECT_ID)}"
VITE_FIREBASE_APP_ID="${VITE_FIREBASE_APP_ID:-$(read_env_value "${CONFIG_FILE}" VITE_FIREBASE_APP_ID)}"

VITE_FIREBASE_API_KEY="$(normalize_api_key "${VITE_FIREBASE_API_KEY}")"
VITE_FIREBASE_AUTH_DOMAIN="$(trim_value "${VITE_FIREBASE_AUTH_DOMAIN}")"
VITE_FIREBASE_PROJECT_ID="$(trim_value "${VITE_FIREBASE_PROJECT_ID}")"
VITE_FIREBASE_APP_ID="$(trim_value "${VITE_FIREBASE_APP_ID}")"

if [[ -z "${VITE_FIREBASE_API_KEY}" || "${VITE_FIREBASE_API_KEY}" == "SET_IN_CLOUD_BUILD_TRIGGER" ]]; then
  print -u2 "VITE_FIREBASE_API_KEY is required. Set it in ${CONFIG_FILE} or the environment."
  exit 1
fi

if [[ "${VITE_FIREBASE_API_KEY}" != AIza* ]]; then
  print -u2 "VITE_FIREBASE_API_KEY does not look like a Firebase Web API key."
  print -u2 "Current value starts with: ${VITE_FIREBASE_API_KEY[1,12]}"
  exit 1
fi

for name in VITE_FIREBASE_AUTH_DOMAIN VITE_FIREBASE_PROJECT_ID VITE_FIREBASE_APP_ID; do
  value="${(P)name}"
  if [[ -z "${value}" || "${value}" == "SET_IN_CLOUD_BUILD_TRIGGER" ]]; then
    print -u2 "${name} is required. Set it in ${CONFIG_FILE} or the environment."
    exit 1
  fi
done

if [[ "${SKIP_SETUP:-}" != "true" ]]; then
  PROJECT_ID="${PROJECT_ID}" \
  REGION="${REGION}" \
  AR_REPOSITORY="${AR_REPOSITORY}" \
  BUCKET="${BUCKET}" \
  BUILD_SA_NAME="${BUILD_SA%%@*}" \
  ./scripts/setup-gcp-deploy.zsh
fi

GIT_SHA="$(git rev-parse --short=12 HEAD 2>/dev/null || date -u +%Y%m%d%H%M%S)"
IMAGE_TAG="${IMAGE_TAG:-${GIT_SHA}}"
if ! git diff --quiet --ignore-submodules -- 2>/dev/null || ! git diff --cached --quiet --ignore-submodules -- 2>/dev/null; then
  IMAGE_TAG="${IMAGE_TAG}-dirty-$(date -u +%Y%m%d%H%M%S)"
fi

print "Submitting Cloud Build for ${SERVICE_NAME}:${IMAGE_TAG}"
gcloud builds submit . \
  --project "${PROJECT_ID}" \
  --config cloudbuild.yaml \
  --service-account "projects/${PROJECT_ID}/serviceAccounts/${BUILD_SA}" \
  --substitutions "_REGION=${REGION},_AR_REPOSITORY=${AR_REPOSITORY},_IMAGE_NAME=${IMAGE_NAME},_IMAGE_TAG=${IMAGE_TAG},_SERVICE_NAME=${SERVICE_NAME},_GCS_BUCKET=${BUCKET},_RUNTIME_SERVICE_ACCOUNT=${RUNTIME_SA},_VITE_FIREBASE_API_KEY=${VITE_FIREBASE_API_KEY},_VITE_FIREBASE_AUTH_DOMAIN=${VITE_FIREBASE_AUTH_DOMAIN},_VITE_FIREBASE_PROJECT_ID=${VITE_FIREBASE_PROJECT_ID},_VITE_FIREBASE_APP_ID=${VITE_FIREBASE_APP_ID}" \
  --quiet

SERVICE_URL="$(gcloud run services describe "${SERVICE_NAME}" \
  --project "${PROJECT_ID}" \
  --region "${REGION}" \
  --format='value(status.url)')"

print "Cloud Run URL: ${SERVICE_URL}"
PROJECT_ID="${PROJECT_ID}" REGION="${REGION}" SERVICE_NAME="${SERVICE_NAME}" ./scripts/verify-cloud-run.zsh "${SERVICE_URL}"
