import { readFileSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import type { AmbiguousReference, ParsedFabric, ParseReport } from "../src/lib/fabrics/parse-semi-catalog";
import { writeFabricsWorkbook } from "../src/lib/fabrics/export-fabrics-xlsx";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const OUT_DIR = join(ROOT, "data/new");
const DEFAULT_PARSED = join(OUT_DIR, "semi-clean.parsed.json");
const DEFAULT_AMBIGUOUS = join(OUT_DIR, "semi-clean.ambiguous.json");
const DEFAULT_REPORT = join(OUT_DIR, "semi-clean.report.json");
const DEFAULT_OUTPUT = join(OUT_DIR, "semi-clean.parsed.xlsx");

function main() {
  const parsedPath = process.argv[2] ?? DEFAULT_PARSED;
  const outputPath = process.argv[3] ?? DEFAULT_OUTPUT;

  if (!existsSync(parsedPath)) {
    console.error(`No existe ${parsedPath}. Ejecuta primero: npm run parse:fabrics`);
    process.exit(1);
  }

  const parsed = JSON.parse(readFileSync(parsedPath, "utf8")) as ParsedFabric[];
  const ambiguous = existsSync(DEFAULT_AMBIGUOUS)
    ? (JSON.parse(readFileSync(DEFAULT_AMBIGUOUS, "utf8")) as AmbiguousReference[])
    : [];
  const report = existsSync(DEFAULT_REPORT)
    ? (JSON.parse(readFileSync(DEFAULT_REPORT, "utf8")) as ParseReport)
    : {
        input_rows: 0,
        skipped_duplicates: 0,
        parsed_count: parsed.length,
        ambiguous_count: ambiguous.length,
        by_supplier: {},
        by_fabric_type: {},
        duplicate_keys: [],
        price_outliers: [],
      };

  writeFabricsWorkbook(outputPath, parsed, ambiguous, report);
  console.log(`Excel generado: ${outputPath}`);
  console.log(`Telas: ${parsed.length} · Ambiguas: ${ambiguous.length}`);
}

main();
