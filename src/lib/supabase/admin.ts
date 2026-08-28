import "server-only";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database.types";

/**
 * Cliente con service_role: ignora RLS. Uso exclusivo en route handlers
 * server-side de confianza (ej. /api/appointments desde el formulario
 * público, tras validar Turnstile). Nunca importar desde código de cliente
 * ni exponer esta clave con el prefijo NEXT_PUBLIC_.
 */
export function createAdminClient() {
  return createSupabaseClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
}
