import "server-only";
import { createClient } from "@/lib/supabase/server";
import { toUsd } from "@/lib/currency/exchange";
import type { OrderStatus } from "@/types/database.types";

const MONTH_NAMES = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];

function startOfDay(date: Date) {
  const d = new Date(date);
  d.setUTCHours(0, 0, 0, 0);
  return d;
}

function startOfMonth(date: Date) {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1));
}

export interface DashboardData {
  appointmentsToday: number;
  appointmentsWeek: number;
  ordersByStatus: Record<OrderStatus, number>;
  revenueThisMonthByLocation: { locationName: string; locationCode: string; totalUsd: number }[];
  revenueThisMonthConsolidatedUsd: number;
  avgTicketUsd: number;
  newClientsThisMonth: number;
  recurringClientsThisMonth: number;
  monthlyTrend: { month: string; totalUsd: number }[];
}

export async function getDashboardData(): Promise<DashboardData> {
  const supabase = await createClient();
  const now = new Date();
  const todayStart = startOfDay(now);
  const todayEnd = new Date(todayStart.getTime() + 24 * 60 * 60 * 1000);
  const weekStart = new Date(todayStart.getTime() - todayStart.getUTCDay() * 24 * 60 * 60 * 1000);
  const weekEnd = new Date(weekStart.getTime() + 7 * 24 * 60 * 60 * 1000);
  const monthStart = startOfMonth(now);
  const sixMonthsAgo = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 5, 1));

  const [
    { count: appointmentsToday },
    { count: appointmentsWeek },
    { data: orders },
    { data: clients },
  ] = await Promise.all([
    supabase
      .from("appointments")
      .select("*", { count: "exact", head: true })
      .neq("status", "cancelled")
      .gte("starts_at", todayStart.toISOString())
      .lt("starts_at", todayEnd.toISOString()),
    supabase
      .from("appointments")
      .select("*", { count: "exact", head: true })
      .neq("status", "cancelled")
      .gte("starts_at", weekStart.toISOString())
      .lt("starts_at", weekEnd.toISOString()),
    supabase
      .from("orders")
      .select("id, status, total, currency, exchange_rate_to_usd, location_id, client_id, created_at, locations(name, code)")
      .is("deleted_at", null)
      .gte("created_at", sixMonthsAgo.toISOString()),
    supabase.from("clients").select("id, created_at").is("deleted_at", null),
  ]);

  const ordersByStatus: Record<OrderStatus, number> = {
    draft: 0,
    confirmed: 0,
    in_production: 0,
    ready_for_delivery: 0,
    delivered: 0,
    cancelled: 0,
  };

  const revenueByLocation = new Map<string, { locationName: string; locationCode: string; totalUsd: number }>();
  let revenueThisMonthConsolidatedUsd = 0;
  let ticketCount = 0;
  let ticketSumUsd = 0;
  const monthlyTrendMap = new Map<string, number>();
  const clientIdsWithOrdersThisMonth = new Set<string>();

  for (const order of orders ?? []) {
    ordersByStatus[order.status] = (ordersByStatus[order.status] ?? 0) + 1;

    if (order.status === "cancelled") continue;

    const totalUsd = toUsd(order.total, order.currency ?? "USD", order.exchange_rate_to_usd);
    const createdAt = new Date(order.created_at);
    const monthKey = `${createdAt.getUTCFullYear()}-${createdAt.getUTCMonth()}`;
    monthlyTrendMap.set(monthKey, (monthlyTrendMap.get(monthKey) ?? 0) + totalUsd);

    if (createdAt >= monthStart) {
      revenueThisMonthConsolidatedUsd += totalUsd;
      ticketCount += 1;
      ticketSumUsd += totalUsd;
      clientIdsWithOrdersThisMonth.add(order.client_id);

      const location = order.locations as unknown as { name: string; code: string } | null;
      if (location) {
        const existing = revenueByLocation.get(location.code) ?? {
          locationName: location.name,
          locationCode: location.code,
          totalUsd: 0,
        };
        existing.totalUsd += totalUsd;
        revenueByLocation.set(location.code, existing);
      }
    }
  }

  const monthlyTrend: { month: string; totalUsd: number }[] = [];
  for (let i = 5; i >= 0; i--) {
    const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - i, 1));
    const key = `${d.getUTCFullYear()}-${d.getUTCMonth()}`;
    monthlyTrend.push({ month: MONTH_NAMES[d.getUTCMonth()], totalUsd: Math.round((monthlyTrendMap.get(key) ?? 0) * 100) / 100 });
  }

  const clientsCreatedBefore = new Set<string>();
  let newClientsThisMonth = 0;
  for (const client of clients ?? []) {
    const createdAt = new Date(client.created_at);
    if (createdAt >= monthStart) {
      newClientsThisMonth += 1;
    } else {
      clientsCreatedBefore.add(client.id);
    }
  }

  let recurringClientsThisMonth = 0;
  for (const clientId of clientIdsWithOrdersThisMonth) {
    if (clientsCreatedBefore.has(clientId)) recurringClientsThisMonth += 1;
  }

  return {
    appointmentsToday: appointmentsToday ?? 0,
    appointmentsWeek: appointmentsWeek ?? 0,
    ordersByStatus,
    revenueThisMonthByLocation: Array.from(revenueByLocation.values()),
    revenueThisMonthConsolidatedUsd: Math.round(revenueThisMonthConsolidatedUsd * 100) / 100,
    avgTicketUsd: ticketCount > 0 ? Math.round((ticketSumUsd / ticketCount) * 100) / 100 : 0,
    newClientsThisMonth,
    recurringClientsThisMonth,
    monthlyTrend,
  };
}
