"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireStaffSession } from "@/lib/auth/roles";
import { createClient } from "@/lib/supabase/server";
import type { GarmentType } from "@/types/database.types";

export async function createGarmentModel(formData: FormData) {
  await requireStaffSession();
  const supabase = await createClient();

  const garmentType = String(formData.get("garmentType") ?? "") as GarmentType;
  const name = String(formData.get("name") ?? "").trim();
  const code = String(formData.get("code") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim();

  if (!garmentType) throw new Error("Selecciona el tipo de prenda.");
  if (!name) throw new Error("El nombre del modelo es obligatorio.");

  const { data: model, error } = await supabase
    .from("garment_models")
    .insert({
      garment_type: garmentType,
      name,
      code: code || null,
      description: description || null,
    })
    .select("id")
    .single();

  if (error || !model) throw new Error(error?.message ?? "No se pudo crear el modelo.");

  revalidatePath("/garment-models");
  redirect(`/garment-models/${model.id}`);
}
