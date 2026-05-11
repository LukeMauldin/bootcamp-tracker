import path from "node:path";

import { Storage } from "@google-cloud/storage";

const storage = new Storage();

function getBucketName(): string {
  const bucket = process.env.GCS_BUCKET;
  if (!bucket) {
    throw new Error("GCS_BUCKET is required");
  }
  return bucket;
}

function sanitizeFilename(filename: string): string {
  const parsed = path.parse(filename);
  const base = parsed.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "photo";
  const ext = parsed.ext.toLowerCase().replace(/[^a-z0-9.]/g, "");
  return `${base}${ext}`;
}

export async function uploadSubmissionPhoto(params: {
  readonly uid: string;
  readonly challengeId: string;
  readonly file: Express.Multer.File;
}): Promise<string> {
  const bucket = storage.bucket(getBucketName());
  const filename = `${Date.now()}-${sanitizeFilename(params.file.originalname)}`;
  const objectPath = `submissions/${params.uid}/${params.challengeId}/${filename}`;
  const object = bucket.file(objectPath);

  await object.save(params.file.buffer, {
    contentType: params.file.mimetype,
    resumable: false,
    metadata: {
      cacheControl: "private, max-age=300"
    }
  });

  return objectPath;
}

export async function createSignedReadUrl(objectPath: string): Promise<string> {
  const [url] = await storage.bucket(getBucketName()).file(objectPath).getSignedUrl({
    action: "read",
    expires: Date.now() + 5 * 60 * 1000,
    version: "v4"
  });
  return url;
}
