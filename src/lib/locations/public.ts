import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * `locations` solo tiene policy de SELECT para staff autenticado
 * (auth.uid() is not null) — el sitio público no puede leerla con el
 * cliente anon. Se usa el cliente admin (service_role) exclusivamente en
 * Server Components, exponiendo solo columnas seguras para mostrar al público.
 */
export async function getPublicLocations() {
  const admin = createAdminClient();
  const { data } = await admin
    .from("locations")
    .select("code, name, country, address, phone, timezone")
    .eq("is_active", true)
    .order("code");

  return data ?? [];
}
