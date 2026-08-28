import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { createClient } from "@supabase/supabase-js";
import type { ParsedFabric } from "../src/lib/fabrics/parse-semi-catalog";
import { loadEnvLocal, isDryRun, ROOT } from "../src/lib/import/env";

const DEFAULT_INPUT = join(ROOT, "data/new/semi-clean.parsed.json");

const SEED_CODES = [
  "VBC-1401",
  "VBC-1408",
  "LP-2203",
  "LP-2210",
  "DR-0917",
  "DR-0925",
  "RG-3302",
  "RG-3311",
  "CE-4405",
  "CE-4412",
];

async function main() {
  loadEnvLocal();

  const dryRun = isDryRun();
  const inputPath =
    process.argv.find((a) => !a.startsWith("-") && a.endsWith(".json")) ?? DEFAULT_INPUT;
  if (!existsSync(inputPath)) {
    console.error(`No existe ${inputPath}. Ejecuta primero: npm run parse:fabrics`);
    process.exit(1);
  }

  const fabrics = JSON.parse(readFileSync(inputPath, "utf8")) as ParsedFabric[];

  if (dryRun) {
    console.log(`[dry-run] Eliminaría ${SEED_CODES.length} telas de muestra`);
    console.log(`[dry-run] Importaría ${fabrics.length} telas`);
    return;
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) {
    console.error("Faltan NEXT_PUBLIC_SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY en .env.local");
    process.exit(1);
  }

  const supabase = createClient(url, serviceKey, { auth: { persistSession: false } });

  const { error: deleteError } = await supabase.from("fabrics").delete().in("code", SEED_CODES);
  if (deleteError) {
    console.error("Error eliminando telas de muestra:", deleteError.message);
    process.exit(1);
  }
  console.log(`Eliminadas telas de muestra: ${SEED_CODES.length}`);

  let upserted = 0;
  for (const f of fabrics) {
    const row = {
      supplier: f.supplier,
      code: f.code,
      name: f.name,
      fabric_type: f.fabric_type,
      price_cop: f.price_cop,
      price_usd: f.price_usd,
      price_per_meter: f.price_usd,
      price_currency: "USD" as const,
      is_active: true,
    };

    const { data: existing } = await supabase
      .from("fabrics")
      .select("id")
      .eq("supplier", f.supplier)
      .eq("code", f.code)
      .maybeSingle();

    const { error } = existing
      ? await supabase.from("fabrics").update(row).eq("id", existing.id)
      : await supabase.from("fabrics").insert(row);

    if (error) {
      console.error(`Error en ${f.supplier} / ${f.code}:`, error.message);
      process.exit(1);
    }

    upserted++;
    if (upserted % 50 === 0) console.log(`Importadas ${upserted}/${fabrics.length}…`);
  }

  console.log(`Listo: ${upserted} telas en fabrics.`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
