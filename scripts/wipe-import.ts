import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { loadEnvLocal } from "../src/lib/import/env";

/**
 * Borra SOLO los datos que provienen del sistema legacy, para poder
 * reconstruirlos desde cero a partir del backup completo.
 *
 * NO toca `fabrics` (360 telas ya cargadas), `locations`, `staff_users` ni
 * `settings`. Exige `--confirm` porque es el único paso irreversible.
 */

/** Orden obligado por las claves foráneas: hijos antes que padres. */
const DELETE_ORDER = [
  "payments",
  "order_items",
  "orders",
  "client_measurements",
  "appointments",
  "clients",
] as const;

const PRESERVED = ["fabrics", "locations", "staff_users", "settings", "garment_models"];

async function countRows(supabase: SupabaseClient, table: string): Promise<number> {
  const { count, error } = await supabase.from(table).select("*", { count: "exact", head: true });
  if (error) throw new Error(`No se pudo contar ${table}: ${error.message}`);
  return count ?? 0;
}

async function main() {
  loadEnvLocal();
  const confirmed = process.argv.includes("--confirm");

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) {
    console.error("Faltan NEXT_PUBLIC_SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY");
    process.exit(1);
  }
  const supabase = createClient(url, serviceKey, { auth: { persistSession: false } });

  console.log("Se BORRARÁN estas tablas:");
  for (const table of DELETE_ORDER) {
    console.log(`  ${table.padEnd(20)} ${await countRows(supabase, table)} filas`);
  }
  console.log("\nSe CONSERVAN intactas:");
  for (const table of PRESERVED) {
    console.log(`  ${table.padEnd(20)} ${await countRows(supabase, table)} filas`);
  }

  if (!confirmed) {
    console.log("\nSimulación. Para ejecutar de verdad: npm run wipe:import -- --confirm");
    return;
  }

  console.log("\nBorrando…");
  for (const table of DELETE_ORDER) {
    // PostgREST exige un filtro en DELETE; este lo cumple sin excluir nada.
    const { error } = await supabase.from(table).delete().not("id", "is", null);
    if (error) {
      console.error(`Error borrando ${table}:`, error.message);
      process.exit(1);
    }
    console.log(`  ${table}: ${await countRows(supabase, table)} filas restantes`);
  }

  console.log("\nListo. Ahora: npm run import:backup");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
