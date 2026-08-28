import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getStaffSession } from "@/lib/auth/roles";
import { AGENDA_TIME_ZONE, LOCATION_ACCENT, LOCATION_SHORT_LABEL, type LocationCode } from "@/config/locations";
import { zonedTimeToUtc } from "@/lib/datetime/timezone";
import {
  addDays,
  addMonths,
  endOfMonth,
  formatCalendarDate,
  startOfMonth,
  startOfWeek,
  todayInTimeZone,
} from "@/lib/datetime/calendar";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/shared/empty-state";
import {
  AgendaLegend,
  DayView,
  MonthView,
  WeekView,
  type AgendaAppointment,
} from "@/components/cms/agenda-views";
import { ChevronLeftIcon, ChevronRightIcon, CalendarDaysIcon, PlusIcon } from "lucide-react";

type View = "dia" | "semana" | "mes";
const VIEWS: { value: View; label: string }[] = [
  { value: "dia", label: "Día" },
  { value: "semana", label: "Semana" },
  { value: "mes", label: "Mes" },
];

/**
 * Rango visible según la vista. Devuelve días CALENDARIO; la conversión a
 * instantes UTC para consultar se hace después con la zona de la agenda.
 */
function rangeFor(view: View, anchor: string): { from: string; to: string } {
  if (view === "dia") return { from: anchor, to: anchor };
  if (view === "semana") {
    const from = startOfWeek(anchor);
    return { from, to: addDays(from, 6) };
  }
  // El mes se consulta con la rejilla completa (lunes anterior al día 1 hasta
  // el domingo posterior al último) — si no, los días de relleno saldrían
  // vacíos aunque tengan citas.
  const from = startOfWeek(startOfMonth(anchor));
  return { from, to: addDays(startOfWeek(endOfMonth(anchor)), 6) };
}

function shift(view: View, anchor: string, direction: 1 | -1): string {
  if (view === "dia") return addDays(anchor, direction);
  if (view === "semana") return addDays(anchor, 7 * direction);
  return addMonths(anchor, direction);
}

function rangeLabel(view: View, anchor: string): string {
  if (view === "dia") {
    return formatCalendarDate(anchor, { weekday: "long", day: "numeric", month: "long", year: "numeric" });
  }
  if (view === "semana") {
    const from = startOfWeek(anchor);
    const to = addDays(from, 6);
    const sameMonth = from.slice(0, 7) === to.slice(0, 7);
    return sameMonth
      ? `${formatCalendarDate(from, { day: "numeric" })}–${formatCalendarDate(to, { day: "numeric", month: "long", year: "numeric" })}`
      : `${formatCalendarDate(from, { day: "numeric", month: "short" })} – ${formatCalendarDate(to, { day: "numeric", month: "short", year: "numeric" })}`;
  }
  return formatCalendarDate(anchor, { month: "long", year: "numeric" });
}

