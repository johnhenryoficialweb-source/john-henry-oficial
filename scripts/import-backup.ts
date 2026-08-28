import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type {
  ParsedBackupClient,
  ParsedMeasurement,
  ParsedBackupOrder,
} from "../src/lib/import/parse-jh-backup";
import { loadEnvLocal, isDryRun, ROOT } from "../src/lib/import/env";

const DIR = join(ROOT, "data/new");
const CLIENTS = join(DIR, "jh-backup.clients.json");
const MEASUREMENTS = join(DIR, "jh-backup.measurements.json");
const ORDERS = join(DIR, "jh-backup.orders.json");

const BATCH = 500;
const PAGE = 1000;

/**
 * Trae TODAS las filas paginando de forma explícita.
 *
 * PostgREST corta en 1000 filas por defecto y no avisa. Ese tope silencioso es
 * exactamente lo que dejó la base con 1000 órdenes de 1070 y obligó a rehacer
 * el import entero: nunca leer estas tablas sin paginar.
 */
async function fetchAllPaged<T>(
  supabase: SupabaseClient,
  table: string,
  columns: string
): Promise<T[]> {
  const out: T[] = [];
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await supabase
      .from(table)
      .select(columns)
      .range(from, from + PAGE - 1);
    if (error) throw new Error(`Error leyendo ${table}: ${error.message}`);
    const rows = (data ?? []) as T[];
    out.push(...rows);
    if (rows.length < PAGE) return out;
  }
}

async function insertInBatches(
  supabase: SupabaseClient,
  table: string,
  rows: Record<string, unknown>[],
  label: string
) {
  for (let i = 0; i < rows.length; i += BATCH) {
    const slice = rows.slice(i, i + BATCH);
    const { error } = await supabase.from(table).insert(slice);
    if (error) throw new Error(`Error insertando ${table} (lote ${i / BATCH + 1}): ${error.message}`);
    console.log(`  ${label}: ${Math.min(i + BATCH, rows.length)}/${rows.length}`);
  }
}

function loadJson<T>(path: string): T[] {
  if (!existsSync(path)) {
    console.error(`Falta ${path}. Ejecuta primero: npm run parse:backup`);
    process.exit(1);
  }
  return JSON.parse(readFileSync(path, "utf8")) as T[];
}

