import "server-only";
import { createClient } from "@/lib/supabase/server";
import { fetchAllRows } from "@/lib/supabase/fetch-all";
import { toUsd } from "@/lib/currency/exchange";
import { getRoyaltyConfig, type RoyaltyConfig } from "./config";
import { monthRangeOf, recentMonthKeys } from "./period";
import type { CurrencyCode, RoyaltyStatus } from "@/types/database.types";

export interface RoyaltyPeriodRow {
  /** 'YYYY-MM'. */
  periodKey: string;
  label: string;
  from: string;
  to: string;
  /** Ventas (o cobros) de la sede origen en el periodo, en su moneda. */
  baseAmount: number;
  baseCurrency: CurrencyCode;
  amount: number;
  amountUsd: number;
  orderCount: number;
  status: RoyaltyStatus | "accruing";
  settlementId: string | null;
  paidAt: string | null;
  reference: string | null;
  /** El mes en curso sigue sumando: liquidarlo ahora sería prematuro. */
  isCurrentMonth: boolean;
}

export interface RoyaltyLedger {
  config: RoyaltyConfig;
  source: { id: string; name: string; currency: CurrencyCode } | null;
  beneficiary: { id: string; name: string; currency: CurrencyCode } | null;
  periods: RoyaltyPeriodRow[];
  /** Causado y no girado, sin contar el mes en curso. */
  pendingAmount: number;
  pendingAmountUsd: number;
  pendingCount: number;
  paidThisYearUsd: number;
  configured: boolean;
}

const LEDGER_MONTHS = 12;

/**
 * Regalía mes a mes: cuánto se causó, cuánto se giró y qué queda pendiente.
 *
 * El monto no se guarda hasta que se liquida: se recalcula siempre desde las
 * ventas reales, para que registrar una orden atrasada del mes pasado corrija
 * la cifra en lugar de dejarla desactualizada. La fila de royalty_settlements
 * congela el valor solo en el momento del giro.
 */
export async function getRoyaltyLedger(): Promise<RoyaltyLedger> {
  const supabase = await createClient();
  const config = getRoyaltyConfig();

  const { data: locations } = await supabase
    .from("locations")
    .select("id, code, name, currency")
    .in("code", [config.sourceLocationCode, config.beneficiaryLocationCode]);

  const source = (locations ?? []).find((l) => l.code === config.sourceLocationCode) ?? null;
  const beneficiary =
    (locations ?? []).find((l) => l.code === config.beneficiaryLocationCode) ?? null;

  const monthKeys = recentMonthKeys(LEDGER_MONTHS);
  const oldest = monthRangeOf(monthKeys[monthKeys.length - 1]);

  if (!source || !beneficiary) {
    return {
      config,
      source,
      beneficiary,
      periods: [],
      pendingAmount: 0,
      pendingAmountUsd: 0,
      pendingCount: 0,
      paidThisYearUsd: 0,
      configured: false,
    };
  }

  const [orders, payments, { data: settlements }] = await Promise.all([
    fetchAllRows<{
      id: string;
      total: number;
      currency: CurrencyCode | null;
      exchange_rate_to_usd: number;
      created_at: string;
    }>((from, to) =>
      supabase
        .from("orders")
        .select("id, total, currency, exchange_rate_to_usd, created_at")
        .eq("location_id", source.id)
        .is("deleted_at", null)
        .neq("status", "cancelled")
        .gte("created_at", `${oldest.from}T00:00:00.000Z`)
        .range(from, to),
    ),

    config.base === "collected"
      ? fetchAllRows<{
          amount: number;
          paid_at: string;
          orders: { location_id: string; currency: CurrencyCode | null; exchange_rate_to_usd: number } | null;
        }>((from, to) =>
          supabase
            .from("payments")
            .select("amount, paid_at, orders!inner(location_id, currency, exchange_rate_to_usd)")
            .eq("orders.location_id", source.id)
            .gte("paid_at", `${oldest.from}T00:00:00.000Z`)
            .range(from, to),
        )
      : Promise.resolve([]),

    supabase
      .from("royalty_settlements")
      .select("id, period_start, amount, amount_usd, base_amount, status, paid_at, reference")
      .eq("source_location_id", source.id)
      .gte("period_start", oldest.from),
  ]);

  const settlementByStart = new Map(
    (settlements ?? []).map((row) => [row.period_start, row]),
  );

  const baseByMonth = new Map<string, { amount: number; amountUsd: number; count: number }>();

  if (config.base === "collected") {
    for (const payment of payments) {
      const key = payment.paid_at.slice(0, 7);
      const entry = baseByMonth.get(key) ?? { amount: 0, amountUsd: 0, count: 0 };
      entry.amount += payment.amount;
      entry.amountUsd += toUsd(
        payment.amount,
        payment.orders?.currency ?? source.currency,
        payment.orders?.exchange_rate_to_usd || 1,
      );
      entry.count += 1;
      baseByMonth.set(key, entry);
    }
  } else {
    for (const order of orders) {
      const key = order.created_at.slice(0, 7);
      const entry = baseByMonth.get(key) ?? { amount: 0, amountUsd: 0, count: 0 };
      entry.amount += order.total;
      entry.amountUsd += toUsd(
        order.total,
        order.currency ?? source.currency,
        order.exchange_rate_to_usd || 1,
      );
      entry.count += 1;
      baseByMonth.set(key, entry);
    }
  }

  const currentMonthKey = monthKeys[0];
  const currentYear = new Date().getUTCFullYear();

  const periods: RoyaltyPeriodRow[] = monthKeys.map((periodKey) => {
    const range = monthRangeOf(periodKey);
    const base = baseByMonth.get(periodKey) ?? { amount: 0, amountUsd: 0, count: 0 };
    const settlement = settlementByStart.get(range.from);

    // Una liquidación girada congela su monto; lo no girado se recalcula.
    const isPaid = settlement?.status === "paid";
    const amount = isPaid
      ? settlement.amount
      : Math.round((base.amount * config.percent) / 100 * 100) / 100;
    const amountUsd = isPaid
      ? settlement.amount_usd
      : Math.round((base.amountUsd * config.percent) / 100 * 100) / 100;

    return {
      periodKey,
      label: range.label,
      from: range.from,
      to: range.to,
      baseAmount: isPaid ? settlement.base_amount : Math.round(base.amount * 100) / 100,
      baseCurrency: source.currency,
      amount,
      amountUsd,
      orderCount: base.count,
      status: periodKey === currentMonthKey && !settlement ? "accruing" : (settlement?.status ?? "pending"),
      settlementId: settlement?.id ?? null,
      paidAt: settlement?.paid_at ?? null,
      reference: settlement?.reference ?? null,
      isCurrentMonth: periodKey === currentMonthKey,
    };
  });

  const settled = periods.filter((p) => p.status === "pending" && !p.isCurrentMonth && p.amount > 0);

  return {
    config,
    source,
    beneficiary,
    periods,
    pendingAmount: Math.round(settled.reduce((sum, p) => sum + p.amount, 0) * 100) / 100,
    pendingAmountUsd: Math.round(settled.reduce((sum, p) => sum + p.amountUsd, 0) * 100) / 100,
    pendingCount: settled.length,
    paidThisYearUsd:
      Math.round(
        periods
          .filter((p) => p.status === "paid" && p.periodKey.startsWith(String(currentYear)))
          .reduce((sum, p) => sum + p.amountUsd, 0) * 100,
      ) / 100,
    configured: true,
  };
}
