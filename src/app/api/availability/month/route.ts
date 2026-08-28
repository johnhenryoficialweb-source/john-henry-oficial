import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { computeAvailableSlots } from "@/lib/appointments/availability";

const querySchema = z.object({
  location: z.enum(["CO", "PA"]),
  year: z.coerce.number().int().min(2020).max(2100),
  month: z.coerce.number().int().min(1).max(12),
});

/**
 * Disponibilidad de un mes completo, para pintar el calendario (días con/sin
 * cupo) sin tener que pedir día por día desde el cliente. Corre
 * computeAvailableSlots por cada día del mes en paralelo — dos queries
 * livianas por día, aceptable a la escala de una sastrería boutique.
 */
export async function GET(request: NextRequest) {
  const parsed = querySchema.safeParse({
    location: request.nextUrl.searchParams.get("location"),
    year: request.nextUrl.searchParams.get("year"),
    month: request.nextUrl.searchParams.get("month"),
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

  const { year, month } = parsed.data;
  const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const todayStr = new Date().toISOString().slice(0, 10);

  const dateStrs = Array.from({ length: daysInMonth }, (_, i) => {
    const day = String(i + 1).padStart(2, "0");
    return `${year}-${String(month).padStart(2, "0")}-${day}`;
  }).filter((d) => d >= todayStr);

  const results = await Promise.all(
    dateStrs.map(async (dateStr) => {
      const slots = await computeAvailableSlots({ locationId: location.id, timezone: location.timezone, dateStr });
      return [dateStr, slots.length > 0] as const;
    }),
  );

  const availableDates = results.filter(([, hasSlots]) => hasSlots).map(([dateStr]) => dateStr);

  return NextResponse.json({ availableDates });
}
