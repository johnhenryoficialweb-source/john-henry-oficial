import Link from "next/link";
import { APPOINTMENT_STATUS_LABELS } from "@/lib/constants";
import { AppointmentManageDialog } from "@/components/cms/appointment-manage-dialog";
import { LOCATION_ACCENT, LOCATION_SHORT_LABEL, type LocationCode } from "@/config/locations";
import { addDays, eachDay, formatCalendarDate, startOfMonth, endOfMonth, startOfWeek } from "@/lib/datetime/calendar";
import { Badge } from "@/components/ui/badge";
import { AppointmentQuickActions } from "@/components/cms/appointment-quick-actions";
import { cn } from "@/lib/utils";

export type AgendaAppointment = {
  id: string;
  starts_at: string;
  status: keyof typeof APPOINTMENT_STATUS_LABELS;
  appointment_type: string;
  /** Día calendario de la cita en la zona de la agenda — precalculado en el
   *  servidor para no reinterpretar el instante en cada celda. */
  dayStr: string;
  timeLabel: string;
  clientName: string;
  clientPhone: string;
  /** Determina si al cancelar el cliente recibe aviso: sin correo, no hay
   *  notificación y hay que llamarlo. */
  clientEmail: string | null;
  locationCode: LocationCode;
  locationName: string;
};

function groupByDay(appointments: AgendaAppointment[]) {
  const map = new Map<string, AgendaAppointment[]>();
  for (const a of appointments) {
    map.set(a.dayStr, [...(map.get(a.dayStr) ?? []), a]);
  }
  return map;
}

/** Punto de color + etiqueta. El color nunca viaja solo. */
export function LocationDot({ code, className }: { code: LocationCode; className?: string }) {
  return (
    <span
      aria-hidden
      className={cn("inline-block size-2 shrink-0 rounded-full", className)}
      style={{ backgroundColor: LOCATION_ACCENT[code] }}
    />
  );
}

export function AgendaLegend({ codes }: { codes: LocationCode[] }) {
  if (codes.length < 2) return null;
  return (
    <div className="flex items-center gap-4">
      {codes.map((code) => (
        <span key={code} className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
          <LocationDot code={code} />
          {LOCATION_SHORT_LABEL[code]}
        </span>
      ))}
    </div>
  );
}

/* ── Día ────────────────────────────────────────────────────────────────── */

export function DayView({ appointments }: { appointments: AgendaAppointment[] }) {
  return (
    <div className="space-y-2">
      {appointments.map((appt) => (
        <div key={appt.id} className="flex items-center justify-between rounded-lg border p-3">
          {/* Barra de sede a la izquierda: identifica la agenda antes de leer. */}
          <span
            aria-hidden
            className="mr-3 h-8 w-1 shrink-0 rounded-full"
            style={{ backgroundColor: LOCATION_ACCENT[appt.locationCode] }}
          />
          <AppointmentManageDialog appointment={appt}>
            <span className="flex flex-1 items-center gap-4">
              <span className="w-16 text-sm font-medium tabular-nums">{appt.timeLabel}</span>
              <span className="text-sm">
                {appt.clientName} <span className="text-muted-foreground">· {appt.clientPhone}</span>
              </span>
              <span className="text-xs text-muted-foreground">{appt.locationName}</span>
            </span>
          </AppointmentManageDialog>
          <div className="flex shrink-0 items-center gap-3">
            <Badge variant="secondary">{APPOINTMENT_STATUS_LABELS[appt.status]}</Badge>
            <AppointmentQuickActions appointmentId={appt.id} status={appt.status} />
          </div>
        </div>
      ))}
    </div>
  );
}

/* ── Semana ─────────────────────────────────────────────────────────────── */

