"use server";

import { revalidatePath } from "next/cache";
import { requireAdminSession, requireStaffSession } from "@/lib/auth/roles";
import { createClient } from "@/lib/supabase/server";
import { getRoyaltyConfig } from "@/lib/finance/config";
import { monthRangeOf, periodKeyOf } from "@/lib/finance/period";
import { toUsd } from "@/lib/currency/exchange";
import type {
  CurrencyCode,
  ExpenseKind,
  GarmentType,
  PaymentMethod,
} from "@/types/database.types";

function revalidateFinance() {
  revalidatePath("/finance");
  revalidatePath("/finance/salidas");
  revalidatePath("/finance/salidas/tipos");
  revalidatePath("/finance/costos");
  revalidatePath("/finance/royalties");
  revalidatePath("/dashboard");
}

function parseAmount(value: FormDataEntryValue | null, field: string): number {
  const amount = Number(String(value ?? "").replace(/[^\d.,-]/g, "").replace(",", "."));
  if (!Number.isFinite(amount) || amount <= 0) {
    throw new Error(`${field} debe ser un número mayor que cero.`);
  }
  return Math.round(amount * 100) / 100;
}

// Salidas de dinero --------------------------------------------------------

export async function createExpense(formData: FormData) {
  const session = await requireStaffSession();
  const supabase = await createClient();

  const locationId = String(formData.get("locationId") ?? "").trim();
  const categoryId = String(formData.get("categoryId") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim();
  const expenseDate = String(formData.get("expenseDate") ?? "").trim();
  const method = String(formData.get("method") ?? "cash") as PaymentMethod;
  const vendor = String(formData.get("vendor") ?? "").trim();
  const reference = String(formData.get("reference") ?? "").trim();
  const notes = String(formData.get("notes") ?? "").trim();
  const amount = parseAmount(formData.get("amount"), "El monto");

  if (!locationId) throw new Error("Selecciona la sede de la que sale el dinero.");
  if (!description) throw new Error("Describe la salida para poder identificarla después.");

  const { error } = await supabase.from("expenses").insert({
    location_id: locationId,
    category_id: categoryId || null,
    description,
    amount,
    expense_date: expenseDate || new Date().toISOString().slice(0, 10),
    method,
    vendor: vendor || null,
    reference: reference || null,
    notes: notes || null,
    recorded_by: session.userId,
  });

  if (error) throw new Error(error.message);

  revalidateFinance();
}

export async function deleteExpense(expenseId: string) {
  await requireAdminSession();
  const supabase = await createClient();
  const { error } = await supabase.from("expenses").delete().eq("id", expenseId);
  if (error) throw new Error(error.message);
  revalidateFinance();
}

// Tipos de salida ----------------------------------------------------------

export async function createExpenseCategory(formData: FormData) {
  await requireAdminSession();
  const supabase = await createClient();

  const name = String(formData.get("name") ?? "").trim();
  const kind = String(formData.get("kind") ?? "sporadic") as ExpenseKind;
  const description = String(formData.get("description") ?? "").trim();

  if (!name) throw new Error("El nombre del tipo de salida es obligatorio.");

  const { error } = await supabase.from("expense_categories").insert({
    name,
    kind,
    description: description || null,
  });

  if (error) {
    throw new Error(
      error.code === "23505" ? `Ya existe un tipo de salida llamado "${name}".` : error.message,
    );
  }

  revalidateFinance();
}

export async function toggleExpenseCategory(categoryId: string, isActive: boolean) {
  await requireAdminSession();
  const supabase = await createClient();
  const { error } = await supabase
    .from("expense_categories")
    .update({ is_active: isActive })
    .eq("id", categoryId);
  if (error) throw new Error(error.message);
  revalidateFinance();
}

// Salidas fijas (plantillas recurrentes) -----------------------------------

export async function createRecurringExpense(formData: FormData) {
  const session = await requireAdminSession();
  const supabase = await createClient();

  const locationId = String(formData.get("locationId") ?? "").trim();
  const categoryId = String(formData.get("categoryId") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim();
  const method = String(formData.get("method") ?? "transfer") as PaymentMethod;
  const vendor = String(formData.get("vendor") ?? "").trim();
  const dayOfMonth = Number(formData.get("dayOfMonth") ?? 1);
  const amount = parseAmount(formData.get("amount"), "El monto");

  if (!locationId) throw new Error("Selecciona la sede que asume esta salida fija.");
  if (!categoryId) throw new Error("Selecciona el tipo de salida.");
  if (!description) throw new Error("Describe la salida fija (ej. «Arriendo local Bogotá»).");
  if (!Number.isInteger(dayOfMonth) || dayOfMonth < 1 || dayOfMonth > 28) {
    throw new Error("El día de pago debe estar entre 1 y 28.");
  }

  const { data: location } = await supabase
    .from("locations")
    .select("currency")
    .eq("id", locationId)
    .single();

  const { error } = await supabase.from("recurring_expenses").insert({
    location_id: locationId,
    category_id: categoryId,
    description,
    amount,
    currency: (location?.currency ?? "USD") as CurrencyCode,
    day_of_month: dayOfMonth,
    method,
    vendor: vendor || null,
    created_by: session.userId,
  });

  if (error) throw new Error(error.message);

  revalidateFinance();
}

export async function toggleRecurringExpense(recurringId: string, isActive: boolean) {
  await requireAdminSession();
  const supabase = await createClient();
  const { error } = await supabase
    .from("recurring_expenses")
    .update({ is_active: isActive })
    .eq("id", recurringId);
  if (error) throw new Error(error.message);
  revalidateFinance();
}

/**
 * Materializa las salidas fijas del mes en curso.
 *
 * El índice único (recurring_expense_id, period_key) hace la operación
 * idempotente: correrla dos veces no duplica nada, así que el botón puede
 * pulsarse sin miedo.
 */
export async function generateFixedExpenses(): Promise<{ created: number }> {
  const session = await requireAdminSession();
  const supabase = await createClient();

  const today = new Date();
  const periodKey = periodKeyOf(today);
  const { from } = monthRangeOf(periodKey);
  const todayKey = today.toISOString().slice(0, 10);

  const { data: templates } = await supabase
    .from("recurring_expenses")
    .select("id, location_id, category_id, description, amount, currency, day_of_month, method, vendor")
    .eq("is_active", true)
    .lte("starts_on", todayKey);

  const { data: existing } = await supabase
    .from("expenses")
    .select("recurring_expense_id")
    .eq("period_key", periodKey);

  const alreadyPosted = new Set((existing ?? []).map((row) => row.recurring_expense_id));

  const pending = (templates ?? []).filter((template) => !alreadyPosted.has(template.id));
  if (pending.length === 0) return { created: 0 };

  const [year, month] = from.split("-").map(Number);

  const { error } = await supabase.from("expenses").insert(
    pending.map((template) => ({
      location_id: template.location_id,
      category_id: template.category_id,
      description: template.description,
      amount: template.amount,
      currency: template.currency,
      expense_date: `${year}-${String(month).padStart(2, "0")}-${String(template.day_of_month).padStart(2, "0")}`,
      method: template.method,
      vendor: template.vendor,
      recurring_expense_id: template.id,
      period_key: periodKey,
      recorded_by: session.userId,
    })),
  );

  if (error) throw new Error(error.message);

  revalidateFinance();
  return { created: pending.length };
}

// Costos base por pieza ----------------------------------------------------

export async function saveBaseCost(formData: FormData) {
  const session = await requireAdminSession();
  const supabase = await createClient();

  const garmentType = String(formData.get("garmentType") ?? "") as GarmentType;
  const garmentModelId = String(formData.get("garmentModelId") ?? "").trim();
  const locationId = String(formData.get("locationId") ?? "").trim();
  const notes = String(formData.get("notes") ?? "").trim();

  const asNumber = (value: FormDataEntryValue | null) => {
    const parsed = Number(String(value ?? "0").replace(/[^\d.,-]/g, "").replace(",", "."));
    return Number.isFinite(parsed) && parsed >= 0 ? Math.round(parsed * 100) / 100 : 0;
  };

  const fabricCost = asNumber(formData.get("fabricCost"));
  const laborCost = asNumber(formData.get("laborCost"));
  const overheadCost = asNumber(formData.get("overheadCost"));

  if (!garmentType) throw new Error("Selecciona el tipo de prenda.");
  if (fabricCost + laborCost + overheadCost <= 0) {
    throw new Error("Carga al menos un componente de costo mayor que cero.");
  }

  // La moneda la define la sede; un costo global se expresa en la moneda que
  // se elija explícitamente.
  let currency = String(formData.get("currency") ?? "").trim() as CurrencyCode | "";
  if (locationId) {
    const { data: location } = await supabase
      .from("locations")
      .select("currency")
      .eq("id", locationId)
      .single();
    currency = location?.currency ?? currency;
  }
  if (currency !== "COP" && currency !== "USD") {
    throw new Error("Selecciona la moneda del costo.");
  }

  const values = {
    fabric_cost: fabricCost,
    labor_cost: laborCost,
    overhead_cost: overheadCost,
    notes: notes || null,
    is_active: true,
  };

  // El índice único del alcance usa coalesce() sobre columnas nullable, así que
  // no sirve como target de un upsert de PostgREST: se resuelve buscando la
  // fila del alcance y decidiendo entre update e insert.
  let existing = supabase
    .from("garment_base_costs")
    .select("id")
    .eq("garment_type", garmentType)
    .eq("currency", currency);

  existing = garmentModelId
    ? existing.eq("garment_model_id", garmentModelId)
    : existing.is("garment_model_id", null);
  existing = locationId ? existing.eq("location_id", locationId) : existing.is("location_id", null);

  const { data: current } = await existing.maybeSingle();

  const { error } = current
    ? await supabase.from("garment_base_costs").update(values).eq("id", current.id)
    : await supabase.from("garment_base_costs").insert({
        garment_type: garmentType,
        garment_model_id: garmentModelId || null,
        location_id: locationId || null,
        currency,
        created_by: session.userId,
        ...values,
      });

  if (error) throw new Error(error.message);

  revalidateFinance();
}

export async function deleteBaseCost(costId: string) {
  await requireAdminSession();
  const supabase = await createClient();
  const { error } = await supabase.from("garment_base_costs").delete().eq("id", costId);
  if (error) throw new Error(error.message);
  revalidateFinance();
}

// Regalía ------------------------------------------------------------------
//
// El acuerdo (porcentaje, sedes, base de cálculo) NO tiene server action: se
// cambia editando ROYALTY_AGREEMENT en src/lib/finance/config.ts y desplegando.
// Exponer un endpoint para modificarlo, aunque fuera solo para admins, sería
// dejar el contrato entre sedes al alcance de una sesión del CMS. Acá abajo
// solo se registra el giro de un periodo, que sí es un acto operativo.

/**
 * Deja constancia del giro de la regalía de un mes. Congela el monto, la base
 * y la tasa del momento: la liquidación es un hecho contable, no un cálculo
 * que deba moverse si mañana cambia el porcentaje.
 */
export async function settleRoyaltyPeriod(periodKey: string, reference: string) {
  const session = await requireAdminSession();
  const supabase = await createClient();
  const config = getRoyaltyConfig();
  const range = monthRangeOf(periodKey);

  if (periodKey === periodKeyOf(new Date())) {
    throw new Error("El mes en curso aún está acumulando: liquídalo cuando cierre.");
  }

  const { data: locations } = await supabase
    .from("locations")
    .select("id, code, currency")
    .in("code", [config.sourceLocationCode, config.beneficiaryLocationCode]);

  const source = (locations ?? []).find((l) => l.code === config.sourceLocationCode);
  const beneficiary = (locations ?? []).find((l) => l.code === config.beneficiaryLocationCode);

  if (!source || !beneficiary) {
    throw new Error(
      `No se encontraron las sedes del acuerdo (${config.sourceLocationCode} → ${config.beneficiaryLocationCode}).`,
    );
  }

  const fromIso = `${range.from}T00:00:00.000Z`;
  const toIso = `${range.to}T23:59:59.999Z`;

  let baseAmount = 0;
  let baseAmountUsd = 0;

  if (config.base === "collected") {
    const { data: payments } = await supabase
      .from("payments")
      .select("amount, orders!inner(location_id, currency, exchange_rate_to_usd)")
      .eq("orders.location_id", source.id)
      .gte("paid_at", fromIso)
      .lte("paid_at", toIso);

    for (const payment of payments ?? []) {
      const order = payment.orders as unknown as {
        currency: CurrencyCode | null;
        exchange_rate_to_usd: number;
      } | null;
      baseAmount += payment.amount;
      baseAmountUsd += toUsd(
        payment.amount,
        order?.currency ?? source.currency,
        order?.exchange_rate_to_usd || 1,
      );
    }
  } else {
    const { data: orders } = await supabase
      .from("orders")
      .select("total, currency, exchange_rate_to_usd")
      .eq("location_id", source.id)
      .neq("status", "cancelled")
      .gte("created_at", fromIso)
      .lte("created_at", toIso);

    for (const order of orders ?? []) {
      baseAmount += order.total;
      baseAmountUsd += toUsd(
        order.total,
        order.currency ?? source.currency,
        order.exchange_rate_to_usd || 1,
      );
    }
  }

  const round2 = (value: number) => Math.round(value * 100) / 100;
  const amount = round2((baseAmount * config.percent) / 100);
  const amountUsd = round2((baseAmountUsd * config.percent) / 100);

  const { error } = await supabase.from("royalty_settlements").upsert(
    {
      period_start: range.from,
      period_end: range.to,
      source_location_id: source.id,
      beneficiary_location_id: beneficiary.id,
      percent: config.percent,
      base_amount: round2(baseAmount),
      base_currency: source.currency,
      exchange_rate_to_usd: baseAmountUsd > 0 ? round2(baseAmount / baseAmountUsd) : 1,
      amount,
      amount_usd: amountUsd,
      status: "paid",
      paid_at: new Date().toISOString(),
      reference: reference.trim() || null,
      created_by: session.userId,
    },
    { onConflict: "source_location_id,period_start" },
  );

  if (error) throw new Error(error.message);

  revalidateFinance();
}

export async function reopenRoyaltyPeriod(settlementId: string) {
  await requireAdminSession();
  const supabase = await createClient();
  const { error } = await supabase
    .from("royalty_settlements")
    .delete()
    .eq("id", settlementId);
  if (error) throw new Error(error.message);
  revalidateFinance();
}
