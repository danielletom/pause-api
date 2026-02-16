/**
 * Cloudflare R2 storage client (S3-compatible).
 * Used for uploading final audio files.
 */

import fs from "fs";
import path from "path";
import { S3Client, PutObjectCommand, HeadObjectCommand } from "@aws-sdk/client-s3";
import { r2 as config } from "../config";

let client: S3Client | null = null;

function getClient(): S3Client {
  if (!client) {
    if (!config.accessKeyId || !config.secretAccessKey || !config.endpoint) {
      throw new Error("R2 not configured — set R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY");
    }
    client = new S3Client({
      region: "auto",
      endpoint: config.endpoint,
      credentials: {
        accessKeyId: config.accessKeyId,
        secretAccessKey: config.secretAccessKey,
      },
    });
  }
  return client;
}

/**
 * Upload a file to R2.
 * Returns the public URL.
 */
export async function uploadFile(
  localPath: string,
  key: string,
  contentType: string = "audio/mpeg"
): Promise<string> {
  const s3 = getClient();
  const body = fs.readFileSync(localPath);

  await s3.send(
    new PutObjectCommand({
      Bucket: config.bucket,
      Key: key,
      Body: body,
      ContentType: contentType,
    })
  );

  return `${config.publicUrl}/${key}`;
}

/**
 * Upload an audio file with a standardized key structure.
 * Key format: audio/{contentType}/{slug}.mp3
 */
export async function uploadAudio(
  localPath: string,
  contentType: string,
  slug: string
): Promise<string> {
  const key = `audio/${contentType}/${slug}.mp3`;
  return uploadFile(localPath, key, "audio/mpeg");
}

/**
 * Upload a PDF guide.
 * Key format: guides/{slug}.pdf
 */
export async function uploadPdf(localPath: string, slug: string): Promise<string> {
  const key = `guides/${slug}.pdf`;
  return uploadFile(localPath, key, "application/pdf");
}

/**
 * Check if a file already exists in R2.
 */
export async function fileExists(key: string): Promise<boolean> {
  const s3 = getClient();
  try {
    await s3.send(
      new HeadObjectCommand({
        Bucket: config.bucket,
        Key: key,
      })
    );
    return true;
  } catch {
    return false;
  }
}
