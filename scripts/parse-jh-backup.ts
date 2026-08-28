import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import * as XLSX from "xlsx";
import { parseBackup, type RawRow } from "../src/lib/import/parse-jh-backup";
import { ROOT } from "../src/lib/import/env";

const INPUT = join(ROOT, "data/new/backup_JH.xlsx");
const OUT_DIR = join(ROOT, "data/new");

/**
 * `raw: true` a propósito: las columnas de fecha mezclan seriales de Excel,
 * epoch Unix y texto, y quien decide cómo interpretarlos es parseLegacyDate.
 * Si se dejara que xlsx convierta, los seriales llegarían ya como Date y los
 * epoch seguirían siendo números — se perdería la señal para distinguirlos.
 */
function readSheet(wb: XLSX.WorkBook, name: string): RawRow[] {
  const sheet = wb.Sheets[name];
  if (!sheet) {
    console.error(`El libro no tiene la hoja "${name}". Hojas: ${wb.SheetNames.join(", ")}`);
    process.exit(1);
  }
  const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, {
    raw: true,
    defval: null,
  });
  return rows.map((row) => {
    const out: RawRow = {};
    for (const [k, v] of Object.entries(row)) {
      out[k] = v == null ? null : String(v);
    }
    return out;
  });
}

function toCsv(rows: Array<Record<string, string | number>>, headers: string[]): string {
  const esc = (v: string | number) => {
    const s = String(v ?? "");
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return [headers.join(","), ...rows.map((r) => headers.map((h) => esc(r[h])).join(","))].join("\n");
}

function main() {
  const wb = XLSX.read(readFileSync(INPUT), { type: "buffer" });
  const clientRows = readSheet(wb, "clients");
  const orderRows = readSheet(wb, "orders");

  const { clients, measurements, orders, discarded, normalized, report } = parseBackup(
    clientRows,
    orderRows
  );

  mkdirSync(OUT_DIR, { recursive: true });
  writeFileSync(join(OUT_DIR, "jh-backup.clients.json"), JSON.stringify(clients, null, 2));
  writeFileSync(join(OUT_DIR, "jh-backup.measurements.json"), JSON.stringify(measurements, null, 2));
  writeFileSync(join(OUT_DIR, "jh-backup.orders.json"), JSON.stringify(orders, null, 2));
  writeFileSync(join(OUT_DIR, "jh-backup.report.json"), JSON.stringify(report, null, 2));
  writeFileSync(
    join(OUT_DIR, "jh-medidas-descartadas.csv"),
    toCsv(
      discarded as unknown as Array<Record<string, string | number>>,
      ["legacy_client_id", "full_name", "garment_type", "legacy_column", "field", "value", "reason"]
    )
  );
  writeFileSync(
    join(OUT_DIR, "jh-medidas-normalizadas.csv"),
    toCsv(normalized as unknown as Array<Record<string, string | number>>, [
      "legacy_client_id",
      "full_name",
      "garment_type",
      "legacy_column",
      "field",
      "original",
      "value",
      "rule",
    ])
  );

  console.log("=== Parseo del backup legacy ===");
  console.log(`Clientes      ${report.clients_parsed} de ${report.clients_rows} filas`);
  console.log(`  sin teléfono (placeholder): ${report.clients_without_phone}`);
  console.log(`  choques de teléfono:        ${report.phone_collisions.length}`);
  console.log(`  sede inferida por fallback: ${report.location_inferred}`);
  console.log(`  CO ${report.by_location.CO.clients} · PA ${report.by_location.PA.clients}`);
  console.log(`Medidas       ${report.measurements_rows} filas`);
  console.log(`  por prenda: ${JSON.stringify(report.measurements_by_garment)}`);
  console.log(`  normalizadas (convención): ${report.normalized_measurements}`);
  for (const [k, v] of Object.entries(report.normalized_by_rule)) console.log(`      ${k}: ${v}`);
  console.log(`  descartadas por rango: ${report.discarded_measurements}`);
  console.log(`Órdenes       ${report.orders_parsed} de ${report.orders_rows} filas`);
  console.log(`  huérfanas (sin cliente):  ${report.orders_orphan}`);
  console.log(`  sin ninguna prenda:       ${report.orders_without_items.length}`);
  console.log(`  ítems:                    ${report.order_items_rows}`);
  console.log(`\nSalidas en data/new/: jh-backup.{clients,measurements,orders,report}.json`);
  console.log(`Descartes: data/new/jh-medidas-descartadas.csv`);
}

main();
