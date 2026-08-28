import "server-only";
import { createClient } from "@/lib/supabase/server";
import { fetchAllRows } from "@/lib/supabase/fetch-all";
import { toUsd } from "@/lib/currency/exchange";
import { periodKeyOf, type Period } from "./period";
import type { ExpenseCategory } from "./labels";
import type { CurrencyCode, ExpenseKind, PaymentMethod } from "@/types/database.types";

export type { ExpenseCategory };

export interface ExpenseRow {
  id: string;
  date: string;
  description: string;
  amount: number;
  currency: CurrencyCode;
  amountUsd: number;
  method: PaymentMethod;
  vendor: string | null;
  reference: string | null;
  categoryId: string | null;
  categoryName: string;
  kind: ExpenseKind;
  locationId: string;
  locationName: string;
  isGenerated: boolean;
}

export interface RecurringExpense {
  id: string;
  locationId: string;
  locationName: string;
  categoryId: string;
  categoryName: string;
  description: string;
  amount: number;
  currency: CurrencyCode;
  dayOfMonth: number;
  method: PaymentMethod;
  vendor: string | null;
  isActive: boolean;
  startsOn: string;
  endsOn: string | null;
  /** Ya existe la salida generada para el mes en curso. */
  postedThisMonth: boolean;
}

export async function getExpenseCategories(includeInactive = false): Promise<ExpenseCategory[]> {
  const supabase = await createClient();
  let query = supabase
    .from("expense_categories")
    .select("id, name, code, kind, description, is_active, sort_order")
    .order("kind")
    .order("sort_order");

  if (!includeInactive) query = query.eq("is_active", true);

  const { data } = await query;

  return (data ?? []).map((row) => ({
    id: row.id,
    name: row.name,
    code: row.code,
    kind: row.kind,
    description: row.description,
    isActive: row.is_active,
    sortOrder: row.sort_order,
  }));
}

export interface ExpenseFilters {
  period: Period;
  locationId?: string;
  categoryId?: string;
  kind?: ExpenseKind;
}

export async function getExpenses(filters: ExpenseFilters): Promise<ExpenseRow[]> {
  const supabase = await createClient();

  const rows = await fetchAllRows<{
    id: string;
    expense_date: string;
    description: string;
    amount: number;
    currency: CurrencyCode;
    exchange_rate_to_usd: number;
    method: PaymentMethod;
    vendor: string | null;
    reference: string | null;
    category_id: string | null;
    location_id: string;
    recurring_expense_id: string | null;
    expense_categories: { name: string; kind: ExpenseKind } | null;
    locations: { name: string } | null;
  }>((from, to) => {
    let query = supabase
      .from("expenses")
      .select(
        "id, expense_date, description, amount, currency, exchange_rate_to_usd, method, vendor, reference, category_id, location_id, recurring_expense_id, expense_categories(name, kind), locations(name)",
      )
      .gte("expense_date", filters.period.from)
      .lte("expense_date", filters.period.to)
      .order("expense_date", { ascending: false })
      .range(from, to);

    if (filters.locationId) query = query.eq("location_id", filters.locationId);
    if (filters.categoryId) query = query.eq("category_id", filters.categoryId);
    if (filters.kind) query = query.eq("expense_categories.kind", filters.kind);

    return query;
  });

  return rows
    // El filtro por tipo vive en la categoría embebida: sin categoría, la fila
    // sigue llegando de PostgREST con `expense_categories: null`.
    .filter((row) => !filters.kind || row.expense_categories?.kind === filters.kind)
    .map((row) => ({
      id: row.id,
      date: row.expense_date,
      description: row.description,
      amount: row.amount,
      currency: row.currency,
      amountUsd: toUsd(row.amount, row.currency, row.exchange_rate_to_usd || 1),
      method: row.method,
      vendor: row.vendor,
      reference: row.reference,
      categoryId: row.category_id,
      categoryName: row.expense_categories?.name ?? "Sin categoría",
      kind: row.expense_categories?.kind ?? "sporadic",
      locationId: row.location_id,
      locationName: row.locations?.name ?? "—",
      isGenerated: row.recurring_expense_id !== null,
    }));
}

export async function getRecurringExpenses(): Promise<RecurringExpense[]> {
  const supabase = await createClient();
  const periodKey = periodKeyOf(new Date());

  const [{ data: templates }, { data: posted }] = await Promise.all([
    supabase
      .from("recurring_expenses")
      .select(
        "id, location_id, category_id, description, amount, currency, day_of_month, method, vendor, is_active, starts_on, ends_on, expense_categories(name), locations(name)",
      )
      .order("is_active", { ascending: false })
      .order("day_of_month"),
    supabase.from("expenses").select("recurring_expense_id").eq("period_key", periodKey),
  ]);

  const postedIds = new Set(
    (posted ?? []).map((row) => row.recurring_expense_id).filter((id): id is string => id !== null),
  );

  return (templates ?? []).map((row) => ({
    id: row.id,
    locationId: row.location_id,
    locationName: (row.locations as unknown as { name: string } | null)?.name ?? "—",
    categoryId: row.category_id,
    categoryName:
      (row.expense_categories as unknown as { name: string } | null)?.name ?? "Sin categoría",
    description: row.description,
    amount: row.amount,
    currency: row.currency,
    dayOfMonth: row.day_of_month,
    method: row.method,
    vendor: row.vendor,
    isActive: row.is_active,
    startsOn: row.starts_on,
    endsOn: row.ends_on,
    postedThisMonth: postedIds.has(row.id),
  }));
}

/**
 * Plantillas fijas que aún no se han registrado como salida en el mes en
 * curso. Alimenta el aviso de "tienes N salidas fijas pendientes" y el botón
 * que las genera de una (regla UX #2: si el sistema puede inferirlo, que no
 * lo teclee el usuario).
 */
export async function getPendingFixedExpenses(): Promise<{
  periodKey: string;
  pending: RecurringExpense[];
  totalByCurrency: Record<string, number>;
}> {
  const templates = await getRecurringExpenses();
  const today = new Date();
  const periodKey = periodKeyOf(today);

  const pending = templates.filter((template) => {
    if (!template.isActive || template.postedThisMonth) return false;
    if (template.startsOn > today.toISOString().slice(0, 10)) return false;
    if (template.endsOn && template.endsOn < today.toISOString().slice(0, 10)) return false;
    return true;
  });

  const totalByCurrency: Record<string, number> = {};
  for (const template of pending) {
    totalByCurrency[template.currency] =
      (totalByCurrency[template.currency] ?? 0) + template.amount;
  }

  return { periodKey, pending, totalByCurrency };
}

/** Sedes disponibles para asignar un movimiento, respetando el alcance del usuario. */
export async function getAssignableLocations(): Promise<
  { id: string; code: string; name: string; currency: CurrencyCode }[]
> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("locations")
    .select("id, code, name, currency")
    .eq("is_active", true)
    .order("code");
  return data ?? [];
}
