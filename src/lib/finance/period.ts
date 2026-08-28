/**
 * Periodo contable compartido por todas las pantallas de finanzas.
 *
 * Regla UX #1 (Smart Defaults): ninguna pantalla de finanzas arranca sin
 * periodo. Si nadie eligió nada, el periodo es el mes en curso — que es lo
 * que un administrador quiere ver el 99% de las veces al entrar.
 */

export const PERIOD_PRESETS = [
  "mes",
  "mes-anterior",
  "trimestre",
  "ano",
  "todo",
] as const;

export type PeriodPreset = (typeof PERIOD_PRESETS)[number] | "personalizado";

export const PERIOD_PRESET_LABELS: Record<PeriodPreset, string> = {
  mes: "Este mes",
  "mes-anterior": "Mes anterior",
  trimestre: "Últimos 3 meses",
  ano: "Este año",
  todo: "Todo",
  personalizado: "Personalizado",
};

export interface Period {
  preset: PeriodPreset;
  /** Fecha inclusive, YYYY-MM-DD. */
  from: string;
  /** Fecha inclusive, YYYY-MM-DD. */
  to: string;
  /** Texto listo para mostrar en pantalla (regla UX #7: contexto permanente). */
  label: string;
  /** Límites en ISO para comparar contra columnas timestamptz. */
  fromIso: string;
  toIso: string;
}

const MONTH_NAMES = [
  "enero",
  "febrero",
  "marzo",
  "abril",
  "mayo",
  "junio",
  "julio",
  "agosto",
  "septiembre",
  "octubre",
  "noviembre",
  "diciembre",
];

export const MONTH_SHORT_NAMES = [
  "Ene",
  "Feb",
  "Mar",
  "Abr",
  "May",
  "Jun",
  "Jul",
  "Ago",
  "Sep",
  "Oct",
  "Nov",
  "Dic",
];

function toDateKey(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function isDateKey(value: string | undefined): value is string {
  return typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value);
}

function capitalize(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1);
}

function describeRange(from: string, to: string): string {
  const start = new Date(`${from}T00:00:00Z`);
  const end = new Date(`${to}T00:00:00Z`);
  const sameYear = start.getUTCFullYear() === end.getUTCFullYear();
  const sameMonth = sameYear && start.getUTCMonth() === end.getUTCMonth();

  if (sameMonth) {
    return capitalize(`${MONTH_NAMES[start.getUTCMonth()]} ${start.getUTCFullYear()}`);
  }
  if (sameYear) {
    return capitalize(
      `${MONTH_NAMES[start.getUTCMonth()]} – ${MONTH_NAMES[end.getUTCMonth()]} ${end.getUTCFullYear()}`,
    );
  }
  return `${from} – ${to}`;
}

/**
 * Traduce los search params de cualquier pantalla de finanzas a un periodo
 * concreto. `from`/`to` explícitos ganan sobre el preset.
 */
export function resolvePeriod(params: {
  periodo?: string;
  from?: string;
  to?: string;
  now?: Date;
} = {}): Period {
  const now = params.now ?? new Date();
  const year = now.getUTCFullYear();
  const month = now.getUTCMonth();

  let preset: PeriodPreset = "mes";
  let from: string;
  let to: string;

  if (isDateKey(params.from) && isDateKey(params.to)) {
    preset = "personalizado";
    from = params.from;
    to = params.to;
  } else {
    const requested = (params.periodo ?? "mes") as PeriodPreset;
    preset = (PERIOD_PRESETS as readonly string[]).includes(requested) ? requested : "mes";

    switch (preset) {
      case "mes-anterior":
        from = toDateKey(new Date(Date.UTC(year, month - 1, 1)));
        to = toDateKey(new Date(Date.UTC(year, month, 0)));
        break;
      case "trimestre":
        from = toDateKey(new Date(Date.UTC(year, month - 2, 1)));
        to = toDateKey(new Date(Date.UTC(year, month + 1, 0)));
        break;
      case "ano":
        from = toDateKey(new Date(Date.UTC(year, 0, 1)));
        to = toDateKey(new Date(Date.UTC(year, 11, 31)));
        break;
      case "todo":
        from = "2000-01-01";
        to = toDateKey(new Date(Date.UTC(year, 11, 31)));
        break;
      default:
        preset = "mes";
        from = toDateKey(new Date(Date.UTC(year, month, 1)));
        to = toDateKey(new Date(Date.UTC(year, month + 1, 0)));
    }
  }

  const label =
    preset === "todo"
      ? "Histórico completo"
      : preset === "ano"
        ? `Año ${year}`
        : describeRange(from, to);

  return {
    preset,
    from,
    to,
    label,
    fromIso: `${from}T00:00:00.000Z`,
    toIso: `${to}T23:59:59.999Z`,
  };
}

/** Clave 'YYYY-MM' del mes de una fecha — la usan las salidas fijas generadas. */
export function periodKeyOf(date: Date): string {
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
}

/** Rango del mes calendario al que pertenece una clave 'YYYY-MM'. */
export function monthRangeOf(periodKey: string): { from: string; to: string; label: string } {
  const [year, month] = periodKey.split("-").map(Number);
  const from = toDateKey(new Date(Date.UTC(year, month - 1, 1)));
  const to = toDateKey(new Date(Date.UTC(year, month, 0)));
  return { from, to, label: capitalize(`${MONTH_NAMES[month - 1]} ${year}`) };
}

/** Lista de claves 'YYYY-MM' desde el mes más reciente hacia atrás. */
export function recentMonthKeys(count: number, now = new Date()): string[] {
  const keys: string[] = [];
  for (let i = 0; i < count; i += 1) {
    keys.push(periodKeyOf(new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - i, 1))));
  }
  return keys;
}