export function WeekView({
  anchorDate,
  appointments,
  todayStr,
}: {
  anchorDate: string;
  appointments: AgendaAppointment[];
  todayStr: string;
}) {
  const from = startOfWeek(anchorDate);
  const days = eachDay(from, addDays(from, 6));
  const byDay = groupByDay(appointments);

  return (
    <div className="grid grid-cols-1 gap-px overflow-hidden rounded-lg border bg-border sm:grid-cols-7">
      {days.map((day) => {
        const items = byDay.get(day) ?? [];
        const isToday = day === todayStr;
        return (
          <div key={day} className="min-h-40 bg-background p-2">
            <div className="mb-2 flex items-baseline justify-between">
              <span className="text-[10px] tracking-[0.12em] text-muted-foreground uppercase">
                {formatCalendarDate(day, { weekday: "short" })}
              </span>
              <span
                className={cn(
                  "text-sm tabular-nums",
                  isToday
                    ? "flex size-6 items-center justify-center rounded-full bg-primary font-medium text-primary-foreground"
                    : "text-muted-foreground",
                )}
              >
                {formatCalendarDate(day, { day: "numeric" })}
              </span>
            </div>
            <div className="space-y-1">
              {items.map((appt) => (
                <AppointmentManageDialog key={appt.id} appointment={appt}>
                  <span
                    className="block rounded-md border-l-2 bg-muted/40 px-2 py-1 transition-colors hover:bg-muted"
                    style={{ borderLeftColor: LOCATION_ACCENT[appt.locationCode] }}
                  >
                    <span className="block text-[11px] font-medium tabular-nums">{appt.timeLabel}</span>
                    <span className="block truncate text-[11px] text-muted-foreground">{appt.clientName}</span>
                  </span>
                </AppointmentManageDialog>
              ))}
              {items.length === 0 && (
                <p className="text-[11px] text-muted-foreground/40">—</p>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

/* ── Mes ────────────────────────────────────────────────────────────────── */

const WEEKDAYS = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];

export function MonthView({
  anchorDate,
  appointments,
  todayStr,
  loc,
}: {
  anchorDate: string;
  appointments: AgendaAppointment[];
  todayStr: string;
  loc: string;
}) {
  const first = startOfMonth(anchorDate);
  const last = endOfMonth(anchorDate);
  // La rejilla arranca el lunes de la semana del día 1 y termina el domingo de
  // la del último: así las columnas siempre son los mismos días de la semana.
  const gridStart = startOfWeek(first);
  const gridEnd = addDays(startOfWeek(last), 6);
  const days = eachDay(gridStart, gridEnd);
  const byDay = groupByDay(appointments);
  const month = anchorDate.slice(0, 7);

  return (
    <div className="overflow-hidden rounded-lg border">
      <div className="grid grid-cols-7 gap-px bg-border">
        {WEEKDAYS.map((w) => (
          <div key={w} className="bg-muted/50 px-2 py-1.5 text-center text-[10px] tracking-[0.12em] text-muted-foreground uppercase">
            {w}
          </div>
        ))}
        {days.map((day) => {
          const items = byDay.get(day) ?? [];
          const outside = day.slice(0, 7) !== month;
          const isToday = day === todayStr;
          return (
            <div key={day} className={cn("min-h-24 bg-background p-1.5", outside && "bg-muted/20")}>
              <div className="mb-1 flex justify-end">
                {/* El número del día lleva a la vista de día — el mes es para
                    orientarse, el día es para trabajar. */}
                <Link
                  href={`/appointments?view=dia&date=${day}&loc=${loc}`}
                  className={cn(
                    "text-xs tabular-nums transition-colors hover:text-foreground",
                    isToday
                      ? "flex size-5 items-center justify-center rounded-full bg-primary font-medium text-primary-foreground"
                      : outside
                        ? "text-muted-foreground/40"
                        : "text-muted-foreground",
                  )}
                >
                  {formatCalendarDate(day, { day: "numeric" })}
                </Link>
              </div>
              <div className="space-y-0.5">
                {items.slice(0, 3).map((appt) => (
                  <AppointmentManageDialog key={appt.id} appointment={appt}>
                    <span className="flex items-center gap-1 rounded px-1 py-0.5 transition-colors hover:bg-muted">
                      <LocationDot code={appt.locationCode} />
                      <span className="truncate text-[10px] tabular-nums text-muted-foreground">
                        {appt.timeLabel}
                      </span>
                      <span className="truncate text-[10px]">{appt.clientName.split(" ")[0]}</span>
                    </span>
                  </AppointmentManageDialog>
                ))}
                {/* Nunca cortar en silencio: si hay más, se dice cuántas. */}
                {items.length > 3 && (
                  <Link
                    href={`/appointments?view=dia&date=${day}&loc=${loc}`}
                    className="block px-1 text-[10px] text-primary hover:underline"
                  >
                    +{items.length - 3} más
                  </Link>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
