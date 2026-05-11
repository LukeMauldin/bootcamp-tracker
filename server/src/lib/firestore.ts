import { applicationDefault, getApps, initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { FieldValue, getFirestore, Timestamp } from "firebase-admin/firestore";

if (getApps().length === 0) {
  initializeApp({
    credential: applicationDefault()
  });
}

export const adminAuth = getAuth();
export const db = getFirestore();
export { FieldValue, Timestamp };
