import "server-only";
import { PutObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { createR2Client } from "./client";

const PRESIGN_EXPIRES_SECONDS = 60 * 5;

/**
 * Genera una URL prefirmada para que el cliente suba directo a R2
 * (fotos de telas, trabajos, clientes) sin pasar el binario por el server.
 */
export async function createPresignedUploadUrl(params: {
  key: string;
  contentType: string;
}) {
  const client = createR2Client();

  const command = new PutObjectCommand({
    Bucket: process.env.R2_BUCKET_NAME!,
    Key: params.key,
    ContentType: params.contentType,
  });

  const uploadUrl = await getSignedUrl(client, command, {
    expiresIn: PRESIGN_EXPIRES_SECONDS,
  });

  return { uploadUrl, key: params.key };
}
