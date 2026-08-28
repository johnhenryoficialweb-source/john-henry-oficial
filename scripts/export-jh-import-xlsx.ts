import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import * as XLSX from "xlsx";
import type { ParsedClient, ParsedOrder } from "../src/lib/import/parse-jh-clients";
import { ROOT } from "../src/lib/import/env";

const CLIENTS = join(ROOT, "data/new/jh-clients.parsed.json");
const ORDERS = join(ROOT, "data/new/jh-orders.parsed.json");
const OUTPUT = join(ROOT, "data/new/jh-import.review.xlsx");

function main() {
  if (!existsSync(CLIENTS) || !existsSync(ORDERS)) {
    console.error("Ejecuta primero: npm run parse:clients");
    process.exit(1);
  }

  const clients = JSON.parse(readFileSync(CLIENTS, "utf8")) as ParsedClient[];
  const orders = JSON.parse(readFileSync(ORDERS, "utf8")) as ParsedOrder[];

  const wb = XLSX.utils.book_new();

  const clientSheet = XLSX.utils.aoa_to_sheet([
    ["Nombre", "Teléfono", "Email", "Documento", "Sede", "Notas", "Filas Excel"],
    ...clients.map((c) => [
      c.full_name,
      c.phone,
      c.email ?? "",
      c.document_id ?? "",
      c.location_code,
      c.notes ?? "",
      c.source_rows.join(", "),
    ]),
  ]);
  XLSX.utils.book_append_sheet(wb, clientSheet, "Clientes");

  const orderSheet = XLSX.utils.aoa_to_sheet([
    ["Cliente", "Sede", "Fecha", "Entrega", "Pedido", "Prendas", "Fila Excel"],
    ...orders.map((o) => [
      o.client_name,
      o.location_code,
      o.created_at.slice(0, 10),
      o.expected_delivery_date ?? "",
      o.pedido_raw,
      o.items.map((i) => i.garment_type).join(", "),
      o.source_row,
    ]),
  ]);
  XLSX.utils.book_append_sheet(wb, orderSheet, "Pedidos");

  XLSX.writeFile(wb, OUTPUT);
  console.log(`Excel revisión: ${OUTPUT}`);
  console.log(`Clientes: ${clients.length} · Pedidos: ${orders.length}`);
}

main();
