"use server";

import { revalidatePath } from "next/cache";
import { requireAdminSession } from "@/lib/auth/roles";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import type { LocationCode } from "@/config/locations";
import type { PaymentMethod, UserRole } from "@/types/database.types";

export async function updateExchangeRate(formData: FormData) {
  const session = await requireAdminSession();
  const supabase = await createClient();

  const rate = Number(formData.get("rate"));
  if (!rate || rate <= 0) throw new Error("La tasa debe ser un número positivo.");

  await supabase.from("settings").upsert({
    key: "exchange_rate_usd_cop",
    value: { rate, as_of: new Date().toISOString().slice(0, 10) },
    description: "Tasa de cambio USD->COP usada para el reporte financiero consolidado.",
    updated_by: session.userId,
  });

  revalidatePath("/settings");
}

/* ------------------------------------------------------------------------- *
 * Medios de cobro y sus comisiones
 * ------------------------------------------------------------------------- */

function parsePercent(raw: FormDataEntryValue | null): number {
  // Se acepta coma decimal: "3,5" es como se dicta un porcentaje en español.
  const value = Number(String(raw ?? "0").replace(",", "."));
  if (!Number.isFinite(value) || value < 0) return 0;
  return Math.min(Math.round(value * 100) / 100, 100);
}

function parseFixed(raw: FormDataEntryValue | null): number {
  const value = Number(String(raw ?? "0").replace(/[^\d.,]/g, "").replace(",", "."));
  if (!Number.isFinite(value) || value < 0) return 0;
  return Math.round(value * 100) / 100;
}

/**
 * Guarda la comisión de un medio de cobro.
 *
 * Solo afecta a los cobros futuros: cada pago congela el porcentaje con el que
 * se registró (trigger payments_set_channel_fee), así que subir el datáfono de
 * 3% a 3,5% no reescribe lo que ya costó cobrar.
 */
export async function updatePaymentChannelFee(formData: FormData) {
  await requireAdminSession();
  const supabase = await createClient();

  const id = String(formData.get("id") ?? "");
  if (!id) throw new Error("Falta el medio de cobro.");

  const { error } = await supabase
    .from("payment_channels")
    .update({
      fee_percent: parsePercent(formData.get("feePercent")),
      fee_fixed: parseFixed(formData.get("feeFixed")),
    })
    .eq("id", id);

  if (error) throw new Error(error.message);

  revalidatePath("/settings/medios-pago");
  revalidatePath("/finance");
}

export async function createPaymentChannel(formData: FormData) {
  await requireAdminSession();
  const supabase = await createClient();

  const name = String(formData.get("name") ?? "").trim();
  if (!name) throw new Error("Escribe el nombre del medio de cobro.");

  const method = String(formData.get("method") ?? "card") as PaymentMethod;
  const locationId = String(formData.get("locationId") ?? "").trim();

  const { error } = await supabase.from("payment_channels").insert({
    name,
    method,
    fee_percent: parsePercent(formData.get("feePercent")),
    fee_fixed: parseFixed(formData.get("feeFixed")),
    location_id: locationId || null,
  });

  if (error) throw new Error(error.message);

  revalidatePath("/settings/medios-pago");
}

export async function togglePaymentChannel(id: string, isActive: boolean) {
  await requireAdminSession();
  const supabase = await createClient();
  await supabase.from("payment_channels").update({ is_active: isActive }).eq("id", id);
  revalidatePath("/settings/medios-pago");
}

export async function inviteStaffUser(formData: FormData) {
  await requireAdminSession();

  const email = String(formData.get("email") ?? "").trim();
  const fullName = String(formData.get("fullName") ?? "").trim();
  const role = String(formData.get("role") ?? "staff") as UserRole;
  const locationCode = String(formData.get("locationCode") ?? "") as LocationCode | "";

  if (!email || !fullName) throw new Error("Nombre y correo son obligatorios.");
  if (role === "staff" && !locationCode) throw new Error("El staff debe tener una sede asignada.");

  const admin = createAdminClient();
  const supabase = await createClient();

  let locationId: string | null = null;
  if (locationCode) {
    const { data: location } = await admin.from("locations").select("id").eq("code", locationCode).single();
    locationId = location?.id ?? null;
  }

  const { data: invited, error: inviteError } = await admin.auth.admin.inviteUserByEmail(email);
  if (inviteError || !invited.user) {
    throw new Error(inviteError?.message ?? "No se pudo invitar al usuario.");
  }

  const { error: insertError } = await supabase.from("staff_users").insert({
    id: invited.user.id,
    full_name: fullName,
    email,
    role,
    location_id: locationId,
  });

  if (insertError) throw new Error(insertError.message);

  revalidatePath("/settings/usuarios");
}

export async function toggleStaffActive(staffId: string, isActive: boolean) {
  await requireAdminSession();
  const supabase = await createClient();
  await supabase.from("staff_users").update({ is_active: isActive }).eq("id", staffId);
  revalidatePath("/settings/usuarios");
}
