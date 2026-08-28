import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { dayOfWeekForDateString, zonedTimeToUtc } from "@/lib/datetime/timezone";

export interface AvailabilityWindow {
  startTime: string; // "HH:mm:ss"
  endTime: string;
  slotDurationMinutes: number;
  isBlocked: boolean;
}

/**
 * Huecos libres = ventanas abiertas (recurrentes por día de semana o
 * excepción puntual) - ventanas bloqueadas (feriados/vacaciones) - citas
 * ya existentes que se solapan. Ver supabase/migrations/0012_*.sql.
 */
export async function computeAvailableSlots(params: {
  locationId: string;
  timezone: string;
  dateStr: string; // "YYYY-MM-DD"
}): Promise<Date[]> {
  const { locationId, timezone, dateStr } = params;
  const admin = createAdminClient();
  const dow = dayOfWeekForDateString(dateStr);

  const { data: rules } = await admin
    .from("availability_slots")
    .select("day_of_week, specific_date, start_time, end_time, slot_duration_minutes, is_blocked")
    .eq("location_id", locationId)
    .or(`day_of_week.eq.${dow},specific_date.eq.${dateStr}`);

  const openWindows = (rules ?? []).filter((r) => !r.is_blocked);
  const blockedWindows = (rules ?? []).filter((r) => r.is_blocked);

  const dayStartUtc = zonedTimeToUtc(dateStr, "00:00", timezone);
  const dayEndUtc = zonedTimeToUtc(dateStr, "23:59", timezone);

  const { data: appointments } = await admin
    .from("appointments")
    .select("starts_at, ends_at")
    .eq("location_id", locationId)
    .neq("status", "cancelled")
    .gte("starts_at", dayStartUtc.toISOString())
    .lte("starts_at", dayEndUtc.toISOString());

  const busyRanges = (appointments ?? []).map((a) => ({
    start: new Date(a.starts_at),
    end: new Date(a.ends_at),
  }));

  const now = new Date();
  const candidates: Date[] = [];

  for (const window of openWindows) {
    const stepMinutes = window.slot_duration_minutes;
    const [startH, startM] = window.start_time.split(":").map(Number);
    const [endH, endM] = window.end_time.split(":").map(Number);
    const startTotalMin = startH * 60 + startM;
    const endTotalMin = endH * 60 + endM;

    for (let t = startTotalMin; t + stepMinutes <= endTotalMin; t += stepMinutes) {
      const hh = String(Math.floor(t / 60)).padStart(2, "0");
      const mm = String(t % 60).padStart(2, "0");
      const slotStart = zonedTimeToUtc(dateStr, `${hh}:${mm}`, timezone);
      const slotEnd = new Date(slotStart.getTime() + stepMinutes * 60_000);

      if (slotStart <= now) continue;

      const overlapsBlock = blockedWindows.some((b) => {
        const [bStartH, bStartM] = b.start_time.split(":").map(Number);
        const [bEndH, bEndM] = b.end_time.split(":").map(Number);
        const bStart = zonedTimeToUtc(dateStr, `${String(bStartH).padStart(2, "0")}:${String(bStartM).padStart(2, "0")}`, timezone);
        const bEnd = zonedTimeToUtc(dateStr, `${String(bEndH).padStart(2, "0")}:${String(bEndM).padStart(2, "0")}`, timezone);
        return slotStart < bEnd && slotEnd > bStart;
      });
      if (overlapsBlock) continue;

      const overlapsAppointment = busyRanges.some(
        (b) => slotStart < b.end && slotEnd > b.start,
      );
      if (overlapsAppointment) continue;

      candidates.push(slotStart);
    }
  }

  return candidates.sort((a, b) => a.getTime() - b.getTime());
}
