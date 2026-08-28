import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { randomUUID } from "crypto";
import { getStaffSession } from "@/lib/auth/roles";
import { createPresignedUploadUrl } from "@/lib/r2/presign";
import { publicUrlForKey } from "@/lib/r2/client";

const ALLOWED_PREFIXES = ["fabrics", "clients", "orders", "gallery", "site"] as const;

const bodySchema = z.object({
  prefix: z.enum(ALLOWED_PREFIXES),
  fileName: z.string().min(1),
  contentType: z.string().min(1),
});

export async function POST(request: NextRequest) {
  const session = await getStaffSession();
  if (!session) return NextResponse.json({ error: "No autorizado." }, { status: 401 });

  const body = await request.json().catch(() => null);
  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Datos inválidos." }, { status: 400 });
  }

  const { prefix, fileName, contentType } = parsed.data;
  const safeExtension = fileName.split(".").pop()?.toLowerCase().replace(/[^a-z0-9]/g, "") || "bin";
  const key = `${prefix}/${randomUUID()}.${safeExtension}`;

  const { uploadUrl } = await createPresignedUploadUrl({ key, contentType });

  return NextResponse.json({ uploadUrl, key, publicUrl: publicUrlForKey(key) });
}
