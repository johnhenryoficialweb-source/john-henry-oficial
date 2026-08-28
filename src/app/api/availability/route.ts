import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { computeAvailableSlots } from "@/lib/appointments/availability";

const querySchema = z.object({
  location: z.enum(["CO", "PA"]),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Formato de fecha inválido (YYYY-MM-DD)."),
});

export async function GET(request: NextRequest) {
  const parsed = querySchema.safeParse({
    location: request.nextUrl.searchParams.get("location"),
    date: request.nextUrl.searchParams.get("date"),
  });

  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Parámetros inválidos." }, { status: 400 });
  }

  const admin = createAdminClient();
  const { data: location } = await admin
    .from("locations")
    .select("id, timezone")
    .eq("code", parsed.data.location)
    .eq("is_active", true)
    .single();

  if (!location) {
    return NextResponse.json({ error: "Sede no encontrada." }, { status: 404 });
  }

  const slots = await computeAvailableSlots({
    locationId: location.id,
    timezone: location.timezone,
    dateStr: parsed.data.date,
  });

  return NextResponse.json({ slots: slots.map((s) => s.toISOString()) });
}
