# Lady Sentinels Finish Strong Bootcamp Tracker

Mobile-first web app for a 5-day basketball team challenge. Players register with a team join code, submit daily challenge evidence, upload verification photos, and track team standings. One coach verifies submissions and manages scoring.

The app is intentionally deployed as one Cloud Run service: Express serves the built React SPA and the `/api` routes.

## Stack

| Layer | Choice |
| --- | --- |
| Frontend | React 18, Vite, TypeScript, Tailwind CSS |
| Backend | Node.js 22, Express, TypeScript |
| Auth | Firebase Authentication, email/password |
| Database | Firestore Native mode |
| Object storage | Private Google Cloud Storage bucket |
| Runtime | Cloud Run |
| Build/deploy | Cloud Build, Artifact Registry |

## Project Resources

- GCP project: `ch-bootcamp-496001`
- Region: `us-central1`
- Upload bucket: `ch-bootcamp-496001-uploads`
- Artifact Registry repo: `app`
- Cloud Run service: `bootcamp-tracker`
- Runtime service account: `bootcamp-runtime@ch-bootcamp-496001.iam.gserviceaccount.com`

## Repository Layout

```text
.
├── client/                  # Vite React SPA
│   └── src/
├── server/                  # Express API and static SPA serving
│   └── src/
│       ├── data/            # challenges.json
│       ├── lib/             # Firestore, GCS, day helpers
│       ├── routes/          # API route modules
│       └── scripts/         # seed-teams and set-coach
├── shared/                  # Shared TypeScript types
├── scripts/provision-gcp.zsh
├── Dockerfile
├── cloudbuild.yaml
├── firebase.json
├── firestore.rules
└── package.json
```

## Local Setup

Install dependencies:

```bash
npm install
```

Create `client/.env.local` for local Vite dev. The same public values are also committed in `client/.env.production` for Cloud Build:

```env
VITE_FIREBASE_API_KEY=...
VITE_FIREBASE_AUTH_DOMAIN=ch-bootcamp-496001.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=ch-bootcamp-496001
VITE_FIREBASE_APP_ID=...
```

Set local backend environment:

```bash
export GOOGLE_CLOUD_PROJECT=ch-bootcamp-496001
export GCS_BUCKET=ch-bootcamp-496001-uploads
```

Start both apps:

```bash
npm run dev
```

URLs:

- Vite app: `http://localhost:5173`
- Express API: `http://localhost:8080`

Use `http://localhost:5173` during development. If you use `http://localhost:8080`, Express serves the built `client/dist`, so run `npm run build` first or you may see stale Firebase config.

## GCP Provisioning

Most project setup is captured in:

```bash
./scripts/provision-gcp.zsh
```

The script enables required APIs, attaches Firebase, checks Firebase Auth initialization, creates Firestore/GCS/Artifact Registry resources, creates service accounts, applies IAM, writes Firebase web config, and attempts to create the Cloud Build trigger.

Firebase Authentication may still require one manual console step:

1. Open Firebase Console for `ch-bootcamp-496001`.
2. Go to **Build → Authentication**.
3. Click **Get started**.
4. Enable **Email/Password** sign-in.
5. Rerun `./scripts/provision-gcp.zsh`.

Firestore rules intentionally deny all client access:

```js
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /{document=**} {
      allow read, write: if false;
    }
  }
}
```

All Firestore reads and writes go through Express using the Admin SDK.

## Bootstrap Data

Seed teams:

```bash
export GOOGLE_CLOUD_PROJECT=ch-bootcamp-496001
npm run seed
```

Join codes:

| Division | Team | Join code |
| --- | --- |
| High School | Team 1 | `LADY-NAVY-11` |
| High School | Team 2 | `LADY-GOLD-22` |
| High School | Team 3 | `LADY-RED-33` |
| High School | Team 4 | `LADY-WHITE-44` |
| High School | Team 5 | `LADY-GRAY-55` |
| Jr High | Team 10 | `LADY-JR-10` |
| Jr High | Team 11 | `LADY-JR-11` |
| Jr High | Team 12 | `LADY-JR-12` |
| Jr High | Team 13 | `LADY-JR-13` |

## Coach Access

Coach access is controlled by a Firebase custom claim:

```bash
export GOOGLE_CLOUD_PROJECT=ch-bootcamp-496001
npm run set-coach -- lukemauldin@gmail.com
```

The user must sign out and sign back in after the claim is set. The `/admin` route appears only after the refreshed ID token includes `role: "coach"`.

## Challenge Dates

The current challenge day is computed from `server/src/data/challenges.json`. Cloud Run runs in UTC, so server code uses the configured challenge timezone rather than `new Date()` directly.

For QA, simulate days with:

```bash
export CHALLENGE_DATE_OVERRIDE=2026-05-11
npm run dev
```

Restart the server after changing the override.

| Day | Override date |
| --- | --- |
| Monday | `2026-05-11` |
| Tuesday | `2026-05-12` |
| Wednesday | `2026-05-13` |
| Thursday | `2026-05-14` |
| Friday | `2026-05-15` |

## QA Checklist

Run against the real project. Database reset is optional and not required for normal QA passes.

- Register a player with a valid join code.
- Confirm invalid join code registration fails.
- Confirm player login and `/api/me` profile loading.
- Confirm Monday boolean and behavior submissions.
- Confirm Tuesday, Wednesday, and Thursday photo submissions.
- Confirm Friday behavior submission.
- Confirm player cannot access `/admin`.
- Confirm coach can access `/admin`.
- Confirm coach can verify for 5 points.
- Confirm coach can verify with 2 bonus points for 7 total.
- Confirm coach can reject and points stay 0.
- Confirm coach can add a negative manual adjustment.
- Confirm coach can move a player to another team.
- Confirm leaderboard includes only verified submissions plus adjustments.
- Confirm streak badge appears after two consecutive verified days.
- Confirm photo access works for submitter and coach only.

## Validation

Run after source changes:

```bash
npm run typecheck
npm run build
```

Container check:

```bash
docker build -t bootcamp-tracker .
docker run --rm -p 8080:8080 \
  -e GOOGLE_CLOUD_PROJECT=ch-bootcamp-496001 \
  -e GCS_BUCKET=ch-bootcamp-496001-uploads \
  bootcamp-tracker
```

## Deployment

Push to `main` after the Cloud Build GitHub trigger is connected. `cloudbuild.yaml` will:

1. Build the Docker image.
2. Push it to Artifact Registry.
3. Deploy `bootcamp-tracker` to Cloud Run.

Cloud Run is deployed with `--allow-unauthenticated`; application access is enforced by Firebase ID tokens in the Express API.

## Troubleshooting

### `auth/api-key-not-valid`

The browser is using stale or placeholder Firebase config.

- Check `client/.env.local`.
- Restart Vite.
- If serving from `8080`, rerun `npm run build`.

### `auth/configuration-not-found`

Firebase Authentication is not initialized.

- Open Firebase Console.
- Go to **Authentication → Get started**.
- Enable **Email/Password**.

### Firestore `5 NOT_FOUND`

The Firestore database probably does not exist or the Admin SDK is targeting the wrong project.

```bash
gcloud firestore databases list --project ch-bootcamp-496001
export GOOGLE_CLOUD_PROJECT=ch-bootcamp-496001
```

### Port `8080` already in use

```bash
lsof -nP -iTCP:8080 -sTCP:LISTEN
kill <pid>
```

### Vite env changes not reflected

Vite reads env files at startup. Stop and restart `npm run dev`.
