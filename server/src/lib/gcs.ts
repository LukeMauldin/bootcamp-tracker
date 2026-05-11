import path from "node:path";
import type { Readable } from "node:stream";

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

export async function getSubmissionPhoto(objectPath: string): Promise<{
  readonly cacheControl: string | null;
  readonly contentLength: string | null;
  readonly contentType: string;
  readonly stream: Readable;
}> {
  const object = storage.bucket(getBucketName()).file(objectPath);
  const [metadata] = await object.getMetadata();

  return {
    cacheControl: typeof metadata.cacheControl === "string" ? metadata.cacheControl : null,
    contentLength: typeof metadata.size === "string" ? metadata.size : null,
    contentType: typeof metadata.contentType === "string" ? metadata.contentType : "application/octet-stream",
    stream: object.createReadStream()
  };
}
