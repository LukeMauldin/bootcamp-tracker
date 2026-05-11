#!/usr/bin/env zsh
set -euo pipefail

PROJECT_ID="${PROJECT_ID:-ch-bootcamp-496001}"
REGION="${REGION:-us-central1}"
AR_REPOSITORY="${AR_REPOSITORY:-app}"
BUCKET="${BUCKET:-ch-bootcamp-496001-uploads}"
RUNTIME_SA_NAME="${RUNTIME_SA_NAME:-bootcamp-runtime}"
BUILD_SA_NAME="${BUILD_SA_NAME:-bootcamp-builder}"
RUNTIME_SA="${RUNTIME_SA_NAME}@${PROJECT_ID}.iam.gserviceaccount.com"
BUILD_SA="${BUILD_SA_NAME}@${PROJECT_ID}.iam.gserviceaccount.com"

require() {
  if ! command -v "$1" >/dev/null 2>&1; then
    print -u2 "Missing required command: $1"
    exit 1
  fi
}

ensure_project_role() {
  local member="$1"
  local role="$2"

  print "Ensuring ${role} on ${PROJECT_ID} for ${member}"
  gcloud projects add-iam-policy-binding "${PROJECT_ID}" \
    --member "${member}" \
    --role "${role}" \
    --quiet >/dev/null
}

ensure_service_account_binding() {
  local service_account="$1"
  local member="$2"
  local role="$3"

  print "Ensuring ${role} on ${service_account} for ${member}"
  gcloud iam service-accounts add-iam-policy-binding "${service_account}" \
    --project "${PROJECT_ID}" \
    --member "${member}" \
    --role "${role}" \
    --quiet >/dev/null
}

require gcloud

gcloud config set project "${PROJECT_ID}" >/dev/null
PROJECT_NUMBER="$(gcloud projects describe "${PROJECT_ID}" --format='value(projectNumber)')"
ACTIVE_ACCOUNT="$(gcloud config get-value account 2>/dev/null || true)"

print "Enabling required APIs for ${PROJECT_ID}"
gcloud services enable \
  run.googleapis.com \
  cloudbuild.googleapis.com \
  artifactregistry.googleapis.com \
  firestore.googleapis.com \
  storage.googleapis.com \
  identitytoolkit.googleapis.com \
  iamcredentials.googleapis.com \
  --project "${PROJECT_ID}" \
  --quiet

print "Ensuring Artifact Registry repository ${AR_REPOSITORY}"
if ! gcloud artifacts repositories describe "${AR_REPOSITORY}" \
  --location "${REGION}" \
  --project "${PROJECT_ID}" >/dev/null 2>&1; then
  gcloud artifacts repositories create "${AR_REPOSITORY}" \
    --project "${PROJECT_ID}" \
    --location "${REGION}" \
    --repository-format docker \
    --description "Bootcamp tracker containers" \
    --quiet
fi

print "Ensuring private uploads bucket gs://${BUCKET}"
if ! gcloud storage buckets describe "gs://${BUCKET}" --project "${PROJECT_ID}" >/dev/null 2>&1; then
  gcloud storage buckets create "gs://${BUCKET}" \
    --project "${PROJECT_ID}" \
    --location "${REGION}" \
    --uniform-bucket-level-access \
    --public-access-prevention \
    --quiet
else
  gcloud storage buckets update "gs://${BUCKET}" \
    --project "${PROJECT_ID}" \
    --uniform-bucket-level-access \
    --public-access-prevention \
    --quiet >/dev/null
fi

print "Ensuring runtime service account ${RUNTIME_SA}"
if ! gcloud iam service-accounts describe "${RUNTIME_SA}" --project "${PROJECT_ID}" >/dev/null 2>&1; then
  gcloud iam service-accounts create "${RUNTIME_SA_NAME}" \
    --project "${PROJECT_ID}" \
    --display-name "Bootcamp runtime" \
    --quiet
fi

print "Ensuring build service account ${BUILD_SA}"
if ! gcloud iam service-accounts describe "${BUILD_SA}" --project "${PROJECT_ID}" >/dev/null 2>&1; then
  gcloud iam service-accounts create "${BUILD_SA_NAME}" \
    --project "${PROJECT_ID}" \
    --display-name "Bootcamp Cloud Build deployer" \
    --quiet
fi

ensure_project_role "serviceAccount:${RUNTIME_SA}" roles/datastore.user
ensure_project_role "serviceAccount:${RUNTIME_SA}" roles/firebaseauth.admin

print "Ensuring bucket object access for ${RUNTIME_SA}"
gcloud storage buckets add-iam-policy-binding "gs://${BUCKET}" \
  --project "${PROJECT_ID}" \
  --member "serviceAccount:${RUNTIME_SA}" \
  --role roles/storage.objectAdmin \
  --quiet >/dev/null

ensure_project_role "serviceAccount:${BUILD_SA}" roles/logging.logWriter
ensure_project_role "serviceAccount:${BUILD_SA}" roles/run.admin

print "Ensuring Artifact Registry writer for Cloud Build"
gcloud artifacts repositories add-iam-policy-binding "${AR_REPOSITORY}" \
  --location "${REGION}" \
  --project "${PROJECT_ID}" \
  --member "serviceAccount:${BUILD_SA}" \
  --role roles/artifactregistry.writer \
  --quiet >/dev/null

if gcloud storage buckets describe "gs://${PROJECT_ID}_cloudbuild" --project "${PROJECT_ID}" >/dev/null 2>&1; then
  print "Ensuring Cloud Build source bucket read access for ${BUILD_SA}"
  gcloud storage buckets add-iam-policy-binding "gs://${PROJECT_ID}_cloudbuild" \
    --project "${PROJECT_ID}" \
    --member "serviceAccount:${BUILD_SA}" \
    --role roles/storage.objectViewer \
    --quiet >/dev/null
fi

ensure_service_account_binding "${RUNTIME_SA}" "serviceAccount:${BUILD_SA}" roles/iam.serviceAccountUser

if [[ -n "${ACTIVE_ACCOUNT}" ]]; then
  ensure_service_account_binding "${BUILD_SA}" "user:${ACTIVE_ACCOUNT}" roles/iam.serviceAccountUser
fi

cat <<EOF

Deployment prerequisites are ready.

Project: ${PROJECT_ID}
Region: ${REGION}
Artifact Registry repo: ${AR_REPOSITORY}
Uploads bucket: gs://${BUCKET}
Runtime service account: ${RUNTIME_SA}
Cloud Build service account: ${BUILD_SA}
EOF
