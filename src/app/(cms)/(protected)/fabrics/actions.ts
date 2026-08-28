"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireStaffSession } from "@/lib/auth/roles";
import { createClient } from "@/lib/supabase/server";
import type { CurrencyCode, Database } from "@/types/database.types";

export async function createFabric(formData: FormData) {
  await requireStaffSession();
  const supabase = await createClient();

  const name = String(formData.get("name") ?? "").trim();
  const code = String(formData.get("code") ?? "").trim();
  const color = String(formData.get("color") ?? "").trim();
  const composition = String(formData.get("composition") ?? "").trim();
  const supplier = String(formData.get("supplier") ?? "").trim();
  const fabricType = String(formData.get("fabricType") ?? "").trim();
  const pricePerMeter = formData.get("pricePerMeter");
  const priceCop = formData.get("priceCop");
  const priceUsd = formData.get("priceUsd");
  const priceCurrency = String(formData.get("priceCurrency") ?? "USD") as CurrencyCode;
  const stockMeters = formData.get("stockMeters");
  const imageUrl = String(formData.get("imageUrl") ?? "").trim();

  const parsedUsd = priceUsd ? Number(priceUsd) : pricePerMeter ? Number(pricePerMeter) : null;
  const parsedCop = priceCop ? Number(priceCop) : null;

  if (!name) throw new Error("El nombre de la tela es obligatorio.");

  const { data: fabric, error } = await supabase
    .from("fabrics")
    .insert({
      name,
      code: code || null,
      color: color || null,
      composition: composition || null,
      supplier: supplier || null,
      fabric_type: fabricType || null,
      price_cop: parsedCop,
      price_usd: parsedUsd,
      price_per_meter: parsedUsd ?? (pricePerMeter ? Number(pricePerMeter) : null),
      price_currency: priceCurrency,
      stock_meters: stockMeters ? Number(stockMeters) : 0,
      image_url: imageUrl || null,
    })
    .select("id")
    .single();

  if (error || !fabric) throw new Error(error?.message ?? "No se pudo crear la tela.");

  revalidatePath("/fabrics");
  redirect(`/fabrics/${fabric.id}`);
}

export async function updateFabricStock(fabricId: string, stockMeters: number) {
  await requireStaffSession();
  const supabase = await createClient();
  await supabase.from("fabrics").update({ stock_meters: stockMeters }).eq("id", fabricId);
  revalidatePath(`/fabrics/${fabricId}`);
}

export type FabricEditableField =
  | "supplier"
  | "code"
  | "fabric_type"
  | "name"
  | "price_cop"
  | "price_usd";

export async function updateFabricCell(
  fabricId: string,
  field: FabricEditableField,
  rawValue: string
) {
  await requireStaffSession();
  const supabase = await createClient();

  const update: Record<string, string | number | null> = {};

  if (field === "price_cop" || field === "price_usd") {
    const trimmed = rawValue.trim();
    const num = trimmed === "" ? null : Number(trimmed.replace(/,/g, ""));
    if (trimmed !== "" && Number.isNaN(num)) {
      throw new Error("Precio inválido.");
    }
    update[field] = num;
    if (field === "price_usd" && num != null) {
      update.price_per_meter = num;
      update.price_currency = "USD";
    }
  } else {
    update[field] = rawValue.trim() || null;
  }

  // `update` se arma con una clave dinámica, así que se tipa como Record y se
  // reafirma acá: postgrest rechaza los index signatures abiertos.
  const { error } = await supabase
    .from("fabrics")
    .update(update as Database["public"]["Tables"]["fabrics"]["Update"])
    .eq("id", fabricId);
  if (error) throw new Error(error.message);

  revalidatePath("/fabrics");
  revalidatePath(`/fabrics/${fabricId}`);
}
