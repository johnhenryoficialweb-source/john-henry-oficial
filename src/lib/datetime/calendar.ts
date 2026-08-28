/**
 * Aritmética de calendario sobre cadenas "YYYY-MM-DD".
 *
 * Se trabaja con la fecha como CADENA, no como `Date`, a propósito. Un `Date`
 * siempre es un instante, y en cuanto se formatea con la zona local un día
 * calendario se corre: `new Date("2026-07-16T00:00:00Z")` formateado a UTC−5
 * es el 15 de julio. Ese error ya estaba en la agenda — el encabezado mostraba
 * un día menos que el que realmente se estaba consultando.
 *
 * Para convertir un día calendario a instantes UTC (para consultar la base) se
 * usa `zonedTimeToUtc(dateStr, "00:00", tz)` de ./timezone.
 */

/** Hoy, como día calendario de una zona horaria dada. */
export function todayInTimeZone(timeZone: string): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
  // en-CA ya emite "YYYY-MM-DD".
  return parts;
}

export function addDays(dateStr: string, days: number): string {
  const d = new Date(`${dateStr}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

export function addMonths(dateStr: string, months: number): string {
  const d = new Date(`${dateStr}T00:00:00Z`);
  const day = d.getUTCDate();
  d.setUTCDate(1);
  d.setUTCMonth(d.getUTCMonth() + months);
  // Clamp: 31 de enero + 1 mes no es el 3 de marzo.
  const lastDay = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0)).getUTCDate();
  d.setUTCDate(Math.min(day, lastDay));
  return d.toISOString().slice(0, 10);
}

/** Lunes de la semana que contiene `dateStr`. La semana laboral arranca en lunes. */
export function startOfWeek(dateStr: string): string {
  const d = new Date(`${dateStr}T00:00:00Z`);
  const offset = (d.getUTCDay() + 6) % 7;
  return addDays(dateStr, -offset);
}

export function startOfMonth(dateStr: string): string {
  return `${dateStr.slice(0, 7)}-01`;
}

export function endOfMonth(dateStr: string): string {
  const d = new Date(`${dateStr}T00:00:00Z`);
  const last = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0));
  return last.toISOString().slice(0, 10);
}

/** Días calendario de `from` a `to`, ambos inclusive. */
export function eachDay(from: string, to: string): string[] {
  const out: string[] = [];
  let cursor = from;
  // Guardia: un rango invertido devolvería una lista infinita.
  while (cursor <= to && out.length < 400) {
    out.push(cursor);
    cursor = addDays(cursor, 1);
  }
  return out;
}

/**
 * Formatea un día calendario. Fija `timeZone: "UTC"` porque la cadena YA es un
 * día calendario, no un instante: sin esto el formateador lo reinterpreta en la
 * zona local y devuelve el día anterior.
 */
export function formatCalendarDate(
  dateStr: string,
  options: Intl.DateTimeFormatOptions,
  locale = "es-CO",
): string {
  return new Intl.DateTimeFormat(locale, { ...options, timeZone: "UTC" }).format(
    new Date(`${dateStr}T00:00:00Z`),
  );
}
