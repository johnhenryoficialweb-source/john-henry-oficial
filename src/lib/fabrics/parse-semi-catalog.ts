/**
 * Parseo del catálogo Excel "semi - clean".
 * Divide por / y " - "; expande solo rangos abreviados (ej. CT 1-016 - 1-018).
 */

export interface SemiFabricRow {
  supplier: string;
  reference: string;
  fabric_type: string;
  price_cop: number;
  price_usd: number;
  source_row: number;
}

export interface ParsedFabric {
  supplier: string;
  code: string;
  fabric_type: string;
  name: string;
  price_cop: number;
  price_usd: number;
  source_row: number;
  source_reference: string;
}

export interface AmbiguousReference {
  supplier: string;
  reference: string;
  fabric_type: string;
  price_cop: number;
  price_usd: number;
  source_row: number;
  segment: string;
  reason: string;
}

export interface ParseReport {
  input_rows: number;
  skipped_duplicates: number;
  parsed_count: number;
  ambiguous_count: number;
  by_supplier: Record<string, number>;
  by_fabric_type: Record<string, number>;
  duplicate_keys: Array<{ supplier: string; code: string; count: number }>;
  price_outliers: Array<{ supplier: string; code: string; implied_rate: number }>;
}

const SLASH_SPLIT = /\s*\/\s*/;
const DASH_SPLIT = /\s+-\s+/;
const Y_SPLIT = /\s+Y\s+/i;

/** Máximo de códigos generados en un rango numérico puro (14001-14057 queda literal). */
const MAX_PURE_NUMERIC_RANGE_SPAN = 50;

/** Normaliza precio USD: coma decimal europea → punto, sin redondeo arbitrario. */
export function parseUsd(value: string | number): number {
  if (typeof value === "number") return value;
  const normalized = String(value).trim().replace(",", ".");
  const n = Number(normalized);
  if (Number.isNaN(n)) throw new Error(`Precio USD inválido: ${value}`);
  return n;
}

/** COP como entero tal como viene en Excel. */
export function parseCop(value: string | number): number {
  if (typeof value === "number") return Math.round(value);
  const n = Number(String(value).trim().replace(/[^\d.-]/g, ""));
  if (Number.isNaN(n)) throw new Error(`Precio COP inválido: ${value}`);
  return Math.round(n);
}

function shouldInheritPrefix(segment: string, previous: string): boolean {
  const s = segment.trim();
  const prev = previous.trim();
  if (!s || !prev) return false;
  if (/^[A-Za-zÁÉÍÓÚÑ]/.test(s)) return false;
  if (!/[A-Za-zÁÉÍÓÚÑ]/.test(prev)) return false;
  return /^[\d]/.test(s) || /^\d+-\d+$/.test(s);
}

