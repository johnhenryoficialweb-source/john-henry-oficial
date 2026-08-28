import "server-only";
import { createClient } from "@/lib/supabase/server";
import { fetchAllRows } from "@/lib/supabase/fetch-all";
import { toUsd } from "@/lib/currency/exchange";
import { getRoyaltyConfig, type RoyaltyConfig } from "./config";
import { MONTH_SHORT_NAMES, type Period } from "./period";
import type { CurrencyCode, ExpenseKind } from "@/types/database.types";

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

/** Contador de dinero de una sede, en su moneda local y su equivalente USD. */
export interface LocationFinance {
  locationId: string;
  code: string;
  name: string;
  country: string;
  currency: CurrencyCode;
  /** Sede que gira la regalía (Colombia en el acuerdo actual). */
  isRoyaltySource: boolean;
  /** Casa matriz que la recibe (Panamá). */
  isRoyaltyBeneficiary: boolean;

  // Entradas
  billed: number;
  orderCount: number;
  /**
   * Órdenes del periodo que no tienen ningún valor registrado. El histórico
   * importado llegó sin precios: sin este conteo, esas órdenes desaparecen del
   * panel y la pantalla afirma que no hubo movimiento cuando sí lo hubo.
   */
  ordersWithoutValue: number;
  collected: number;
  /**
   * Comisiones retenidas por datáfonos y pasarelas sobre lo cobrado en el
   * periodo. Es dinero que el cliente pagó y que nunca llegó a la caja.
   */
  fees: number;
  feeCount: number;
  /** Saldo por cobrar acumulado, no solo del periodo. */
  outstanding: number;

  // Salidas
  cogs: number;
  expenses: number;
  expensesFixed: number;
  expensesSporadic: number;
  expenseCount: number;

  // Regalía
  royaltyOut: number;
  royaltyIn: number;

  /** Facturado − costo base de las piezas. */
  grossMargin: number;
  /** Margen bruto − salidas − regalía girada + regalía recibida. */
  net: number;
  /** Cobrado − salidas: el movimiento real de caja del periodo. */
  cashFlow: number;

  usd: {
    billed: number;
    collected: number;
    fees: number;
    outstanding: number;
    cogs: number;
    expenses: number;
    expensesFixed: number;
    expensesSporadic: number;
    royaltyOut: number;
    royaltyIn: number;
    grossMargin: number;
    net: number;
  };
}

export interface ExpenseBreakdownRow {
  categoryName: string;
  kind: ExpenseKind;
  amountUsd: number;
  count: number;
}

/** Lo que se llevó cada medio de cobro en el periodo. */
export interface ChannelFeeRow {
  channelName: string;
  /** Cobrado a través de este medio, consolidado en USD. */
  collectedUsd: number;
  feeUsd: number;
  count: number;
}

export interface MonthlyFinanceRow {
  month: string;
  ingresos: number;
  salidas: number;
  neto: number;
}

export interface FinanceOverview {
  period: Period;
  royalty: RoyaltyConfig;
  locations: LocationFinance[];
  consolidated: {
    billed: number;
    collected: number;
    fees: number;
    outstanding: number;
    cogs: number;
    expenses: number;
    expensesFixed: number;
    expensesSporadic: number;
    grossMargin: number;
    royalty: number;
    net: number;
  };
  expenseBreakdown: ExpenseBreakdownRow[];
  channelFees: ChannelFeeRow[];
  monthly: MonthlyFinanceRow[];
  /** Órdenes del periodo, tengan valor o no. */
  ordersInPeriod: number;
  /** De esas, cuántas no tienen ningún valor registrado. */
  ordersWithoutValue: number;
  hasAnyExpense: boolean;
  hasAnyBaseCost: boolean;
}

interface OrderRow {
  id: string;
  location_id: string;
  total: number;
  currency: CurrencyCode | null;
  exchange_rate_to_usd: number;
  created_at: string;
}

interface PaymentRow {
  amount: number;
  fee_amount: number;
  paid_at: string;
  order_id: string;
  payment_channels: { name: string } | null;
}

interface ExpenseRow {
  location_id: string;
  amount: number;
  currency: CurrencyCode;
  exchange_rate_to_usd: number;
  expense_date: string;
  expense_categories: { name: string; kind: ExpenseKind } | null;
}

interface ItemCostRow {
  line_cost: number;
  orders: { id: string } | null;
}

const TREND_MONTHS = 12;

function monthKey(iso: string): string {
  return iso.slice(0, 7);
}

function monthLabel(key: string): string {
  const [year, month] = key.split("-").map(Number);
  return `${MONTH_SHORT_NAMES[month - 1]} ${String(year).slice(2)}`;
}

