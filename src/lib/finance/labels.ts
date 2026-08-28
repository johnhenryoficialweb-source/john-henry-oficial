/**
 * Vocabulario del módulo financiero.
 *
 * Vive aparte de las consultas (`expenses.ts`, `config.ts`, marcadas
 * `server-only`) porque los formularios del CMS son componentes de cliente y
 * necesitan las mismas etiquetas: sin esta separación, importar un rótulo
 * arrastraría el cliente de Supabase al bundle del navegador.
 */
import type { ExpenseKind, PaymentMethod } from "@/types/database.types";

export const EXPENSE_KIND_LABELS: Record<ExpenseKind, string> = {
  fixed: "Fija",
  sporadic: "Esporádica",
};

export const EXPENSE_KIND_DESCRIPTIONS: Record<ExpenseKind, string> = {
  fixed: "Se repite todos los meses: arriendo, nómina, servicios.",
  sporadic: "Ocurre puntualmente: compra de telas, mantenimiento, viáticos.",
};

export const PAYMENT_METHOD_LABELS: Record<PaymentMethod, string> = {
  cash: "Efectivo",
  card: "Tarjeta",
  transfer: "Transferencia",
  other: "Otro",
};

/**
 * Medio por el que entró la plata: efectivo, datáfono, pasarela, transferencia.
 *
 * Es más fino que `PaymentMethod` porque de él cuelga la comisión: dos
 * datáfonos distintos son dos canales con dos porcentajes, aunque ambos sean
 * `card` para el enum.
 */
export interface PaymentChannelOption {
  id: string;
  code: string | null;
  name: string;
  method: PaymentMethod;
  feePercent: number;
  feeFixed: number;
  locationId: string | null;
  notes: string | null;
  isActive: boolean;
  sortOrder: number;
}

/**
 * Medios base para cuando todavía no hay canales configurados.
 *
 * Sin esto, un sistema recién montado —o uno donde la migración de canales aún
 * no corrió— muestra la pregunta "¿por dónde entró?" sin una sola opción
 * debajo, y el cobro se guarda como efectivo sin que nadie lo haya dicho.
 * Estos medios no cobran comisión porque nadie ha configurado cuánto cobran:
 * registran el tipo de pago, que es lo que no se puede perder.
 */
const FALLBACK_PREFIX = "method:";

export const FALLBACK_CHANNELS: PaymentChannelOption[] = (
  [
    ["cash", "Efectivo"],
    ["card", "Datáfono"],
    ["transfer", "Transferencia"],
    ["other", "Otro"],
  ] as [PaymentMethod, string][]
).map(([method, name], index) => ({
  id: `${FALLBACK_PREFIX}${method}`,
  code: method,
  name,
  method,
  feePercent: 0,
  feeFixed: 0,
  locationId: null,
  notes: null,
  isActive: true,
  sortOrder: (index + 1) * 10,
}));

/** Los canales configurados, o los base si todavía no hay ninguno. */
export function resolveChannels(channels: PaymentChannelOption[]): PaymentChannelOption[] {
  return channels.length > 0 ? channels : FALLBACK_CHANNELS;
}

/** Un medio base no existe en la tabla: viaja como `method`, no como `channel_id`. */
export function isFallbackChannel(id: string): boolean {
  return id.startsWith(FALLBACK_PREFIX);
}

export function fallbackMethodOf(id: string): PaymentMethod {
  return id.slice(FALLBACK_PREFIX.length) as PaymentMethod;
}

/** Comisión de un cobro por este canal: porcentaje + fijo. */
export function channelFee(
  channel: Pick<PaymentChannelOption, "feePercent" | "feeFixed">,
  amount: number
): number {
  if (channel.feePercent <= 0 && channel.feeFixed <= 0) return 0;
  const fee = (amount * channel.feePercent) / 100 + channel.feeFixed;
  return Math.min(Math.round(fee * 100) / 100, amount);
}

/** "3,5%" · "3,5% + 900" · "sin comisión" — para rotular el canal en un botón. */
export function channelFeeLabel(
  channel: Pick<PaymentChannelOption, "feePercent" | "feeFixed">
): string {
  const parts: string[] = [];
  if (channel.feePercent > 0) parts.push(`${channel.feePercent}%`);
  if (channel.feeFixed > 0) parts.push(`+ ${channel.feeFixed}`);
  return parts.length > 0 ? parts.join(" ") : "sin comisión";
}

/** Base sobre la que se causa la regalía. */
export type RoyaltyBase = "sales" | "collected";

export const ROYALTY_BASE_LABELS: Record<RoyaltyBase, string> = {
  sales: "Sobre lo facturado",
  collected: "Sobre lo efectivamente cobrado",
};

export interface ExpenseCategory {
  id: string;
  name: string;
  code: string | null;
  kind: ExpenseKind;
  description: string | null;
  isActive: boolean;
  sortOrder: number;
}
