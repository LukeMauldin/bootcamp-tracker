#!/usr/bin/env zsh
set -euo pipefail

PROJECT_ID="${PROJECT_ID:-ch-bootcamp-496001}"
REGION="${REGION:-us-central1}"
AR_REPOSITORY="${AR_REPOSITORY:-app}"
SERVICE_NAME="${SERVICE_NAME:-bootcamp-tracker}"
BUCKET="${BUCKET:-ch-bootcamp-496001-uploads}"
RUNTIME_SA_NAME="${RUNTIME_SA_NAME:-bootcamp-runtime}"
WEB_APP_DISPLAY="${WEB_APP_DISPLAY:-Bootcamp Tracker Web}"
WEB_API_KEY_DISPLAY="${WEB_API_KEY_DISPLAY:-Bootcamp tracker web Firebase Auth key}"
GITHUB_OWNER="${GITHUB_OWNER:-LukeMauldin}"
GITHUB_REPO="${GITHUB_REPO:-bootcamp-tracker}"
FIREBASE_ACCOUNT="${FIREBASE_ACCOUNT:-lukemauldin@gmail.com}"

RUNTIME_SA="${RUNTIME_SA_NAME}@${PROJECT_ID}.iam.gserviceaccount.com"

require() {
  if ! command -v "$1" >/dev/null 2>&1; then
    print -u2 "Missing required command: $1"
    exit 1
  fi
}

require gcloud
require firebase
require jq
require curl

gcloud config set project "${PROJECT_ID}" >/dev/null

PROJECT_NUMBER="$(gcloud projects describe "${PROJECT_ID}" --format='value(projectNumber)')"
ACTIVE_ACCOUNT="$(gcloud config get-value account)"
CB_SA="${PROJECT_NUMBER}@cloudbuild.gserviceaccount.com"

print "Enabling APIs for ${PROJECT_ID}"
gcloud services enable \
  run.googleapis.com \
  cloudbuild.googleapis.com \
  artifactregistry.googleapis.com \
  firestore.googleapis.com \
  storage.googleapis.com \
  firebase.googleapis.com \
  identitytoolkit.googleapis.com \
  iamcredentials.googleapis.com \
  --project "${PROJECT_ID}"

print "Attaching Firebase to ${PROJECT_ID}"
if ! firebase login:list | grep -q "${FIREBASE_ACCOUNT}"; then
  print -u2 "Firebase CLI is not logged in as ${FIREBASE_ACCOUNT}."
  print -u2 "Run: firebase login:add ${FIREBASE_ACCOUNT}"
  print -u2 "Then: firebase login:use ${FIREBASE_ACCOUNT}"
  exit 1
fi
firebase login:use "${FIREBASE_ACCOUNT}" >/dev/null
if ! firebase projects:list --account "${FIREBASE_ACCOUNT}" --json | jq -e --arg project "${PROJECT_ID}" '.result[]? | select(.projectId == $project)' >/dev/null; then
  firebase projects:addfirebase "${PROJECT_ID}" --account "${FIREBASE_ACCOUNT}"
fi

print "Enabling Firebase Auth email/password"
ACCESS_TOKEN="$(gcloud auth print-access-token)"
AUTH_CONFIG_STATUS="$(curl -sS -o /tmp/bootcamp-auth-config.json -w "%{http_code}" \
  -H "Authorization: Bearer ${ACCESS_TOKEN}" \
  -H "x-goog-user-project: ${PROJECT_ID}" \
  "https://identitytoolkit.googleapis.com/admin/v2/projects/${PROJECT_ID}/config")"
if [[ "${AUTH_CONFIG_STATUS}" == "404" ]] && grep -q "CONFIGURATION_NOT_FOUND" /tmp/bootcamp-auth-config.json; then
  print -u2 "Firebase Authentication is not initialized for ${PROJECT_ID}."
  print -u2 "Open Firebase Console -> Authentication -> Get started, then enable Email/Password and rerun this script."
  exit 1
