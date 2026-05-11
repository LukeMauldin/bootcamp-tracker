# AGENTS.md

## Project Context

This repo is the Lady Sentinels Finish Strong Bootcamp Tracker, a mobile-first 5-day basketball challenge app. It is intentionally small and production-only:

- One Express service serves both the built React SPA and `/api`.
- Firebase Authentication handles email/password login.
- Firestore is accessed only through the server Admin SDK.
- GCS stores private verification photos.
- Cloud Run is the production runtime.

The current production project is:

- GCP project: `ch-bootcamp-496001`
- Region: `us-central1`
- GCS bucket: `ch-bootcamp-496001-uploads`
- Runtime service account: `bootcamp-runtime@ch-bootcamp-496001.iam.gserviceaccount.com`

## Working Rules

- Treat the user as a senior engineer. Be concise and specific.
- Prefer narrow fixes over broad refactors.
- Preserve the existing TypeScript, React, Express, Firebase Admin, and Tailwind patterns.
- Do not reset, delete, or rewrite Firestore/GCS data unless explicitly asked.
- Do not make unrelated GCP/IAM changes.
- Do not commit unless the user asks.
- Use `rg` for search.
- Use `npm` workspaces; do not switch package managers.
- Use `apply_patch` or normal editor tools for source edits.

## Local Development

Use real Firebase/GCP resources, not emulators:

```bash
export GOOGLE_CLOUD_PROJECT=ch-bootcamp-496001
export GCS_BUCKET=ch-bootcamp-496001-uploads
npm run dev
```

The dev URLs are:

- Client: `http://localhost:5173`
- Server/API: `http://localhost:8080`

For local photo signed URL behavior, ADC may need runtime service account impersonation:

```bash
gcloud auth application-default login \
  --impersonate-service-account=bootcamp-runtime@ch-bootcamp-496001.iam.gserviceaccount.com
```

## QA Day Access

The app computes the active challenge day from `server/src/data/challenges.json`. For QA, open submissions for every challenge day with:

```bash
export CHALLENGE_OPEN_ALL_DAYS=true
```

When unset, submissions are open only for the locally computed challenge day. Restart the server after changing `CHALLENGE_OPEN_ALL_DAYS`.

## Seeded Teams

Seed teams with:

```bash
export GOOGLE_CLOUD_PROJECT=ch-bootcamp-496001
npm run seed
```

Join codes:

- High School Team 1: `LADY-NAVY-11`
- High School Team 2: `LADY-GOLD-22`
- High School Team 3: `LADY-RED-33`
- High School Team 4: `LADY-WHITE-44`
- High School Team 5: `LADY-GRAY-55`
- Jr High Team 10: `LADY-JR-10`
- Jr High Team 11: `LADY-JR-11`
- Jr High Team 12: `LADY-JR-12`
- Jr High Team 13: `LADY-JR-13`

## Coach Access

Coach authorization is a Firebase custom claim `role: "coach"`. The Firestore `users/{uid}.role` field is a display mirror only.

To grant coach access:

```bash
export GOOGLE_CLOUD_PROJECT=ch-bootcamp-496001
npm run set-coach -- lukemauldin@gmail.com
```

The user must sign out and sign back in after the claim is set.

## Validation Commands

Run these after code changes:

```bash
npm run typecheck
npm run build
```

For deployment-shape validation:

```bash
docker build -t bootcamp-tracker .
docker run --rm -p 8080:8080 \
  -e GOOGLE_CLOUD_PROJECT=ch-bootcamp-496001 \
  -e GCS_BUCKET=ch-bootcamp-496001-uploads \
  bootcamp-tracker
```

## High-Risk Areas

- Firebase Auth must be initialized in Firebase Console before email/password works.
- The frontend should use the manual API key named `Bootcamp tracker web Firebase Auth key`; it is restricted to Firebase Auth APIs and the Cloud Run/localhost referrers.
- Do not use `firebase apps:sdkconfig` as the source of truth for `VITE_FIREBASE_API_KEY`; it may return or recreate a broader Firebase-managed web key.
- Vite env values are read at startup; restart Vite after editing `client/.env.local`.
- Express on port `8080` serving `client/dist` can use stale config until `npm run build` is rerun.
- Firestore rules intentionally deny all client reads/writes.
- Player data isolation matters. Do not expose other players' photos to non-coaches.
- Photo paths in Firestore must remain GCS object paths, not signed URLs.
- Leaderboard totals should include verified submissions and point adjustments only.

## Deployment Notes

Production deploys use Cloud Build and Cloud Run:

```bash
npm run deploy
```

Useful lower-level commands:

```bash
npm run deploy:setup
npm run deploy:verify
```

`scripts/setup-gcp-deploy.zsh` is idempotent and ensures the deploy prerequisites exist:

- Artifact Registry repo: `app`
- Cloud Run service: `bootcamp-tracker`
- Runtime service account: `bootcamp-runtime@ch-bootcamp-496001.iam.gserviceaccount.com`
- Build service account: `bootcamp-builder@ch-bootcamp-496001.iam.gserviceaccount.com`

`cloudbuild.yaml` builds the Docker image, pushes it to Artifact Registry, deploys Cloud Run, and explicitly grants public invoker access. The service runs with:

```text
GOOGLE_CLOUD_PROJECT=ch-bootcamp-496001
GCS_BUCKET=ch-bootcamp-496001-uploads
TZ=UTC
```

App-level authentication is handled by Firebase ID tokens, so Cloud Run is public at the platform layer (`allUsers` with `roles/run.invoker`). Current deployed URL:

```text
https://bootcamp-tracker-jl7eg5xtqq-uc.a.run.app
```

For a nicer URL, prefer a custom domain through Cloud Run domain mapping for a low-overhead/simple deployment, or an external HTTPS load balancer with a serverless NEG when production-grade edge controls, Cloud Armor, custom TLS policy, or blocking the default Cloud Run URL matter.

## QA Expectations

When doing QA with Playwright/browser tools:

- Test as both player and coach.
- Use disposable emails such as `qa-player-<timestamp>@example.com`.
- Verify registration, login, daily submissions, photo upload, admin verification/rejection, manual adjustments, team moves, leaderboard changes, and streak behavior.
- If a code issue is clear and low risk, fix it and rerun focused validation.
- If product behavior is ambiguous, ask the user before changing it.
