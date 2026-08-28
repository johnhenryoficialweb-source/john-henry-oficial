import "server-only";
import { S3Client } from "@aws-sdk/client-s3";

/**
 * Cloudflare R2 expone una API compatible con S3. Reutilizamos el SDK de
 * AWS apuntando al endpoint de la cuenta de R2.
 */
export function createR2Client() {
  return new S3Client({
    region: "auto",
    endpoint: process.env.R2_ENDPOINT!,
    credentials: {
      accessKeyId: process.env.R2_ACCESS_KEY_ID!,
      secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
    },
  });
}

export function publicUrlForKey(key: string) {
  return `${process.env.R2_PUBLIC_URL_BASE}/${key}`;
}