fi
curl -fsS -X PATCH \
  "https://identitytoolkit.googleapis.com/admin/v2/projects/${PROJECT_ID}/config?updateMask=signIn.email.enabled,signIn.email.passwordRequired" \
  -H "Authorization: Bearer ${ACCESS_TOKEN}" \
  -H "x-goog-user-project: ${PROJECT_ID}" \
  -H "Content-Type: application/json" \
  -d '{"signIn":{"email":{"enabled":true,"passwordRequired":true}}}' >/dev/null
rm -f /tmp/bootcamp-auth-config.json

print "Creating Firestore database if needed"
if ! gcloud firestore databases describe --database='(default)' --project "${PROJECT_ID}" >/dev/null 2>&1; then
  gcloud firestore databases create \
    --database='(default)' \
    --location="${REGION}" \
    --type=firestore-native \
    --project "${PROJECT_ID}"
fi

print "Deploying locked-down Firestore rules"
firebase deploy --only firestore:rules --project "${PROJECT_ID}" --account "${FIREBASE_ACCOUNT}"

print "Creating private GCS bucket if needed: gs://${BUCKET}"
if ! gcloud storage buckets describe "gs://${BUCKET}" --project "${PROJECT_ID}" >/dev/null 2>&1; then
  gcloud storage buckets create "gs://${BUCKET}" \
    --project "${PROJECT_ID}" \
    --location "${REGION}" \
    --uniform-bucket-level-access
fi
gcloud storage buckets update "gs://${BUCKET}" --public-access-prevention=enforced

print "Creating Artifact Registry Docker repository if needed"
if ! gcloud artifacts repositories describe "${AR_REPOSITORY}" --location "${REGION}" --project "${PROJECT_ID}" >/dev/null 2>&1; then
  gcloud artifacts repositories create "${AR_REPOSITORY}" \
    --project "${PROJECT_ID}" \
    --location "${REGION}" \
    --repository-format docker \
    --description "Bootcamp tracker containers"
fi

print "Creating runtime service account if needed: ${RUNTIME_SA}"
if ! gcloud iam service-accounts describe "${RUNTIME_SA}" --project "${PROJECT_ID}" >/dev/null 2>&1; then
  gcloud iam service-accounts create "${RUNTIME_SA_NAME}" \
    --project "${PROJECT_ID}" \
    --display-name "Bootcamp runtime"
fi

print "Granting runtime service account permissions"
gcloud projects add-iam-policy-binding "${PROJECT_ID}" \
  --member "serviceAccount:${RUNTIME_SA}" \
  --role roles/datastore.user >/dev/null
gcloud projects add-iam-policy-binding "${PROJECT_ID}" \
  --member "serviceAccount:${RUNTIME_SA}" \
  --role roles/firebaseauth.admin >/dev/null
gcloud storage buckets add-iam-policy-binding "gs://${BUCKET}" \
  --member "serviceAccount:${RUNTIME_SA}" \
  --role roles/storage.objectAdmin >/dev/null
gcloud iam service-accounts add-iam-policy-binding "${RUNTIME_SA}" \
  --member "serviceAccount:${RUNTIME_SA}" \
  --role roles/iam.serviceAccountTokenCreator >/dev/null
gcloud iam service-accounts add-iam-policy-binding "${RUNTIME_SA}" \
  --member "user:${ACTIVE_ACCOUNT}" \
  --role roles/iam.serviceAccountTokenCreator >/dev/null

print "Granting Cloud Build deploy permissions"
gcloud projects add-iam-policy-binding "${PROJECT_ID}" \
  --member "serviceAccount:${CB_SA}" \
  --role roles/run.admin >/dev/null
gcloud artifacts repositories add-iam-policy-binding "${AR_REPOSITORY}" \
  --location "${REGION}" \
  --project "${PROJECT_ID}" \
  --member "serviceAccount:${CB_SA}" \
  --role roles/artifactregistry.writer >/dev/null
