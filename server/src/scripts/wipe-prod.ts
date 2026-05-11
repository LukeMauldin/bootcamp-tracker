import { spawnSync } from "node:child_process";
import { createInterface } from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

import { Storage } from "@google-cloud/storage";

import { adminAuth, db } from "../lib/firestore.js";

const FIRESTORE_COLLECTIONS = ["submissions", "pointAdjustments", "users", "teams"] as const;
const GCS_PREFIX = "submissions/";

function parseConfirmFlag(argv: readonly string[]): string | null {
  for (const arg of argv) {
    if (arg.startsWith("--confirm=")) {
      return arg.slice("--confirm=".length);
    }
  }
  return null;
}

function resolveProjectId(): string {
  const projectId =
    process.env.GOOGLE_CLOUD_PROJECT ?? process.env.GCLOUD_PROJECT ?? process.env.GCP_PROJECT;
  if (!projectId) {
    throw new Error(
      "Project ID not set. Export GOOGLE_CLOUD_PROJECT (or GCLOUD_PROJECT / GCP_PROJECT) before running."
    );
  }
  return projectId;
}

function resolveBucketName(): string {
  const bucket = process.env.GCS_BUCKET;
  if (!bucket) {
    throw new Error("GCS_BUCKET is required");
  }
  return bucket;
}

async function countAuthUsers(): Promise<number> {
  let count = 0;
  let pageToken: string | undefined;
  do {
    const page = await adminAuth.listUsers(1000, pageToken);
    count += page.users.length;
    pageToken = page.pageToken;
  } while (pageToken);
  return count;
}

async function countCollection(name: string): Promise<number> {
  const snapshot = await db.collection(name).count().get();
  return snapshot.data().count;
}

async function countGcsObjects(bucketName: string): Promise<number> {
  const storage = new Storage();
  const [files] = await storage.bucket(bucketName).getFiles({ prefix: GCS_PREFIX });
  return files.length;
}

async function deleteAuthUsers(): Promise<{ deleted: number; failed: number }> {
  let deleted = 0;
  let failed = 0;

  while (true) {
    const page = await adminAuth.listUsers(1000);
    if (page.users.length === 0) break;

    const uids = page.users.map((u) => u.uid);
    const result = await adminAuth.deleteUsers(uids);
    deleted += result.successCount;
    failed += result.failureCount;

    if (result.failureCount > 0) {
      for (const err of result.errors) {
        const uid = uids[err.index] ?? "<unknown>";
        console.error(`  auth delete failed for uid=${uid}: ${err.error.message}`);
      }
      // Stop if no progress was made this iteration to avoid an infinite loop.
      if (result.successCount === 0) break;
    }
    console.log(`  deleted batch: success=${result.successCount} failed=${result.failureCount}`);
  }

  return { deleted, failed };
}

async function deleteCollection(name: string): Promise<number> {
  const bulkWriter = db.bulkWriter();
  let deleted = 0;
  bulkWriter.onWriteError((err) => {
    if (err.failedAttempts < 5) return true;
    console.error(`  bulkWriter failed on ${err.documentRef.path}: ${err.message}`);
    return false;
  });

  const stream = db.collection(name).select().stream();
  for await (const doc of stream as AsyncIterable<FirebaseFirestore.QueryDocumentSnapshot>) {
    void bulkWriter.delete(doc.ref);
    deleted += 1;
  }
  await bulkWriter.close();
  return deleted;
}

async function deleteGcsObjects(bucketName: string): Promise<number> {
  const storage = new Storage();
  const bucket = storage.bucket(bucketName);
  const [filesBefore] = await bucket.getFiles({ prefix: GCS_PREFIX });
  await bucket.deleteFiles({ prefix: GCS_PREFIX, force: true });
  return filesBefore.length;
}

async function confirmInteractive(prompt: string): Promise<boolean> {
  const rl = createInterface({ input, output });
  try {
    const answer = await rl.question(prompt);
    return answer === "yes";
  } finally {
    rl.close();
  }
}

async function main(): Promise<void> {
  const projectId = resolveProjectId();
  const bucketName = resolveBucketName();
  const confirmArg = parseConfirmFlag(process.argv.slice(2));

  if (confirmArg !== projectId) {
    console.error(
      `Refusing to run. Pass --confirm=${projectId} to acknowledge the target project.`
    );
    console.error(`  resolved projectId = ${projectId}`);
    console.error(`  --confirm received = ${confirmArg ?? "<none>"}`);
    process.exitCode = 1;
    return;
  }

  console.log(`Target project: ${projectId}`);
  console.log(`Target bucket:  ${bucketName}`);
  console.log("Counting existing data...");

  const [authCount, ...collectionCounts] = await Promise.all([
    countAuthUsers(),
    ...FIRESTORE_COLLECTIONS.map((name) => countCollection(name))
  ]);
  const gcsCount = await countGcsObjects(bucketName);

  console.log("");
  console.log("Pre-flight counts:");
  console.log(`  Firebase Auth users: ${authCount}`);
  FIRESTORE_COLLECTIONS.forEach((name, i) => {
    console.log(`  Firestore ${name}: ${collectionCounts[i] ?? 0}`);
  });
  console.log(`  GCS objects under ${GCS_PREFIX}: ${gcsCount}`);
  console.log("");

  const firestoreTotal = collectionCounts.reduce<number>((a, b) => a + (b ?? 0), 0);
  const totalToDelete = authCount + firestoreTotal + gcsCount;
  if (totalToDelete === 0) {
    console.log("Nothing to delete. Re-seeding teams.");
  } else {
    const ok = await confirmInteractive(
      `Type 'yes' to permanently delete the above from ${projectId}: `
    );
    if (!ok) {
      console.error("Aborted.");
      process.exitCode = 1;
      return;
    }
  }

  console.log("");
  console.log("Phase 1/4: Deleting Firebase Auth users...");
  const authResult = await deleteAuthUsers();
  console.log(`  total: deleted=${authResult.deleted} failed=${authResult.failed}`);

  console.log("");
  console.log("Phase 2/4: Deleting Firestore collections...");
  const firestoreDeleted: Record<string, number> = {};
  for (const name of FIRESTORE_COLLECTIONS) {
    const n = await deleteCollection(name);
    firestoreDeleted[name] = n;
    console.log(`  ${name}: ${n} docs deleted`);
  }

  console.log("");
  console.log(`Phase 3/4: Deleting GCS objects under ${GCS_PREFIX}...`);
  const gcsDeleted = await deleteGcsObjects(bucketName);
  console.log(`  ${gcsDeleted} objects deleted`);

  console.log("");
  const seedScript = resolve(dirname(fileURLToPath(import.meta.url)), "seed-teams.ts");
  console.log(`Phase 4/4: Re-seeding teams via tsx ${seedScript}...`);
  const seedResult = spawnSync("npx", ["tsx", seedScript], {
    stdio: "inherit",
    env: process.env
  });
  if (seedResult.status !== 0) {
    console.error("Seed step failed.");
    process.exitCode = seedResult.status ?? 1;
    return;
  }

  console.log("");
  console.log("Summary:");
  console.log(`  authDeleted: ${authResult.deleted} (failed: ${authResult.failed})`);
  for (const name of FIRESTORE_COLLECTIONS) {
    console.log(`  ${name}Deleted: ${firestoreDeleted[name]}`);
  }
  console.log(`  gcsObjectsDeleted: ${gcsDeleted}`);
  console.log(`  teamsSeeded: yes`);

  if (authResult.failed > 0) {
    process.exitCode = 1;
  }
}

await main();
