import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import * as XLSX from "xlsx";
import {
  parseJhCatalog,
  type RawClientRow,
  type RawOrderRow,
} from "../src/lib/import/parse-jh-clients";
import { ROOT } from "../src/lib/import/env";

const INPUT = join(ROOT, "data/new/Base de datos John Henry - clientes.xlsx");
const OUT_DIR = join(ROOT, "data/new");

function loadClientRows(path: string): RawClientRow[] {
  const wb = XLSX.read(readFileSync(path), { type: "buffer" });
  const raw = XLSX.utils.sheet_to_json<(string | number)[]>(wb.Sheets["Clientes"], {
    header: 1,
    defval: "",
  });

  const rows: RawClientRow[] = [];
  for (let i = 0; i < raw.length; i++) {
    const line = raw[i];
    if (!Array.isArray(line)) continue;
    const full_name = String(line[1] ?? "").trim();
    if (!full_name) continue;

    rows.push({
      document_id: String(line[0] ?? "").trim(),
      full_name,
      phone_raw: String(line[2] ?? "").trim(),
      email: String(line[3] ?? "").trim(),
      address: String(line[4] ?? "").trim(),
      source_row: i + 1,
    });
  }
  return rows;
}

function loadOrderRows(path: string): RawOrderRow[] {
  const wb = XLSX.read(readFileSync(path), { type: "buffer" });
  const raw = XLSX.utils.sheet_to_json<(string | number)[]>(wb.Sheets["Pedidos"], {
    header: 1,
    defval: "",
  });

  const rows: RawOrderRow[] = [];
  for (let i = 1; i < raw.length; i++) {
    const line = raw[i];
    if (!Array.isArray(line)) continue;
    const client_name = String(line[1] ?? "").trim();
    if (!client_name) continue;

    const dateSerial = Number(line[0]);
    const nextRaw = line[4];
    const nextSerial =
      nextRaw !== "" && nextRaw != null && !Number.isNaN(Number(nextRaw)) ? Number(nextRaw) : null;

    rows.push({
      order_date_serial: dateSerial,
      client_name,
      pedido: String(line[2] ?? "").trim(),
      delivered_raw: String(line[3] ?? "").trim(),
      next_date_serial: nextSerial,
      source_row: i + 1,
    });
  }
  return rows;
}

function main() {
  const inputPath = process.argv[2] ?? INPUT;
  const clientRows = loadClientRows(inputPath);
  const orderRows = loadOrderRows(inputPath);
  const { clients, orders, report } = parseJhCatalog(clientRows, orderRows);

  mkdirSync(OUT_DIR, { recursive: true });
  writeFileSync(join(OUT_DIR, "jh-clients.parsed.json"), JSON.stringify(clients, null, 2));
  writeFileSync(join(OUT_DIR, "jh-orders.parsed.json"), JSON.stringify(orders, null, 2));
  writeFileSync(join(OUT_DIR, "jh-import.report.json"), JSON.stringify(report, null, 2));

  console.log(`Clientes: ${report.clients_parsed} (fusionados: ${report.clients_merged})`);
  console.log(`Pedidos: ${report.orders_parsed} (huérfanos: ${report.orders_orphan})`);
  console.log(`Sin pedidos: ${report.clients_without_orders}`);
  console.log(`Teléfonos sintéticos: ${report.synthetic_phones.length}`);
  console.log(`Salida: ${OUT_DIR}/jh-*.parsed.json`);
}

main();
