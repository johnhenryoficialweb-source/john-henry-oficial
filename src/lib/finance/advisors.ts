import "server-only";
import { createClient } from "@/lib/supabase/server";
import { toUsd } from "@/lib/currency/exchange";
import { fetchAllRows } from "@/lib/supabase/fetch-all";
import type { CurrencyCode } from "@/types/database.types";

/**
 * Vendido por asesor.
 *
 * La atribución sale de `orders.assigned_staff_id` —quién atendió— y no de
 * `created_by`, que es quién digitó la orden en el sistema. Los dos coinciden
 * casi siempre, pero no cuando alguien carga a mano las ventas de otro, que es
 * exactamente lo que va a pasar mientras se digitaliza el histórico: contar por
 * `created_by` le abonaría mil ventas ajenas a quien las transcribió.
 *
 * Las órdenes sin asesor no se esconden ni se reparten: van a su propia fila.
 * Un ranking que suma 60 millones cuando el mes facturó 80 es un ranking en el
 * que nadie cree, y el hueco es además la lista de trabajo — las órdenes a las
 * que todavía hay que asignarles quién las atendió.
 */

export interface AdvisorSalesRow {
  staffId: string | null;
  fullName: string;
  locationName: string | null;
  orderCount: number;
  /** Consolidado a USD para poder comparar Bogotá con Panamá. */
  soldUsd: number;
  /** Vendido en la moneda nativa de cada sede, sin mezclar. */
  soldByCurrency: Partial<Record<CurrencyCode, number>>;
  /** Órdenes del asesor que todavía están en $0 (histórico sin precio). */
  unpricedOrders: number;
}

export interface AdvisorSalesReport {
  rows: AdvisorSalesRow[];
  totalUsd: number;
  totalOrders: number;
  /** Órdenes del periodo sin asesor asignado: el trabajo pendiente. */
  unassignedOrders: number;
  /** Órdenes del periodo sin valor cargado: distorsionan cualquier ranking. */
  unpricedOrders: number;
}

interface AdvisorOrderRow {
  id: string;
  total: number;
  currency: CurrencyCode | null;
  exchange_rate_to_usd: number;
  assigned_staff_id: string | null;
  staff_users: unknown;
  locations: unknown;
}

export async function getAdvisorSales(params: {
  fromIso: string;
  toIso: string;
}): Promise<AdvisorSalesReport> {
  const supabase = await createClient();

  const orders = await fetchAllRows<AdvisorOrderRow>((from, to) =>
    supabase
      .from("orders")
      .select(
        "id, total, currency, exchange_rate_to_usd, assigned_staff_id, staff_users:assigned_staff_id(full_name), locations(name)"
      )
      .is("deleted_at", null)
      .neq("status", "cancelled")
      .gte("created_at", params.fromIso)
      .lte("created_at", params.toIso)
      .range(from, to)
  );

  const byAdvisor = new Map<string, AdvisorSalesRow>();
  let totalUsd = 0;
  let unassignedOrders = 0;
  let unpricedOrders = 0;

  for (const order of orders ?? []) {
    const staff = order.staff_users as unknown as { full_name: string } | null;
    const location = order.locations as unknown as { name: string } | null;
    const currency = order.currency ?? "USD";
    const soldUsd = toUsd(order.total, currency, order.exchange_rate_to_usd);
    const isUnpriced = order.total === 0;

    if (!order.assigned_staff_id) unassignedOrders += 1;
    if (isUnpriced) unpricedOrders += 1;
    totalUsd += soldUsd;

    const key = order.assigned_staff_id ?? "__unassigned__";
    const row = byAdvisor.get(key) ?? {
      staffId: order.assigned_staff_id,
      fullName: staff?.full_name ?? "Sin asesor asignado",
      locationName: location?.name ?? null,
      orderCount: 0,
      soldUsd: 0,
      soldByCurrency: {},
      unpricedOrders: 0,
    };

    row.orderCount += 1;
    row.soldUsd += soldUsd;
    row.soldByCurrency[currency] = (row.soldByCurrency[currency] ?? 0) + order.total;
    if (isUnpriced) row.unpricedOrders += 1;
    // Un asesor puede vender en las dos sedes; la columna deja de afirmar una.
    if (row.locationName && location?.name && row.locationName !== location.name) {
      row.locationName = "Ambas sedes";
    }

    byAdvisor.set(key, row);
  }

  const rows = [...byAdvisor.values()].sort((a, b) => {
    // Sin asesor siempre al final: es una fila de pendientes, no un competidor.
    if (a.staffId === null) return 1;
    if (b.staffId === null) return -1;
    return b.soldUsd - a.soldUsd;
  });

  for (const row of rows) {
    row.soldUsd = Math.round(row.soldUsd * 100) / 100;
    for (const [currency, amount] of Object.entries(row.soldByCurrency)) {
      row.soldByCurrency[currency as CurrencyCode] = Math.round((amount ?? 0) * 100) / 100;
    }
  }

  return {
    rows,
    totalUsd: Math.round(totalUsd * 100) / 100,
    totalOrders: orders?.length ?? 0,
    unassignedOrders,
    unpricedOrders,
  };
}