function inheritPrefix(previous: string, segment: string): string | null {
  const prev = previous.trim();
  const seg = segment.trim();
  const match = prev.match(/^(.+?)\s+[\w.'-]+$/);
  if (!match) return null;
  return `${match[1]} ${seg}`.trim();
}

function normalizeReference(reference: string): string {
  return reference.trim().replace(/\s+/g, " ");
}

const MAX_CODE_RANGE_SPAN = 30;

/** Filas del Excel que no deben importarse (referencias erróneas). */
const SKIP_REFERENCES = new Set(
  ["METZ 205-350", "METZ 204-120", "METZ 202-120"].map(normalizeReference)
);

/** Referencias con parseo manual (no expandir automáticamente). */
const REFERENCE_OVERRIDES: Record<string, string[]> = {
  [normalizeReference("TIRRENO 700-116 - 700-120")]: ["TIRRENO 700 - 119"],
};

function isPureNumber(value: string): boolean {
  return /^\d+$/.test(value.trim());
}

function expandNumericSequence(startStr: string, endStr: string, maxSpan: number): string[] | null {
  const startNum = Number.parseInt(startStr, 10);
  const endNum = Number.parseInt(endStr, 10);
  if (endNum < startNum || endNum - startNum > maxSpan) return null;
  const padWidth = Math.max(startStr.length, endStr.length);
  return Array.from({ length: endNum - startNum + 1 }, (_, i) =>
    String(startNum + i).padStart(padWidth, "0")
  );
}

/** Expande rangos compactos: 08-11 → 08, 09, 10, 11 */
function tryExpandCompactNumericRange(segment: string): string[] | null {
  const match = segment.trim().match(/^(\d+)-(\d+)$/);
  if (!match) return null;
  return expandNumericSequence(match[1], match[2], MAX_PURE_NUMERIC_RANGE_SPAN);
}

/** Expande rangos numéricos con espacios: 17001 - 17003 → 17001, 17002, 17003 */
function tryExpandPureNumericRange(left: string, right: string): string[] | null {
  if (!isPureNumber(left) || !isPureNumber(right)) return null;
  return expandNumericSequence(left.trim(), right.trim(), MAX_PURE_NUMERIC_RANGE_SPAN);
}

function formatRangedCode(prefix: string, num: number, padWidth: number): string {
  return `${prefix} - ${String(num).padStart(padWidth, "0")}`;
}

/** Expande rangos abreviados: CT 1-016 - 1-018 → CT 1 - 016, CT 1 - 017, CT 1 - 018 */
function tryExpandAbbreviatedCodeRange(left: string, right: string): string[] | null {
  const leftMatch = left.trim().match(/^(.+)-(\d+)$/);
  if (!leftMatch) return null;

  const prefix = leftMatch[1];
  const startStr = leftMatch[2];
  const startNum = Number.parseInt(startStr, 10);
  const padWidth = startStr.length;
  const rightTrimmed = right.trim();

  const shorthand = rightTrimmed.match(/^(\d+)-(\d+)$/);
  if (shorthand) {
    const shorthandPrefix = shorthand[1];
    const endStr = shorthand[2];
    const endNum = Number.parseInt(endStr, 10);
    const prefixEndsWithShorthand =
      prefix.endsWith(shorthandPrefix) || prefix.endsWith(` ${shorthandPrefix}`);
    if (!prefixEndsWithShorthand || endNum < startNum || endNum - startNum > MAX_CODE_RANGE_SPAN) {
      return null;
    }
    const width = Math.max(padWidth, endStr.length);
    return Array.from({ length: endNum - startNum + 1 }, (_, i) =>
      formatRangedCode(prefix, startNum + i, width)
    );
  }

  const fullRight = rightTrimmed.match(/^(.+)-(\d+)$/);
  if (fullRight && fullRight[1] === prefix) {
    const endNum = Number.parseInt(fullRight[2], 10);
    if (endNum < startNum || endNum - startNum > MAX_CODE_RANGE_SPAN) return null;
    return Array.from({ length: endNum - startNum + 1 }, (_, i) => `${prefix}-${startNum + i}`);
  }

  return null;
}

function splitByDashDelimiter(trimmed: string): string[] {
  const parts = trimmed
    .split(DASH_SPLIT)
    .map((p) => p.trim())
    .filter(Boolean);

  if (parts.length === 2) {
    const abbreviated = tryExpandAbbreviatedCodeRange(parts[0], parts[1]);
    if (abbreviated) return abbreviated;
    const pureNumeric = tryExpandPureNumericRange(parts[0], parts[1]);
    if (pureNumeric) return pureNumeric;
  }

  return parts;
}

/** Expande un segmento individual (Y, guiones, rangos compactos). */
function expandSegment(segment: string): string[] {
  const trimmed = segment.trim();
  if (!trimmed) return [];

  if (Y_SPLIT.test(trimmed)) {
    return trimmed
      .split(Y_SPLIT)
      .map((p) => p.trim())
      .filter(Boolean)
      .flatMap((p) => expandSegment(p));
  }

  if (DASH_SPLIT.test(trimmed)) {
    return splitByDashDelimiter(trimmed);
  }

  const compact = tryExpandCompactNumericRange(trimmed);
  if (compact) return compact;

  return [trimmed];
}

/** Divide una celda REFERENCIA en códigos literales individuales. */
export function splitReferenceLiteral(
  reference: string
): { codes: string[]; ambiguous: Array<{ segment: string; reason: string }> } {
  const ambiguous: Array<{ segment: string; reason: string }> = [];
  const trimmed = reference.trim();
  const hasSlash = SLASH_SPLIT.test(trimmed);

  if (hasSlash) {
    const slashParts = trimmed
      .split(SLASH_SPLIT)
      .map((p) => p.trim())
      .filter(Boolean);

    const codes: string[] = [];
    for (let i = 0; i < slashParts.length; i++) {
      let part = slashParts[i];
      if (i > 0 && shouldInheritPrefix(part, codes[codes.length - 1])) {
        const inherited = inheritPrefix(codes[codes.length - 1], part);
        if (inherited) part = inherited;
        else ambiguous.push({ segment: part, reason: "prefix_unclear" });
      }
      codes.push(part);
    }
    return { codes: codes.flatMap((part) => expandSegment(part)), ambiguous };
  }

  return { codes: expandSegment(trimmed), ambiguous };
}

export function buildFabricName(fabricType: string, code: string): string {
  return `${fabricType} — ${code}`;
}

export function parseSemiRows(rows: SemiFabricRow[]): {
  parsed: ParsedFabric[];
  ambiguous: AmbiguousReference[];
  report: ParseReport;
} {
  const parsed: ParsedFabric[] = [];
  const ambiguous: AmbiguousReference[] = [];
  const seenRowKeys = new Set<string>();
  let skippedDuplicates = 0;

  const keyCounts = new Map<string, number>();

  for (const row of rows) {
    const rowKey = `${row.supplier}|${row.reference}|${row.fabric_type}|${row.price_cop}|${row.price_usd}`;
    if (seenRowKeys.has(rowKey)) {
      skippedDuplicates++;
      continue;
    }
    seenRowKeys.add(rowKey);

    const normalizedRef = normalizeReference(row.reference);
    if (SKIP_REFERENCES.has(normalizedRef)) continue;

    let codes: string[];
    const override = REFERENCE_OVERRIDES[normalizedRef];
    if (override) {
      codes = override;
    } else {
      const split = splitReferenceLiteral(row.reference);
      codes = split.codes;
      for (const a of split.ambiguous) {
        ambiguous.push({
          supplier: row.supplier,
          reference: row.reference,
          fabric_type: row.fabric_type,
          price_cop: row.price_cop,
          price_usd: row.price_usd,
          source_row: row.source_row,
          segment: a.segment,
          reason: a.reason,
        });
      }
    }

    for (const code of codes) {
      const fabric: ParsedFabric = {
        supplier: row.supplier,
        code,
        fabric_type: row.fabric_type,
        name: buildFabricName(row.fabric_type, code),
        price_cop: row.price_cop,
        price_usd: row.price_usd,
        source_row: row.source_row,
        source_reference: row.reference,
      };
      parsed.push(fabric);
      const k = `${fabric.supplier}|${fabric.code}`;
      keyCounts.set(k, (keyCounts.get(k) ?? 0) + 1);
    }
  }

  const by_supplier: Record<string, number> = {};
  const by_fabric_type: Record<string, number> = {};
  for (const f of parsed) {
    by_supplier[f.supplier] = (by_supplier[f.supplier] ?? 0) + 1;
    by_fabric_type[f.fabric_type] = (by_fabric_type[f.fabric_type] ?? 0) + 1;
  }

  const duplicate_keys = [...keyCounts.entries()]
    .filter(([, count]) => count > 1)
    .map(([key, count]) => {
      const [supplier, code] = key.split("|");
      return { supplier, code, count };
    });

  const price_outliers: ParseReport["price_outliers"] = [];
  for (const f of parsed) {
    if (f.price_usd <= 0) continue;
    const rate = f.price_cop / f.price_usd;
    if (rate < 2500 || rate > 4500) {
      price_outliers.push({ supplier: f.supplier, code: f.code, implied_rate: Math.round(rate) });
    }
  }

  const report: ParseReport = {
    input_rows: rows.length,
    skipped_duplicates: skippedDuplicates,
    parsed_count: parsed.length,
    ambiguous_count: ambiguous.length,
    by_supplier,
    by_fabric_type,
    duplicate_keys,
    price_outliers,
  };

  return { parsed, ambiguous, report };
}
