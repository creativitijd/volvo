import "server-only";
import { DeleteObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";

function required(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Ontbrekende variabele ${name}`);
  return value;
}

function client() {
  return new S3Client({
    region: process.env.S3_REGION || "auto",
    endpoint: required("S3_ENDPOINT"),
    forcePathStyle: true,
    credentials: {
      accessKeyId: required("S3_ACCESS_KEY_ID"),
      secretAccessKey: required("S3_SECRET_ACCESS_KEY"),
    },
  });
}

function publicBase(): string {
  const bucket = required("S3_BUCKET_NAME");
  return (process.env.S3_PUBLIC_URL || `https://${bucket}.sevalla.storage`).replace(/\/$/, "");
}

export function publicPhotoUrl(key: string): string {
  return `${publicBase()}/${key}`;
}

export function photoKeyFromUrl(url: string): string | null {
  const base = `${publicBase()}/`;
  if (!url.startsWith(base)) return null;
  const key = decodeURIComponent(url.slice(base.length));
  return key && !key.includes("..") ? key : null;
}

export async function putPhoto(key: string, body: Uint8Array): Promise<string> {
  await client().send(
    new PutObjectCommand({
      Bucket: required("S3_BUCKET_NAME"),
      Key: key,
      Body: body,
      ContentType: "image/jpeg",
      CacheControl: "public, max-age=31536000, immutable",
    }),
  );
  return publicPhotoUrl(key);
}

export async function removePhoto(key: string): Promise<void> {
  await client().send(
    new DeleteObjectCommand({
      Bucket: required("S3_BUCKET_NAME"),
      Key: key,
    }),
  );
}