/**
 * Estado de dinero por sede para un periodo: qué entró, qué salió, cuánto
 * queda por cobrar y cuánto pesa la regalía. Es la fuente única del panel de
 * finanzas — todas las tarjetas y gráficas de /finance salen de acá.
 *
 * Todo se lee en una sola pasada (órdenes, pagos, salidas y costos completos)
 * y se agrega en memoria: PostgREST no hace group by, y hacer una consulta por
 * sede × métrica multiplicaría los round trips sin ganar nada.
 */
export async function getFinanceOverview(period: Period): Promise<FinanceOverview> {
  const supabase = await createClient();
  const royalty = getRoyaltyConfig();

  const now = new Date();
  const trendStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - (TREND_MONTHS - 1), 1));
  const costsFromIso =
    trendStart.toISOString() < period.fromIso ? trendStart.toISOString() : period.fromIso;

  const [{ data: locations }, orders, payments, expenses, itemCosts, { count: baseCostCount }] =
    await Promise.all([
      supabase
        .from("locations")
        .select("id, code, name, country, currency")
        .eq("is_active", true)
        .order("code"),

      // Todas las órdenes vivas: el saldo por cobrar es acumulado, no del periodo.
      fetchAllRows<OrderRow>((from, to) =>
        supabase
          .from("orders")
          .select("id, location_id, total, currency, exchange_rate_to_usd, created_at")
          .is("deleted_at", null)
          .neq("status", "cancelled")
          .range(from, to),
      ),

      fetchAllRows<PaymentRow>((from, to) =>
        supabase
          .from("payments")
          .select("amount, fee_amount, paid_at, order_id, payment_channels(name)")
          .range(from, to),
      ),

      fetchAllRows<ExpenseRow>((from, to) =>
        supabase
          .from("expenses")
          .select(
            "location_id, amount, currency, exchange_rate_to_usd, expense_date, expense_categories(name, kind)",
          )
          .range(from, to),
      ),

      fetchAllRows<ItemCostRow>((from, to) =>
        supabase
          .from("order_items")
          .select("line_cost, orders!inner(id)")
          .gte("orders.created_at", costsFromIso)
          .neq("orders.status", "cancelled")
          .range(from, to),
      ),

      supabase.from("garment_base_costs").select("id", { count: "exact", head: true }),
    ]);

  const costByOrder = new Map<string, number>();
  for (const item of itemCosts) {
    const orderId = item.orders?.id;
    if (!orderId) continue;
    costByOrder.set(orderId, (costByOrder.get(orderId) ?? 0) + (item.line_cost ?? 0));
  }

  const paidByOrder = new Map<string, number>();
  for (const payment of payments) {
    paidByOrder.set(payment.order_id, (paidByOrder.get(payment.order_id) ?? 0) + payment.amount);
  }

  const orderById = new Map(orders.map((order) => [order.id, order]));

  interface Bucket {
    billed: number;
    orderCount: number;
    ordersWithoutValue: number;
    collected: number;
    fees: number;
    feeCount: number;
    outstanding: number;
    cogs: number;
    expenses: number;
    expensesFixed: number;
    expensesSporadic: number;
    expenseCount: number;
    usdBilled: number;
    usdCollected: number;
    usdFees: number;
    usdOutstanding: number;
    usdCogs: number;
    usdExpenses: number;
    usdExpensesFixed: number;
    usdExpensesSporadic: number;
  }

  const emptyBucket = (): Bucket => ({
    billed: 0,
    orderCount: 0,
    ordersWithoutValue: 0,
    collected: 0,
    fees: 0,
    feeCount: 0,
    outstanding: 0,
    cogs: 0,
    expenses: 0,
    expensesFixed: 0,
    expensesSporadic: 0,
    expenseCount: 0,
    usdBilled: 0,
    usdCollected: 0,
    usdFees: 0,
    usdOutstanding: 0,
    usdCogs: 0,
    usdExpenses: 0,
    usdExpensesFixed: 0,
    usdExpensesSporadic: 0,
  });

  const buckets = new Map<string, Bucket>();
  const bucketOf = (locationId: string): Bucket => {
    const existing = buckets.get(locationId);
    if (existing) return existing;
    const created = emptyBucket();
    buckets.set(locationId, created);
    return created;
  };

  const monthly = new Map<string, { ingresos: number; salidas: number }>();
  const trendFromKey = monthKey(trendStart.toISOString());

  for (const order of orders) {
    const currency = order.currency ?? "USD";
    const rate = order.exchange_rate_to_usd || 1;
    const totalUsd = toUsd(order.total, currency, rate);
    const bucket = bucketOf(order.location_id);

    // Saldo pendiente: acumulado histórico, independiente del periodo.
    const balance = order.total - (paidByOrder.get(order.id) ?? 0);
    if (balance > 0) {
      bucket.outstanding += balance;
      bucket.usdOutstanding += toUsd(balance, currency, rate);
    }

    const key = monthKey(order.created_at);
    if (key >= trendFromKey) {
      const row = monthly.get(key) ?? { ingresos: 0, salidas: 0 };
      row.ingresos += totalUsd;
      monthly.set(key, row);
    }

    if (order.created_at < period.fromIso || order.created_at > period.toIso) continue;

    bucket.billed += order.total;
    bucket.usdBilled += totalUsd;
    bucket.orderCount += 1;
    if (order.total <= 0) bucket.ordersWithoutValue += 1;

    const cost = costByOrder.get(order.id) ?? 0;
    bucket.cogs += cost;
    bucket.usdCogs += toUsd(cost, currency, rate);
  }

  const channelFees = new Map<string, ChannelFeeRow>();

  for (const payment of payments) {
    if (payment.paid_at < period.fromIso || payment.paid_at > period.toIso) continue;
    const order = orderById.get(payment.order_id);
    if (!order) continue;
    const currency = order.currency ?? "USD";
    const rate = order.exchange_rate_to_usd || 1;
    const amountUsd = toUsd(payment.amount, currency, rate);
    const fee = payment.fee_amount ?? 0;
    const feeUsd = toUsd(fee, currency, rate);

    const bucket = bucketOf(order.location_id);
    bucket.collected += payment.amount;
    bucket.usdCollected += amountUsd;
    bucket.fees += fee;
    bucket.usdFees += feeUsd;
    if (fee > 0) bucket.feeCount += 1;

    // El medio de cobro se agrupa siempre, cobre o no comisión: ver que el 70%
    // entra por datáfono es la mitad de la lectura; la otra mitad es cuánto
    // cuesta que entre por ahí.
    const channelName = payment.payment_channels?.name ?? "Sin medio registrado";
    const row = channelFees.get(channelName) ?? {
      channelName,
      collectedUsd: 0,
      feeUsd: 0,
      count: 0,
    };
    row.collectedUsd += amountUsd;
    row.feeUsd += feeUsd;
    row.count += 1;
    channelFees.set(channelName, row);
  }

  const breakdown = new Map<string, ExpenseBreakdownRow>();

  for (const expense of expenses) {
    const amountUsd = toUsd(expense.amount, expense.currency, expense.exchange_rate_to_usd || 1);
    const key = monthKey(expense.expense_date);
    if (key >= trendFromKey) {
      const row = monthly.get(key) ?? { ingresos: 0, salidas: 0 };
      row.salidas += amountUsd;
      monthly.set(key, row);
    }

    if (expense.expense_date < period.from || expense.expense_date > period.to) continue;

    const bucket = bucketOf(expense.location_id);
    bucket.expenses += expense.amount;
    bucket.usdExpenses += amountUsd;
    bucket.expenseCount += 1;
    if (expense.expense_categories?.kind === "fixed") {
      bucket.expensesFixed += expense.amount;
      bucket.usdExpensesFixed += amountUsd;
    } else {
      bucket.expensesSporadic += expense.amount;
      bucket.usdExpensesSporadic += amountUsd;
    }

    const categoryName = expense.expense_categories?.name ?? "Sin categoría";
    const entry = breakdown.get(categoryName) ?? {
      categoryName,
      kind: expense.expense_categories?.kind ?? "sporadic",
      amountUsd: 0,
      count: 0,
    };
    entry.amountUsd += amountUsd;
    entry.count += 1;
    breakdown.set(categoryName, entry);
  }

  // Regalía: se causa sobre la sede origen y se acredita a la beneficiaria.
  const sourceLocation = (locations ?? []).find((l) => l.code === royalty.sourceLocationCode);
  const sourceBucket = sourceLocation ? bucketOf(sourceLocation.id) : null;
  const royaltyBase = sourceBucket
    ? royalty.base === "collected"
      ? sourceBucket.collected
      : sourceBucket.billed
    : 0;
  const royaltyBaseUsd = sourceBucket
    ? royalty.base === "collected"
      ? sourceBucket.usdCollected
      : sourceBucket.usdBilled
    : 0;
  const royaltyAmount = round2((royaltyBase * royalty.percent) / 100);
  const royaltyAmountUsd = round2((royaltyBaseUsd * royalty.percent) / 100);

  const locationRows: LocationFinance[] = (locations ?? []).map((location) => {
    const bucket = buckets.get(location.id) ?? emptyBucket();
    const isSource = location.code === royalty.sourceLocationCode;
    const isBeneficiary = location.code === royalty.beneficiaryLocationCode;

    const royaltyOut = isSource ? royaltyAmount : 0;
    const royaltyOutUsd = isSource ? royaltyAmountUsd : 0;
    // La beneficiaria recibe el valor en SU moneda, por eso entra en USD y no
    // en la moneda de la sede origen.
    const royaltyInUsd = isBeneficiary ? royaltyAmountUsd : 0;
    const royaltyIn = isBeneficiary && location.currency === "USD" ? royaltyAmountUsd : 0;

    const grossMargin = bucket.billed - bucket.cogs;
    /*
     * La comisión se resta acá y NO se registra como salida de dinero: es un
     * descuento que ocurre antes de que la plata llegue a la caja. Registrarla
     * además como gasto en "Comisiones bancarias" la contaría dos veces.
     */
    const net = grossMargin - bucket.expenses - bucket.fees - royaltyOut + royaltyIn;

    return {
      locationId: location.id,
      code: location.code,
      name: location.name,
      country: location.country,
      currency: location.currency,
      isRoyaltySource: isSource,
      isRoyaltyBeneficiary: isBeneficiary,
      billed: round2(bucket.billed),
      orderCount: bucket.orderCount,
      ordersWithoutValue: bucket.ordersWithoutValue,
      collected: round2(bucket.collected),
      fees: round2(bucket.fees),
      feeCount: bucket.feeCount,
      outstanding: round2(bucket.outstanding),
      cogs: round2(bucket.cogs),
      expenses: round2(bucket.expenses),
      expensesFixed: round2(bucket.expensesFixed),
      expensesSporadic: round2(bucket.expensesSporadic),
      expenseCount: bucket.expenseCount,
      royaltyOut,
      royaltyIn,
      grossMargin: round2(grossMargin),
      net: round2(net),
      cashFlow: round2(
        bucket.collected - bucket.fees - bucket.expenses - royaltyOut + royaltyIn,
      ),
      usd: {
        billed: round2(bucket.usdBilled),
        collected: round2(bucket.usdCollected),
        fees: round2(bucket.usdFees),
        outstanding: round2(bucket.usdOutstanding),
        cogs: round2(bucket.usdCogs),
        expenses: round2(bucket.usdExpenses),
        expensesFixed: round2(bucket.usdExpensesFixed),
        expensesSporadic: round2(bucket.usdExpensesSporadic),
        royaltyOut: royaltyOutUsd,
        royaltyIn: royaltyInUsd,
        grossMargin: round2(bucket.usdBilled - bucket.usdCogs),
        net: round2(
          bucket.usdBilled -
            bucket.usdCogs -
            bucket.usdExpenses -
            bucket.usdFees -
            royaltyOutUsd +
            royaltyInUsd,
        ),
      },
    };
  });

  const sum = (pick: (row: LocationFinance) => number) =>
    round2(locationRows.reduce((acc, row) => acc + pick(row), 0));

  const monthlyRows: MonthlyFinanceRow[] = [];
  for (let i = TREND_MONTHS - 1; i >= 0; i -= 1) {
    const date = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - i, 1));
    const key = monthKey(date.toISOString());
    const row = monthly.get(key) ?? { ingresos: 0, salidas: 0 };
    monthlyRows.push({
      month: monthLabel(key),
      ingresos: round2(row.ingresos),
      salidas: round2(row.salidas),
      neto: round2(row.ingresos - row.salidas),
    });
  }

  return {
    period,
    royalty,
    locations: locationRows,
    consolidated: {
      billed: sum((r) => r.usd.billed),
      collected: sum((r) => r.usd.collected),
      fees: sum((r) => r.usd.fees),
      outstanding: sum((r) => r.usd.outstanding),
      cogs: sum((r) => r.usd.cogs),
      expenses: sum((r) => r.usd.expenses),
      expensesFixed: sum((r) => r.usd.expensesFixed),
      expensesSporadic: sum((r) => r.usd.expensesSporadic),
      grossMargin: sum((r) => r.usd.grossMargin),
      // La regalía es un traslado interno: sale de una sede y entra a otra, no
      // cambia el consolidado del grupo. Se reporta aparte, no se resta.
      royalty: royaltyAmountUsd,
      net: sum((r) => r.usd.net),
    },
    expenseBreakdown: [...breakdown.values()]
      .map((row) => ({ ...row, amountUsd: round2(row.amountUsd) }))
      .sort((a, b) => b.amountUsd - a.amountUsd),
    channelFees: [...channelFees.values()]
      .map((row) => ({
        ...row,
        collectedUsd: round2(row.collectedUsd),
        feeUsd: round2(row.feeUsd),
      }))
      .sort((a, b) => b.collectedUsd - a.collectedUsd),
    monthly: monthlyRows,
    ordersInPeriod: locationRows.reduce((acc, row) => acc + row.orderCount, 0),
    ordersWithoutValue: locationRows.reduce((acc, row) => acc + row.ordersWithoutValue, 0),
    hasAnyExpense: expenses.length > 0,
    hasAnyBaseCost: (baseCostCount ?? 0) > 0,
  };
}
