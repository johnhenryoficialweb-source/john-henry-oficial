import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { createClient } from "@supabase/supabase-js";
import type { ParsedClient } from "../src/lib/import/parse-jh-clients";
import { loadEnvLocal, isDryRun, ROOT } from "../src/lib/import/env";

const DEFAULT_INPUT = join(ROOT, "data/new/jh-clients.parsed.json");

async function main() {
  loadEnvLocal();
  const dryRun = isDryRun();
  const inputPath = process.argv.find((a) => !a.startsWith("-") && a.endsWith(".json")) ?? DEFAULT_INPUT;

  if (!existsSync(inputPath)) {
    console.error(`No existe ${inputPath}. Ejecuta: npm run parse:clients`);
    process.exit(1);
  }

  const clients = JSON.parse(readFileSync(inputPath, "utf8")) as ParsedClient[];

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) {
    console.error("Faltan NEXT_PUBLIC_SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY");
    process.exit(1);
  }

  const supabase = createClient(url, serviceKey, { auth: { persistSession: false } });

  const { data: locations, error: locError } = await supabase
    .from("locations")
    .select("id, code");
  if (locError || !locations) {
    console.error("No se pudieron cargar sedes:", locError?.message);
    process.exit(1);
  }

  const locByCode = Object.fromEntries(locations.map((l) => [l.code, l.id]));

  const rows = clients.map((c) => ({
    home_location_id: locByCode[c.location_code],
    full_name: c.full_name,
    phone: c.phone,
    email: c.email,
    document_id: c.document_id,
    notes: c.notes,
  }));

  const missing = clients.filter((c) => !locByCode[c.location_code]);
  if (missing.length > 0) {
    console.error("Sedes faltantes para códigos:", [...new Set(missing.map((m) => m.location_code))]);
    process.exit(1);
  }

  if (dryRun) {
    console.log(`[dry-run] Importaría ${rows.length} clientes`);
    console.log(`  CO: ${clients.filter((c) => c.location_code === "CO").length}`);
    console.log(`  PA: ${clients.filter((c) => c.location_code === "PA").length}`);
    return;
  }

  const batchSize = 100;
  let upserted = 0;
  for (let i = 0; i < rows.length; i += batchSize) {
    const batch = rows.slice(i, i + batchSize);
    const { error } = await supabase
      .from("clients")
      .upsert(batch, { onConflict: "home_location_id,phone" });
    if (error) {
      console.error(`Error lote ${i / batchSize + 1}:`, error.message);
      process.exit(1);
    }
    upserted += batch.length;
    console.log(`Clientes ${upserted}/${rows.length}…`);
  }
  console.log(`Listo: ${upserted} clientes.`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
