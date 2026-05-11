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

## Test Dates

The app computes the active challenge day from `server/src/data/challenges.json`. For QA, set:

```bash
export CHALLENGE_DATE_OVERRIDE=2026-05-11
```

Date mapping:

- Monday: `2026-05-11`
- Tuesday: `2026-05-12`
- Wednesday: `2026-05-13`
- Thursday: `2026-05-14`
- Friday: `2026-05-15`

Restart the server after changing `CHALLENGE_DATE_OVERRIDE`.

## Seeded Teams

Seed teams with:

```bash
export GOOGLE_CLOUD_PROJECT=ch-bootcamp-496001
npm run seed
```

Join codes:

- Lightning: `LADY-NAVY-11`
- Comets: `LADY-GOLD-22`
- Storm: `LADY-RED-33`
- Phoenix: `LADY-WHITE-44`
- Titans: `LADY-GRAY-55`

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
- Vite env values are read at startup; restart Vite after editing `client/.env.local`.
- Express on port `8080` serving `client/dist` can use stale config until `npm run build` is rerun.
- Firestore rules intentionally deny all client reads/writes.
- Player data isolation matters. Do not expose other players' photos to non-coaches.
- Photo paths in Firestore must remain GCS object paths, not signed URLs.
- Leaderboard totals should include verified submissions and point adjustments only.

## Deployment Notes

`cloudbuild.yaml` builds the Docker image, pushes it to Artifact Registry, and deploys Cloud Run with:

```text
GCS_BUCKET=ch-bootcamp-496001-uploads
TZ=UTC
```

App-level authentication is handled by Firebase ID tokens, so Cloud Run is deployed with `--allow-unauthenticated`.

## QA Expectations

When doing QA with Playwright/browser tools:

- Test as both player and coach.
- Use disposable emails such as `qa-player-<timestamp>@example.com`.
- Verify registration, login, daily submissions, photo upload, admin verification/rejection, manual adjustments, team moves, leaderboard changes, and streak behavior.
- If a code issue is clear and low risk, fix it and rerun focused validation.
- If product behavior is ambiguous, ask the user before changing it.