gcloud iam service-accounts add-iam-policy-binding "${RUNTIME_SA}" \
  --member "serviceAccount:${CB_SA}" \
  --role roles/iam.serviceAccountUser >/dev/null

print "Creating or finding Firebase Web app"
WEB_APP_ID="$(firebase apps:list WEB --project "${PROJECT_ID}" --account "${FIREBASE_ACCOUNT}" --json | jq -r --arg display "${WEB_APP_DISPLAY}" '.result[]? | select(.displayName == $display) | .appId' | head -n 1)"
if [[ -z "${WEB_APP_ID}" ]]; then
  firebase apps:create WEB "${WEB_APP_DISPLAY}" --project "${PROJECT_ID}" --account "${FIREBASE_ACCOUNT}" >/dev/null
  WEB_APP_ID="$(firebase apps:list WEB --project "${PROJECT_ID}" --account "${FIREBASE_ACCOUNT}" --json | jq -r --arg display "${WEB_APP_DISPLAY}" '.result[]? | select(.displayName == $display) | .appId' | head -n 1)"
fi
if [[ -z "${WEB_APP_ID}" ]]; then
  print -u2 "Could not determine Firebase Web app ID"
  exit 1
fi

print "Finding Firebase Auth web API key"
WEB_API_KEY_NAME="$(gcloud services api-keys list --project "${PROJECT_ID}" --format=json | jq -r --arg display "${WEB_API_KEY_DISPLAY}" '.[]? | select(.displayName == $display) | .name' | head -n 1)"
if [[ -z "${WEB_API_KEY_NAME}" ]]; then
  print -u2 "Could not find API key named: ${WEB_API_KEY_DISPLAY}"
  print -u2 "Create the auth-only web key first, then rerun this script."
  exit 1
fi
WEB_API_KEY="$(gcloud services api-keys get-key-string "${WEB_API_KEY_NAME}" --project "${PROJECT_ID}" --format='value(keyString)')"

print "Writing Firebase web config to client/.env.local and client/.env.production"
{
  print "VITE_FIREBASE_API_KEY=${WEB_API_KEY}"
  print "VITE_FIREBASE_AUTH_DOMAIN=${PROJECT_ID}.firebaseapp.com"
  print "VITE_FIREBASE_PROJECT_ID=${PROJECT_ID}"
  print "VITE_FIREBASE_APP_ID=${WEB_APP_ID}"
} > client/.env.local
cp client/.env.local client/.env.production

print "Creating Cloud Build GitHub trigger if the GitHub App connection is already available"
if ! gcloud builds triggers list --project "${PROJECT_ID}" --format='value(name)' | grep -qx "${SERVICE_NAME}-main"; then
  gcloud builds triggers create github \
    --project "${PROJECT_ID}" \
    --name "${SERVICE_NAME}-main" \
    --repo-owner "${GITHUB_OWNER}" \
    --repo-name "${GITHUB_REPO}" \
    --branch-pattern '^main$' \
    --build-config cloudbuild.yaml \
    --include-logs-with-status || {
      print -u2 "Cloud Build trigger creation failed. Connect the GitHub repo in Cloud Build, then rerun this script."
    }
fi

print "Setting local ADC quota project"
gcloud auth application-default set-quota-project "${PROJECT_ID}" || true

cat <<EOF

Provisioning complete or as complete as the available integrations allow.

Project: ${PROJECT_ID}
Bucket: gs://${BUCKET}
Runtime service account: ${RUNTIME_SA}
Firebase web app: ${WEB_APP_ID}

For local signed-URL testing, run:
  gcloud auth application-default login --impersonate-service-account=${RUNTIME_SA}
  export GOOGLE_CLOUD_PROJECT=${PROJECT_ID}
  export GCS_BUCKET=${BUCKET}
  npm run dev

After Firestore is ready:
  npm run seed
  npm run set-coach -- coach@example.com
EOF
