import { applicationDefault, getApps, initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { FieldValue, getFirestore, Timestamp } from "firebase-admin/firestore";

if (getApps().length === 0) {
  const projectId = process.env.GOOGLE_CLOUD_PROJECT ?? process.env.GCLOUD_PROJECT ?? process.env.GCP_PROJECT;

  initializeApp({
    credential: applicationDefault(),
    ...(projectId ? { projectId } : {})
  });
}

export const adminAuth = getAuth();
export const db = getFirestore();
export { FieldValue, Timestamp };