async function main() {
  loadEnvLocal();
  const dryRun = isDryRun();

  const clients = loadJson<ParsedBackupClient>(CLIENTS);
  const measurements = loadJson<ParsedMeasurement>(MEASUREMENTS);
  const orders = loadJson<ParsedBackupOrder>(ORDERS);
  const itemCount = orders.reduce((s, o) => s + o.items.length, 0);

  console.log(`A importar: ${clients.length} clientes · ${measurements.length} medidas · ${orders.length} órdenes · ${itemCount} ítems`);
  if (dryRun) {
    console.log("[dry-run] No se escribió nada.");
    return;
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) {
    console.error("Faltan NEXT_PUBLIC_SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY");
    process.exit(1);
  }
  const supabase = createClient(url, serviceKey, { auth: { persistSession: false } });

  const { data: locations, error: locError } = await supabase.from("locations").select("id, code");
  if (locError || !locations) {
    console.error("No se pudieron cargar las sedes:", locError?.message);
    process.exit(1);
  }
  const locByCode = Object.fromEntries(locations.map((l) => [l.code, l.id as string]));

  /* ------------------------------ clientes ------------------------------ */

  const existingClients = await fetchAllPaged<{ id: string; import_source_key: string | null }>(
    supabase,
    "clients",
    "id, import_source_key"
  );
  const clientIdByKey = new Map<string, string>();
  for (const c of existingClients) {
    if (c.import_source_key) clientIdByKey.set(c.import_source_key, c.id);
  }

  const newClients = clients.filter((c) => !clientIdByKey.has(c.import_source_key));
  console.log(`\nClientes: ${newClients.length} nuevos, ${clients.length - newClients.length} ya estaban`);
  if (newClients.length > 0) {
    await insertInBatches(
      supabase,
      "clients",
      newClients.map((c) => ({
        home_location_id: locByCode[c.location_code],
        full_name: c.full_name,
        phone: c.phone,
        email: c.email,
        document_id: c.document_id,
        notes: c.notes,
        import_source_key: c.import_source_key,
      })),
      "clientes"
    );
    const refreshed = await fetchAllPaged<{ id: string; import_source_key: string | null }>(
      supabase,
      "clients",
      "id, import_source_key"
    );
    clientIdByKey.clear();
    for (const c of refreshed) if (c.import_source_key) clientIdByKey.set(c.import_source_key, c.id);
  }

  const clientUuidByLegacy = new Map<string, string>();
  for (const c of clients) {
    const uuid = clientIdByKey.get(c.import_source_key);
    if (uuid) clientUuidByLegacy.set(c.legacy_id, uuid);
  }

  /* ------------------------------ medidas ------------------------------- */

  const existingMeas = await fetchAllPaged<{ import_source_key: string | null }>(
    supabase,
    "client_measurements",
    "import_source_key"
  );
  const measKeys = new Set(existingMeas.map((m) => m.import_source_key).filter(Boolean) as string[]);

  const newMeas = measurements.filter((m) => !measKeys.has(m.import_source_key));
  console.log(`\nMedidas: ${newMeas.length} nuevas, ${measurements.length - newMeas.length} ya estaban`);
  if (newMeas.length > 0) {
    await insertInBatches(
      supabase,
      "client_measurements",
      newMeas.map((m) => ({
        client_id: clientUuidByLegacy.get(m.legacy_client_id),
        garment_type: m.garment_type,
        values: m.values,
        unit: "cm",
        source: "profile",
        is_latest: true,
        taken_at: m.taken_at ?? new Date().toISOString(),
        import_source_key: m.import_source_key,
      })),
      "medidas"
    );
  }

  /* ------------------------------ órdenes ------------------------------- */

  const existingOrders = await fetchAllPaged<{ id: string; import_source_key: string | null }>(
    supabase,
    "orders",
    "id, import_source_key"
  );
  const orderIdByKey = new Map<string, string>();
  for (const o of existingOrders) if (o.import_source_key) orderIdByKey.set(o.import_source_key, o.id);

  const newOrders = orders.filter((o) => !orderIdByKey.has(o.import_source_key));
  console.log(`\nÓrdenes: ${newOrders.length} nuevas, ${orders.length - newOrders.length} ya estaban`);
  if (newOrders.length > 0) {
    await insertInBatches(
      supabase,
      "orders",
      newOrders.map((o) => ({
        client_id: clientUuidByLegacy.get(o.legacy_client_id),
        location_id: locByCode[o.location_code],
        // Se pasa explícito para conservar la numeración del legacy: el trigger
        // generate_order_number solo genera cuando llega en null.
        order_number: o.order_number,
        status: o.status,
        expected_delivery_date: o.expected_delivery_date,
        notes: o.notes,
        created_at: o.created_at,
        updated_at: o.created_at,
        import_source_key: o.import_source_key,
      })),
      "órdenes"
    );
    const refreshed = await fetchAllPaged<{ id: string; import_source_key: string | null }>(
      supabase,
      "orders",
      "id, import_source_key"
    );
    orderIdByKey.clear();
    for (const o of refreshed) if (o.import_source_key) orderIdByKey.set(o.import_source_key, o.id);
  }

  /* -------------------------- ítems de órdenes -------------------------- */

  const itemRows: Record<string, unknown>[] = [];
  for (const order of newOrders) {
    const orderId = orderIdByKey.get(order.import_source_key);
    if (!orderId) continue;
    for (const item of order.items) {
      itemRows.push({
        order_id: orderId,
        garment_type: item.garment_type,
        quantity: 1,
        unit_price: 0,
        // La especificación que escribió el sastre. Esto es justo lo que el
        // import anterior perdió.
        notes: item.notes,
      });
    }
  }
  console.log(`\nÍtems: ${itemRows.length} a insertar`);
  if (itemRows.length > 0) await insertInBatches(supabase, "order_items", itemRows, "ítems");

  console.log("\nImport terminado.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
