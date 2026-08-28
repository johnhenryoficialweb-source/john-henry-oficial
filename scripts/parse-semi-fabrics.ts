import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import * as XLSX from "xlsx";
import {
  parseCop,
  parseSemiRows,
  parseUsd,
  type SemiFabricRow,
} from "../src/lib/fabrics/parse-semi-catalog";
import { writeFabricsWorkbook } from "../src/lib/fabrics/export-fabrics-xlsx";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const INPUT = join(ROOT, "data/new/semi - clean.xlsx");
const OUT_DIR = join(ROOT, "data/new");

function loadRowsFromXlsx(path: string): SemiFabricRow[] {
  const workbook = XLSX.read(readFileSync(path), { type: "buffer" });
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  const raw = XLSX.utils.sheet_to_json<(string | number)[]>(sheet, { header: 1, defval: "" });

  const rows: SemiFabricRow[] = [];
  for (let i = 0; i < raw.length; i++) {
    const line = raw[i];
    if (!Array.isArray(line) || line.length < 5) continue;
    const supplier = String(line[0] ?? "").trim();
    const reference = String(line[1] ?? "").trim();
    const fabric_type = String(line[2] ?? "").trim();
    const copRaw = line[3];
    const usdRaw = line[4];

    if (!supplier || supplier === "PROVEEDOR" || supplier === "Table 1") continue;
    if (!reference) continue;

    rows.push({
      supplier,
      reference,
      fabric_type: fabric_type || reference,
      price_cop: parseCop(copRaw),
      price_usd: parseUsd(usdRaw),
      source_row: i + 1,
    });
  }
  return rows;
}

function main() {
  const inputPath = process.argv[2] ?? INPUT;
  const rows = loadRowsFromXlsx(inputPath);
  const { parsed, ambiguous, report } = parseSemiRows(rows);

  mkdirSync(OUT_DIR, { recursive: true });
  writeFileSync(join(OUT_DIR, "semi-clean.parsed.json"), JSON.stringify(parsed, null, 2));
  writeFileSync(join(OUT_DIR, "semi-clean.ambiguous.json"), JSON.stringify(ambiguous, null, 2));
  writeFileSync(join(OUT_DIR, "semi-clean.report.json"), JSON.stringify(report, null, 2));
  const xlsxPath = join(OUT_DIR, "semi-clean.parsed.xlsx");
  writeFabricsWorkbook(xlsxPath, parsed, ambiguous, report);

  console.log(`Filas Excel: ${report.input_rows}`);
  console.log(`Duplicadas omitidas: ${report.skipped_duplicates}`);
  console.log(`Telas parseadas: ${report.parsed_count}`);
  console.log(`Ambiguas: ${report.ambiguous_count}`);
  console.log(`Duplicados (supplier+code): ${report.duplicate_keys.length}`);
  console.log(`Salida JSON: ${OUT_DIR}/semi-clean.*.json`);
  console.log(`Excel revisión: ${xlsxPath}`);
}

main();
