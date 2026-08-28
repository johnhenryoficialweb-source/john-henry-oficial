import "server-only";
import { createClient } from "@/lib/supabase/server";
import { toUsd } from "@/lib/currency/exchange";

export interface ReceivableRow {
  orderId: string;
  orderNumber: string | null;
  clientName: string;
  locationName: string;
  currency: string;
  total: number;
  paid: number;
  balance: number;
}

export async function getReceivables(): Promise<ReceivableRow[]> {
  const supabase = await createClient();

  const { data: orders } = await supabase
    .from("orders")
    .select("id, order_number, total, currency, clients(full_name), locations(name)")
    .is("deleted_at", null)
    .neq("status", "cancelled")
    .order("created_at", { ascending: false });

  if (!orders || orders.length === 0) return [];

  const { data: payments } = await supabase
    .from("payments")
    .select("order_id, amount")
    .in("order_id", orders.map((o) => o.id));

  const paidByOrder = new Map<string, number>();
  for (const p of payments ?? []) {
    paidByOrder.set(p.order_id, (paidByOrder.get(p.order_id) ?? 0) + p.amount);
  }

  return orders
    .map((order) => {
      const client = order.clients as unknown as { full_name: string } | null;
      const location = order.locations as unknown as { name: string } | null;
      const paid = paidByOrder.get(order.id) ?? 0;
      return {
        orderId: order.id,
        orderNumber: order.order_number,
        clientName: client?.full_name ?? "—",
        locationName: location?.name ?? "—",
        currency: order.currency ?? "USD",
        total: order.total,
        paid,
        balance: Math.round((order.total - paid) * 100) / 100,
      };
    })
    .filter((row) => row.balance > 0);
}

export interface PaymentLedgerRow {
  id: string;
  paidAt: string;
  amount: number;
  currency: string;
  method: string;
  /** Medio por el que entró: efectivo, datáfono, pasarela. */
  channelName: string | null;
  /** Comisión retenida por ese medio, congelada al registrar el cobro. */
  fee: number;
  /** Lo que quedó en caja: amount − fee. */
  net: number;
  orderId: string | null;
  orderNumber: string | null;
  clientName: string;
  locationName: string;
}

export async function getPaymentsLedger(): Promise<PaymentLedgerRow[]> {
  const supabase = await createClient();

  const { data } = await supabase
    .from("payments")
    .select(
      "id, paid_at, amount, currency, method, fee_amount, net_amount, payment_channels(name), orders(id, order_number, clients(full_name), locations(name))",
    )
    .order("paid_at", { ascending: false })
    .limit(200);

  return (data ?? []).map((p) => {
    const order = p.orders as unknown as {
      id: string;
      order_number: string | null;
      clients: { full_name: string } | null;
      locations: { name: string } | null;
    } | null;
    const channel = p.payment_channels as unknown as { name: string } | null;
    return {
      id: p.id,
      paidAt: p.paid_at,
      amount: p.amount,
      currency: p.currency,
      method: p.method,
      channelName: channel?.name ?? null,
      fee: p.fee_amount ?? 0,
      net: p.net_amount ?? p.amount,
      orderId: order?.id ?? null,
      orderNumber: order?.order_number ?? null,
      clientName: order?.clients?.full_name ?? "—",
      locationName: order?.locations?.name ?? "—",
    };
  });
}

export interface FinanceReport {
  totalCop: number;
  totalUsdNative: number;
  consolidatedUsd: number;
  monthlyByLocation: { month: string; CO: number; PA: number }[];
}

export interface ChannelFeeReportRow {
  channelName: string;
  /** Porcentaje vigente hoy en la configuración del canal. */
  currentPercent: number | null;
  count: number;
  collectedUsd: number;
  feeUsd: number;
}

export interface PaymentFeeReport {
  from: string;
  to: string;
  collectedUsd: number;
  feeUsd: number;
  /** Cuánto pesa la comisión sobre todo lo cobrado, en porcentaje. */
  effectivePercent: number;
  byChannel: ChannelFeeReportRow[];
  byMonth: { month: string; feeUsd: number }[];
  /** Canales activos que cobran comisión pero siguen configurados en 0%. */
  unconfiguredChannels: string[];
}

/**
 * Lo que costó cobrar: comisiones de datáfonos y pasarelas en un periodo.
 *
 * Se lee de los pagos, no de las salidas de dinero: la comisión nunca sale de
 * la caja porque nunca entró — el adquirente la descuenta antes de consignar.
 * Contarla como egreso además de descontarla del cobro la duplicaría.
 */
