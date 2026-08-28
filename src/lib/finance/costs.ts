import "server-only";
import { createClient } from "@/lib/supabase/server";
import { fetchAllRows } from "@/lib/supabase/fetch-all";
import { toUsd } from "@/lib/currency/exchange";
import type { Period } from "./period";
import type { CurrencyCode, GarmentType } from "@/types/database.types";

export interface BaseCostRow {
  id: string;
  garmentType: GarmentType;
  garmentModelId: string | null;
  garmentModelName: string | null;
  locationId: string | null;
  locationName: string | null;
  currency: CurrencyCode;
  fabricCost: number;
  laborCost: number;
  overheadCost: number;
  totalCost: number;
  notes: string | null;
  isActive: boolean;
  /** Cuán específico es el alcance: 3 = modelo+sede, 0 = todo. Ver 0030_*.sql. */
  specificity: number;
  scopeLabel: string;
}

export interface PieceMarginRow {
  garmentType: GarmentType;
  unitsSold: number;
  revenueUsd: number;
  costUsd: number;
  marginUsd: number;
  marginPercent: number | null;
  /** Piezas vendidas sin costo base cargado — margen incompleto. */
  unitsWithoutCost: number;
  /**
   * Piezas sin precio de venta registrado. Separado de `unitsWithoutCost`
   * porque la causa es otra y el mensaje al usuario también: una pieza sin
   * costo infla el margen, una sin precio hace que no haya margen que medir.
   */
  unitsWithoutPrice: number;
}

function scopeLabelOf(modelName: string | null, locationName: string | null): string {
  if (modelName && locationName) return `${modelName} · ${locationName}`;
  if (modelName) return `${modelName} · todas las sedes`;
  if (locationName) return `Todos los modelos · ${locationName}`;
  return "Todos los modelos · todas las sedes";
}

export async function getBaseCosts(): Promise<BaseCostRow[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("garment_base_costs")
    .select(
      "id, garment_type, garment_model_id, location_id, currency, fabric_cost, labor_cost, overhead_cost, total_cost, notes, is_active, garment_models(name), locations(name)",
    )
    .order("garment_type");

  return (data ?? [])
    .map((row) => {
      const modelName = (row.garment_models as unknown as { name: string } | null)?.name ?? null;
      const locationName = (row.locations as unknown as { name: string } | null)?.name ?? null;
      return {
        id: row.id,
        garmentType: row.garment_type,
        garmentModelId: row.garment_model_id,
        garmentModelName: modelName,
        locationId: row.location_id,
        locationName,
        currency: row.currency,
        fabricCost: row.fabric_cost,
        laborCost: row.labor_cost,
        overheadCost: row.overhead_cost,
        totalCost: row.total_cost,
        notes: row.notes,
        isActive: row.is_active,
        specificity: (row.garment_model_id ? 2 : 0) + (row.location_id ? 1 : 0),
        scopeLabel: scopeLabelOf(modelName, locationName),
      };
    })
    .sort((a, b) =>
      a.garmentType === b.garmentType
        ? b.specificity - a.specificity
        : a.garmentType.localeCompare(b.garmentType),
    );
}

/**
 * Margen real por tipo de prenda en el periodo: lo que se cobró contra el
 * costo base congelado en cada pieza.
 *
 * `unitsWithoutCost` es la métrica honesta del módulo: mientras haya piezas
 * sin costo cargado, el margen que se muestra está inflado, y la pantalla lo
 * dice en vez de fingir precisión.
 */
export async function getPieceMargins(period: Period): Promise<PieceMarginRow[]> {
  const supabase = await createClient();

  const rows = await fetchAllRows<{
    garment_type: GarmentType;
    quantity: number;
    line_total: number;
    line_cost: number;
    unit_cost: number;
    unit_price: number;
    orders: { currency: CurrencyCode | null; exchange_rate_to_usd: number } | null;
  }>((from, to) =>
    supabase
      .from("order_items")
      .select(
        "garment_type, quantity, line_total, line_cost, unit_cost, unit_price, orders!inner(currency, exchange_rate_to_usd)",
      )
      .gte("orders.created_at", period.fromIso)
      .lte("orders.created_at", period.toIso)
      .neq("orders.status", "cancelled")
      .range(from, to),
  );

  const byType = new Map<GarmentType, PieceMarginRow>();

  for (const row of rows) {
    const currency = row.orders?.currency ?? "USD";
    const rate = row.orders?.exchange_rate_to_usd || 1;
    const entry =
      byType.get(row.garment_type) ??
      ({
        garmentType: row.garment_type,
        unitsSold: 0,
        revenueUsd: 0,
        costUsd: 0,
        marginUsd: 0,
        marginPercent: null,
        unitsWithoutCost: 0,
        unitsWithoutPrice: 0,
      } satisfies PieceMarginRow);

    entry.unitsSold += row.quantity;
    entry.revenueUsd += toUsd(row.line_total ?? 0, currency, rate);
    entry.costUsd += toUsd(row.line_cost ?? 0, currency, rate);
    if (!row.unit_cost) entry.unitsWithoutCost += row.quantity;
    if (!row.unit_price) entry.unitsWithoutPrice += row.quantity;

    byType.set(row.garment_type, entry);
  }

  return [...byType.values()]
    .map((row) => {
      const revenueUsd = Math.round(row.revenueUsd * 100) / 100;
      const costUsd = Math.round(row.costUsd * 100) / 100;
      const marginUsd = Math.round((revenueUsd - costUsd) * 100) / 100;
      return {
        ...row,
        revenueUsd,
        costUsd,
        marginUsd,
        marginPercent: revenueUsd > 0 ? Math.round((marginUsd / revenueUsd) * 1000) / 10 : null,
      };
    })
    .sort((a, b) => b.revenueUsd - a.revenueUsd);
}

/** Catálogo para el selector de alcance del formulario de costo base. */
export async function getCostScopeOptions(): Promise<{
  models: { id: string; name: string; garmentType: GarmentType }[];
  locations: { id: string; name: string; currency: CurrencyCode }[];
}> {
  const supabase = await createClient();
  const [{ data: models }, { data: locations }] = await Promise.all([
    supabase
      .from("garment_models")
      .select("id, name, garment_type")
      .eq("is_active", true)
      .order("garment_type")
      .order("name"),
    supabase.from("locations").select("id, name, currency").eq("is_active", true).order("code"),
  ]);

  return {
    models: (models ?? []).map((m) => ({
      id: m.id,
      name: m.name,
      garmentType: m.garment_type,
    })),
    locations: locations ?? [],
  };
}
