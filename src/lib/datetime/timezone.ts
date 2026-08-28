/**
 * Conversión de hora local (en la zona horaria de una sede) a instante UTC,
 * sin depender de date-fns-tz. Usa el truco estándar de formatear la misma
 * fecha en dos zonas y restar el offset resultante.
 */
function getTimeZoneOffsetMs(date: Date, timeZone: string): number {
  const dtf = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });

  const parts = dtf.formatToParts(date).reduce<Record<string, string>>((acc, part) => {
    acc[part.type] = part.value;
    return acc;
  }, {});

  const asIfUtc = Date.UTC(
    Number(parts.year),
    Number(parts.month) - 1,
    Number(parts.day),
    Number(parts.hour),
    Number(parts.minute),
    Number(parts.second),
  );

  return asIfUtc - date.getTime();
}

/** dateStr: "YYYY-MM-DD", timeStr: "HH:mm" (hora local de esa zona horaria). */
export function zonedTimeToUtc(dateStr: string, timeStr: string, timeZone: string): Date {
  const naiveUtc = new Date(`${dateStr}T${timeStr}:00Z`);
  const offsetMs = getTimeZoneOffsetMs(naiveUtc, timeZone);
  return new Date(naiveUtc.getTime() - offsetMs);
}

/** Día de la semana (0=domingo..6=sábado) de una fecha calendario "YYYY-MM-DD". */
export function dayOfWeekForDateString(dateStr: string): number {
  return new Date(`${dateStr}T00:00:00Z`).getUTCDay();
}

/** Formatea un instante en la hora local de una sede, ej. "lun, 15 jul 2026, 10:00 a. m." */
export function formatInTimeZone(date: Date, timeZone: string, locale: string): string {
  return new Intl.DateTimeFormat(locale, {
    timeZone,
    weekday: "short",
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
}