export async function getPaymentFees(
  params: { from?: string; to?: string } = {}
): Promise<PaymentFeeReport> {
  const supabase = await createClient();
  const now = new Date();
  const from = params.from
    ? new Date(params.from)
    : new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 5, 1));
  const to = params.to ? new Date(`${params.to}T23:59:59.999Z`) : now;

  const [{ data: payments }, { data: channels }] = await Promise.all([
    supabase
      .from("payments")
      .select(
        "amount, fee_amount, paid_at, payment_channels(name), orders!inner(currency, exchange_rate_to_usd)",
      )
      .gte("paid_at", from.toISOString())
      .lte("paid_at", to.toISOString()),
    supabase
      .from("payment_channels")
      .select("name, fee_percent, fee_fixed, method, is_active")
      .eq("is_active", true),
  ]);

  const percentByChannel = new Map(
    (channels ?? []).map((channel) => [channel.name, Number(channel.fee_percent) || 0]),
  );

  const byChannel = new Map<string, ChannelFeeReportRow>();
  const byMonth = new Map<string, number>();
  let collectedUsd = 0;
  let feeUsd = 0;

  for (const payment of payments ?? []) {
    const order = payment.orders as unknown as {
      currency: "COP" | "USD" | null;
      exchange_rate_to_usd: number;
    } | null;
    const currency = order?.currency ?? "USD";
    const rate = order?.exchange_rate_to_usd || 1;
    const amount = toUsd(payment.amount, currency, rate);
    const fee = toUsd(payment.fee_amount ?? 0, currency, rate);

    collectedUsd += amount;
    feeUsd += fee;

    const channel = payment.payment_channels as unknown as { name: string } | null;
    const channelName = channel?.name ?? "Sin medio registrado";
    const row = byChannel.get(channelName) ?? {
      channelName,
      currentPercent: percentByChannel.get(channelName) ?? null,
      count: 0,
      collectedUsd: 0,
      feeUsd: 0,
    };
    row.count += 1;
    row.collectedUsd += amount;
    row.feeUsd += fee;
    byChannel.set(channelName, row);

    if (fee > 0) {
      const key = payment.paid_at.slice(0, 7);
      byMonth.set(key, (byMonth.get(key) ?? 0) + fee);
    }
  }

  const round2 = (value: number) => Math.round(value * 100) / 100;

  return {
    from: from.toISOString().slice(0, 10),
    to: to.toISOString().slice(0, 10),
    collectedUsd: round2(collectedUsd),
    feeUsd: round2(feeUsd),
    effectivePercent: collectedUsd > 0 ? Math.round((feeUsd / collectedUsd) * 1000) / 10 : 0,
    byChannel: [...byChannel.values()]
      .map((row) => ({
        ...row,
        collectedUsd: round2(row.collectedUsd),
        feeUsd: round2(row.feeUsd),
      }))
      .sort((a, b) => b.feeUsd - a.feeUsd || b.collectedUsd - a.collectedUsd),
    byMonth: [...byMonth.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, value]) => {
        const [year, month] = key.split("-").map(Number);
        return { month: `${MONTH_NAMES[month - 1]} ${year}`, feeUsd: round2(value) };
      }),
    unconfiguredChannels: (channels ?? [])
      .filter(
        (channel) =>
          channel.method !== "cash" &&
          Number(channel.fee_percent) === 0 &&
          Number(channel.fee_fixed) === 0,
      )
      .map((channel) => channel.name),
  };
}

const MONTH_NAMES = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];

export async function getFinanceReport(params: { from?: string; to?: string } = {}): Promise<FinanceReport> {
  const supabase = await createClient();
  const now = new Date();
  const from = params.from ? new Date(params.from) : new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 5, 1));
  const to = params.to ? new Date(params.to) : now;

  const { data: orders } = await supabase
    .from("orders")
    .select("total, currency, exchange_rate_to_usd, created_at, locations(code)")
    .is("deleted_at", null)
    .neq("status", "cancelled")
    .gte("created_at", from.toISOString())
    .lte("created_at", to.toISOString());

  let totalCop = 0;
  let totalUsdNative = 0;
  let consolidatedUsd = 0;
  const monthlyMap = new Map<string, { CO: number; PA: number }>();

  for (const order of orders ?? []) {
    const location = order.locations as unknown as { code: string } | null;
    const totalUsd = toUsd(order.total, order.currency ?? "USD", order.exchange_rate_to_usd);
    consolidatedUsd += totalUsd;

    if (order.currency === "COP") totalCop += order.total;
    if (order.currency === "USD") totalUsdNative += order.total;

    const createdAt = new Date(order.created_at);
    const key = `${createdAt.getUTCFullYear()}-${createdAt.getUTCMonth()}`;
    const entry = monthlyMap.get(key) ?? { CO: 0, PA: 0 };
    if (location?.code === "CO") entry.CO += totalUsd;
    if (location?.code === "PA") entry.PA += totalUsd;
    monthlyMap.set(key, entry);
  }

  const monthlyByLocation: FinanceReport["monthlyByLocation"] = [];
  const cursor = new Date(Date.UTC(from.getUTCFullYear(), from.getUTCMonth(), 1));
  const end = new Date(Date.UTC(to.getUTCFullYear(), to.getUTCMonth(), 1));
  while (cursor <= end) {
    const key = `${cursor.getUTCFullYear()}-${cursor.getUTCMonth()}`;
    const entry = monthlyMap.get(key) ?? { CO: 0, PA: 0 };
    monthlyByLocation.push({
      month: `${MONTH_NAMES[cursor.getUTCMonth()]} ${cursor.getUTCFullYear()}`,
      CO: Math.round(entry.CO * 100) / 100,
      PA: Math.round(entry.PA * 100) / 100,
    });
    cursor.setUTCMonth(cursor.getUTCMonth() + 1);
  }

  return {
    totalCop: Math.round(totalCop * 100) / 100,
    totalUsdNative: Math.round(totalUsdNative * 100) / 100,
    consolidatedUsd: Math.round(consolidatedUsd * 100) / 100,
    monthlyByLocation,
  };
}
