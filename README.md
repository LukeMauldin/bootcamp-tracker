# Lady Sentinels Finish Strong Bootcamp Tracker

Mobile-first challenge tracker for a 5-day basketball team bootcamp. One Cloud Run service serves the built React SPA and the Express `/api`.

## Stack

- React 18, Vite, TypeScript, Tailwind CSS
- Node.js 22, Express, TypeScript
- Firebase Authentication with email/password
- Firestore Native mode, accessed only through the backend
- Private Google Cloud Storage bucket for verification photos
- Cloud Build to Artifact Registry to Cloud Run

## Local Development

Install dependencies:

```bash
npm install
```

Create or update `client/.env.production` with the Firebase public web config. For local Vite, either export the same variables or create `client/.env.local`.

Run both apps:

```bash
npm run dev
```

The Vite dev server runs on `http://localhost:5173` and proxies `/api` to the Express server on `http://localhost:8080`.

Backend local runs use Application Default Credentials:

```bash
gcloud auth application-default login
export GCS_BUCKET=lady-sentinels-uploads
npm run dev -w server
```

## One-Time GCP Setup

1. Create a GCP project and link billing.
2. Enable `run.googleapis.com`, `cloudbuild.googleapis.com`, `artifactregistry.googleapis.com`, `firestore.googleapis.com`, `storage.googleapis.com`, `firebase.googleapis.com`, and `identitytoolkit.googleapis.com`.
3. Add Firebase to the project and enable Email/Password sign-in.
4. Create Firestore in Native mode.
5. Apply Firestore rules that deny all client access.
6. Create a private, uniform-access bucket named `lady-sentinels-uploads`.
7. Create an Artifact Registry Docker repository named `app` in `us-central1`.
8. Create `bootcamp-runtime@PROJECT_ID.iam.gserviceaccount.com` with Firestore, bucket object admin, Firebase Auth admin, and service-account token creator permissions.
9. Connect the GitHub repo to Cloud Build and create a trigger for `main` using `cloudbuild.yaml`.
10. Grant the Cloud Build service account Cloud Run admin, Artifact Registry writer, and service-account user on the runtime service account.

Firestore rules:

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

## Bootstrap

After credentials and Firestore are ready:

```bash
npm run seed
npm run set-coach -- coach@example.com
```

The coach must sign out and sign back in after the custom claim is set.

Seeded join codes:

- Lightning: `LADY-NAVY-11`
- Comets: `LADY-GOLD-22`
- Storm: `LADY-RED-33`
- Phoenix: `LADY-WHITE-44`
- Titans: `LADY-GRAY-55`

## Verification

```bash
npm run typecheck
npm run build
docker build -t bootcamp-tracker .
docker run --rm -p 8080:8080 -e GCS_BUCKET=lady-sentinels-uploads bootcamp-tracker
```

Use `CHALLENGE_DATE_OVERRIDE=2026-05-11` locally when testing the Monday challenge flow outside the event window.
