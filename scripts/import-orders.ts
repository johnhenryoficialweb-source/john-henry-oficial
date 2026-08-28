import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { createClient } from "@supabase/supabase-js";
import type { ParsedClient, ParsedOrder } from "../src/lib/import/parse-jh-clients";
import { loadEnvLocal, isDryRun, ROOT } from "../src/lib/import/env";

const CLIENTS_INPUT = join(ROOT, "data/new/jh-clients.parsed.json");
const ORDERS_INPUT = join(ROOT, "data/new/jh-orders.parsed.json");

async function main() {
  loadEnvLocal();
  const dryRun = isDryRun();

  if (!existsSync(CLIENTS_INPUT) || !existsSync(ORDERS_INPUT)) {
    console.error("Faltan JSON parseados. Ejecuta: npm run parse:clients");
    process.exit(1);
  }

  const clients = JSON.parse(readFileSync(CLIENTS_INPUT, "utf8")) as ParsedClient[];
  const orders = JSON.parse(readFileSync(ORDERS_INPUT, "utf8")) as ParsedOrder[];

  if (dryRun) {
    const itemCount = orders.reduce((s, o) => s + o.items.length, 0);
    const clientKeys = new Set(clients.map((c) => c.client_key));
    const orphan = orders.filter((o) => !clientKeys.has(o.client_key)).length;
    console.log(`[dry-run] Importaría ${orders.length} órdenes, ${itemCount} ítems`);
    console.log(`  delivered: ${orders.length}`);
    console.log(`  huérfanos en JSON: ${orphan}`);
    return;
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) {
    console.error("Faltan NEXT_PUBLIC_SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY");
    process.exit(1);
  }

  const supabase = createClient(url, serviceKey, { auth: { persistSession: false } });

  const { data: locations } = await supabase.from("locations").select("id, code");
  const locByCode = Object.fromEntries((locations ?? []).map((l) => [l.code, l.id]));

  const { data: dbClients, error: clientError } = await supabase
    .from("clients")
    .select("id, phone, home_location_id, full_name");
  if (clientError || !dbClients) {
    console.error("Error cargando clientes:", clientError?.message);
    process.exit(1);
  }

  const clientIdByKey = new Map<string, string>();
  for (const c of clients) {
    const locId = locByCode[c.location_code];
    const match = dbClients.find((db) => db.phone === c.phone && db.home_location_id === locId);
    if (match) clientIdByKey.set(c.client_key, match.id);
  }

  const missingClients = orders.filter((o) => !clientIdByKey.has(o.client_key));
  if (missingClients.length > 0) {
    console.error(`${missingClients.length} pedidos sin cliente en BD. Importa clientes primero.`);
    process.exit(1);
  }

  let imported = 0;
  for (const order of orders) {
    const clientId = clientIdByKey.get(order.client_key)!;
    const locationId = locByCode[order.location_code];

    const { data: existing } = await supabase
      .from("orders")
      .select("id")
      .eq("import_source_key", order.import_source_key)
      .maybeSingle();

    if (existing) {
      imported++;
      continue;
    }

    const { data: inserted, error: orderError } = await supabase
      .from("orders")
      .insert({
        client_id: clientId,
        location_id: locationId,
        status: "delivered",
        expected_delivery_date: order.expected_delivery_date,
        notes: order.notes,
        subtotal: order.subtotal,
        discount: order.discount,
        total: order.total,
        import_source_key: order.import_source_key,
        created_at: order.created_at,
        updated_at: order.created_at,
      })
      .select("id")
      .single();

    if (orderError || !inserted) {
      console.error(`Error orden fila ${order.source_row}:`, orderError?.message);
      process.exit(1);
    }

    const itemRows = order.items.map((item) => ({
      order_id: inserted.id,
      garment_type: item.garment_type,
      quantity: item.quantity,
      unit_price: item.unit_price,
    }));

    const { error: itemsError } = await supabase.from("order_items").insert(itemRows);
    if (itemsError) {
      console.error(`Error ítems fila ${order.source_row}:`, itemsError.message);
      process.exit(1);
    }

    imported++;
    if (imported % 50 === 0) console.log(`Órdenes ${imported}/${orders.length}…`);
  }

  console.log(`Listo: ${imported} órdenes importadas.`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