export default async function AppointmentsPage({
  searchParams,
}: {
  searchParams: Promise<{ date?: string; view?: string; loc?: string }>;
}) {
  const params = await searchParams;
  const session = await getStaffSession();

  const view: View = VIEWS.some((v) => v.value === params.view) ? (params.view as View) : "dia";
  /*
   * "Hoy" se resuelve en la zona de la agenda, no en la del servidor. Antes
   * salía de `new Date().toISOString()` (UTC) y luego se formateaba en hora
   * local: a UTC−5 el encabezado mostraba el día anterior al que se estaba
   * consultando.
   */
  const todayStr = todayInTimeZone(AGENDA_TIME_ZONE);
  const anchor = /^\d{4}-\d{2}-\d{2}$/.test(params.date ?? "") ? params.date! : todayStr;
  const loc = params.loc === "CO" || params.loc === "PA" ? params.loc : "all";

  const supabase = await createClient();
  const { data: locationRows } = await supabase.from("locations").select("id, code, name").order("code");
  const locations = (locationRows ?? []) as { id: string; code: LocationCode; name: string }[];

  /*
   * El staff con sede fija solo ve la suya: para él el filtro no existe y la
   * leyenda sobra. Solo un admin (locationId = null) maneja las dos agendas.
   */
  const scopedCode = session?.locationId
    ? (locations.find((l) => l.id === session.locationId)?.code ?? null)
    : null;
  const visibleLocations = scopedCode ? locations.filter((l) => l.code === scopedCode) : locations;
  const effectiveLoc: LocationCode | "all" = scopedCode ?? loc;

  const { from, to } = rangeFor(view, anchor);
  // Límites del día en la zona de la agenda, no en UTC: consultar de 00:00Z a
  // 00:00Z arrastra las citas de la tarde al día siguiente.
  const rangeStart = zonedTimeToUtc(from, "00:00", AGENDA_TIME_ZONE);
  const rangeEnd = zonedTimeToUtc(addDays(to, 1), "00:00", AGENDA_TIME_ZONE);

  let query = supabase
    .from("appointments")
    .select("id, appointment_type, starts_at, status, clients(full_name, phone, email), locations(code, name)")
    .gte("starts_at", rangeStart.toISOString())
    .lt("starts_at", rangeEnd.toISOString())
    .order("starts_at");

  if (effectiveLoc !== "all") {
    const target = locations.find((l) => l.code === effectiveLoc);
    if (target) query = query.eq("location_id", target.id);
  }

  const { data: rows } = await query;

  const dayFmt = new Intl.DateTimeFormat("en-CA", {
    timeZone: AGENDA_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  const timeFmt = new Intl.DateTimeFormat("es-CO", {
    timeZone: AGENDA_TIME_ZONE,
    hour: "numeric",
    minute: "2-digit",
  });

  const appointments: AgendaAppointment[] = (rows ?? []).map((row) => {
    const client = row.clients as unknown as { full_name: string; phone: string; email: string | null } | null;
    const location = row.locations as unknown as { code: LocationCode; name: string } | null;
    const at = new Date(row.starts_at);
    return {
      id: row.id,
      starts_at: row.starts_at,
      status: row.status,
      appointment_type: row.appointment_type,
      dayStr: dayFmt.format(at),
      timeLabel: timeFmt.format(at),
      clientName: client?.full_name ?? "—",
      clientPhone: client?.phone ?? "",
      clientEmail: client?.email ?? null,
      locationCode: location?.code ?? "CO",
      locationName: location?.name ?? "",
    };
  });

  const href = (next: { view?: View; date?: string; loc?: string }) =>
    `/appointments?view=${next.view ?? view}&date=${next.date ?? anchor}&loc=${next.loc ?? loc}`;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-heading text-2xl">Citas</h1>
          <p className="text-sm text-muted-foreground first-letter:uppercase">{rangeLabel(view, anchor)}</p>
        </div>
        <Button render={<Link href="/appointments/nueva" />}>
          <PlusIcon />
          Nueva cita
        </Button>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon-sm" render={<Link href={href({ date: shift(view, anchor, -1) })} />}>
            <ChevronLeftIcon />
          </Button>
          <Button variant="outline" size="sm" render={<Link href={href({ date: todayStr })} />}>
            Hoy
          </Button>
          <Button variant="outline" size="icon-sm" render={<Link href={href({ date: shift(view, anchor, 1) })} />}>
            <ChevronRightIcon />
          </Button>

          <div className="ml-2 flex gap-1 rounded-lg bg-muted p-0.5">
            {VIEWS.map((v) => (
              <Button
                key={v.value}
                size="sm"
                variant={view === v.value ? "default" : "ghost"}
                render={<Link href={href({ view: v.value })} />}
              >
                {v.label}
              </Button>
            ))}
          </div>
        </div>

        <div className="flex items-center gap-4">
          <AgendaLegend codes={visibleLocations.map((l) => l.code)} />
          {/* Sin sede fija: el admin elige una agenda o las dos a la vez. */}
          {!scopedCode && locations.length > 1 && (
            <div className="flex gap-1 rounded-lg bg-muted p-0.5">
              <Button size="sm" variant={loc === "all" ? "default" : "ghost"} render={<Link href={href({ loc: "all" })} />}>
                Ambas
              </Button>
              {locations.map((l) => (
                <Button
                  key={l.code}
                  size="sm"
                  variant={loc === l.code ? "default" : "ghost"}
                  render={<Link href={href({ loc: l.code })} />}
                >
                  <span
                    aria-hidden
                    className="mr-1 inline-block size-2 rounded-full"
                    style={{ backgroundColor: LOCATION_ACCENT[l.code] }}
                  />
                  {LOCATION_SHORT_LABEL[l.code]}
                </Button>
              ))}
            </div>
          )}
        </div>
      </div>

      {appointments.length === 0 && view === "dia" ? (
        <EmptyState
          icon={CalendarDaysIcon}
          title="Sin citas este día"
          description={
            effectiveLoc === "all"
              ? "No hay citas agendadas para esta fecha en ninguna sede."
              : `No hay citas agendadas para esta fecha en ${LOCATION_SHORT_LABEL[effectiveLoc]}.`
          }
          action={{ href: "/appointments/nueva", label: "Agendar cita" }}
        />
      ) : view === "dia" ? (
        <DayView appointments={appointments} />
      ) : view === "semana" ? (
        <WeekView anchorDate={anchor} appointments={appointments} todayStr={todayStr} />
      ) : (
        <MonthView anchorDate={anchor} appointments={appointments} todayStr={todayStr} loc={loc} />
      )}
    </div>
  );
}
