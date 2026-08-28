import * as XLSX from "xlsx";
import type { AmbiguousReference, ParsedFabric, ParseReport } from "./parse-semi-catalog";

const PARSED_HEADERS = [
  "Proveedor",
  "Código",
  "Tipo / muestrario",
  "Nombre",
  "Precio COP/m",
  "Precio USD/m",
  "Fila Excel",
  "Referencia origen",
] as const;

function parsedToRows(fabrics: ParsedFabric[]) {
  return fabrics.map((f) => [
    f.supplier,
    f.code,
    f.fabric_type,
    f.name,
    f.price_cop,
    f.price_usd,
    f.source_row,
    f.source_reference,
  ]);
}

function ambiguousToRows(items: AmbiguousReference[]) {
  return items.map((a) => [
    a.supplier,
    a.reference,
    a.fabric_type,
    a.price_cop,
    a.price_usd,
    a.source_row,
    a.segment,
    a.reason,
  ]);
}

function reportToRows(report: ParseReport) {
  const rows: (string | number)[][] = [
    ["Métrica", "Valor"],
    ["Filas Excel", report.input_rows],
    ["Duplicadas omitidas", report.skipped_duplicates],
    ["Telas parseadas", report.parsed_count],
    ["Casos ambiguos", report.ambiguous_count],
    ["Duplicados (proveedor+código)", report.duplicate_keys.length],
    [],
    ["Por proveedor", "Cantidad"],
    ...Object.entries(report.by_supplier).map(([k, v]) => [k, v]),
    [],
    ["Duplicados", "Veces"],
    ...report.duplicate_keys.map((d) => [`${d.supplier} · ${d.code}`, d.count]),
  ];
  return rows;
}

export function buildFabricsWorkbook(
  parsed: ParsedFabric[],
  ambiguous: AmbiguousReference[],
  report: ParseReport
): XLSX.WorkBook {
  const wb = XLSX.utils.book_new();

  // `as const` hace la tupla readonly y aoa_to_sheet pide filas mutables.
  const telas = XLSX.utils.aoa_to_sheet([[...PARSED_HEADERS], ...parsedToRows(parsed)]);
  telas["!cols"] = [
    { wch: 16 },
    { wch: 28 },
    { wch: 22 },
    { wch: 40 },
    { wch: 14 },
    { wch: 14 },
    { wch: 10 },
    { wch: 36 },
  ];
  XLSX.utils.book_append_sheet(wb, telas, "Telas");

  if (ambiguous.length > 0) {
    const ambHeaders = [
      "Proveedor",
      "Referencia",
      "Tipo",
      "COP",
      "USD",
      "Fila Excel",
      "Segmento",
      "Motivo",
    ];
    const ambSheet = XLSX.utils.aoa_to_sheet([ambHeaders, ...ambiguousToRows(ambiguous)]);
    XLSX.utils.book_append_sheet(wb, ambSheet, "Ambiguas");
  }

  const resumen = XLSX.utils.aoa_to_sheet(reportToRows(report));
  XLSX.utils.book_append_sheet(wb, resumen, "Resumen");

  return wb;
}

export function writeFabricsWorkbook(
  path: string,
  parsed: ParsedFabric[],
  ambiguous: AmbiguousReference[],
  report: ParseReport
) {
  const wb = buildFabricsWorkbook(parsed, ambiguous, report);
  XLSX.writeFile(wb, path);
}
