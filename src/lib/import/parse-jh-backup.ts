import type { GarmentType } from "@/types/database.types";

/**
 * Parser del dump completo del sistema legacy (`backup_JH.xlsx`, hojas
 * `clients` y `orders`).
 *
 * Reemplaza a parse-jh-clients.ts, que leía un export truncado en 1000 filas y
 * cruzaba clientes con órdenes POR NOMBRE — fusionando homónimos que en realidad
 * son personas distintas. Este dump trae los ids reales del legacy
 * (`clients.id`, `orders.idClient`), así que el cruce es exacto y no hay que
 * fusionar a nadie.
 */

export type LocationCode = "CO" | "PA";

/** Fila cruda: la hoja tiene 84 columnas, se accede por nombre. */
export type RawRow = Record<string, string | null | undefined>;

export interface ParsedBackupClient {
  import_source_key: string;
  legacy_id: string;
  full_name: string;
  phone: string;
  email: string | null;
  document_id: string | null;
  notes: string | null;
  location_code: LocationCode;
  /** La sede salió del fallback, no de una señal real. */
  location_inferred: boolean;
}

export interface ParsedMeasurement {
  import_source_key: string;
  legacy_client_id: string;
  garment_type: GarmentType;
  values: Record<string, number>;
  taken_at: string | null;
}

export interface ParsedBackupOrderItem {
  garment_type: GarmentType;
  /** Especificación textual de la prenda tal como la escribió el sastre. */
  notes: string;
}

export interface ParsedBackupOrder {
  import_source_key: string;
  legacy_id: string;
  legacy_client_id: string;
  order_number: string;
  location_code: LocationCode;
  status: "delivered" | "in_production";
  created_at: string;
  expected_delivery_date: string | null;
  notes: string | null;
  items: ParsedBackupOrderItem[];
}

export interface DiscardedMeasurement {
  legacy_client_id: string;
  full_name: string;
  garment_type: GarmentType;
  legacy_column: string;
  field: string;
  value: number;
  reason: string;
}

/** Medida que entró, pero corrigiendo la convención con que fue tomada. */
export interface NormalizedMeasurement {
  legacy_client_id: string;
  full_name: string;
  garment_type: GarmentType;
  legacy_column: string;
  field: string;
  original: number;
  value: number;
  rule: string;
}

export interface BackupReport {
  clients_rows: number;
  clients_parsed: number;
  clients_without_phone: number;
  phone_collisions: Array<{ legacy_id: string; full_name: string; phone: string }>;
  location_inferred: number;
  by_location: Record<LocationCode, { clients: number; orders: number }>;
  measurements_rows: number;
  measurements_by_garment: Record<string, number>;
  discarded_measurements: number;
  normalized_measurements: number;
  normalized_by_rule: Record<string, number>;
  orders_rows: number;
  orders_parsed: number;
  orders_orphan: number;
  orders_without_items: string[];
  order_items_rows: number;
}

/* ------------------------------------------------------------------ *
 * Normalización de celdas
 * ------------------------------------------------------------------ */

/**
 * El export escribe el string literal `NULL` para los vacíos. Sin esto la
 * cobertura de medidas se lee 617/617 cuando la real es 471.
 */
export function cell(value: string | null | undefined): string | null {
  if (value == null) return null;
  // Se repara acá y no en cada llamador: por esta función pasa TODO el texto
  // del backup (nombres, notas, especificaciones de prenda).
  const s = unmojibake(String(value)).trim();
  if (!s || s.toUpperCase() === "NULL") return null;
  return s;
}

/**
 * Repara los acentos corruptos del export.
 *
 * El volcado escribió cada byte Latin-1 alto como un punto de código del Área
 * de Uso Privado suplementaria: `ñ` (0xF1) salió como U+FFFF1, `á` (0xE1) como
 * U+FFFE1, y así. El patrón es exacto —U+FFF00 + el byte original— así que
 * quedarse con el byte bajo recupera el carácter real. Son 1573 caracteres en
 * todo el backup, y caen justo donde más se notan: "Puño", "Peña", "Panamá".
 *
 * Reemplazarlos por `?` (como se hacía antes) destruía el dato en vez de
 * arreglarlo.
 */
const PUA_A_START = 0xf0000;
const PUA_A_END = 0xffffd;

export function unmojibake(value: string): string {
  return [...value]
    .map((c) => {
      const cp = c.codePointAt(0)!;
      if (cp < PUA_A_START || cp > PUA_A_END) return c;
      return String.fromCharCode(cp & 0xff);
    })
    .join("");
}

/** Número positivo, o null. Acepta coma decimal. */
export function numeric(value: string | null | undefined): number | null {
  const s = cell(value);
  if (s == null) return null;
  const n = Number(s.replace(",", "."));
  if (!Number.isFinite(n) || n <= 0) return null;
  return n;
}

const EXCEL_EPOCH_OFFSET_DAYS = 25569;
const MS_PER_DAY = 86400 * 1000;

/**
 * Las columnas de fecha del legacy mezclan CUATRO formatos, a veces dentro de
 * la misma columna:
 *
 *   45324                  serial de Excel
 *   45598.742361111108     serial de Excel con hora
 *   1706735087             epoch Unix en segundos
 *   02-14-24               texto MM-DD-YY
 *   1/31/24 14:21          texto M/D/YY HH:MM
 *
 * Devuelve ISO completo, o null si no se puede interpretar.
 */
export function parseLegacyDate(value: string | null | undefined): string | null {
  const s = cell(value);
  if (s == null) return null;

  if (/^\d+(\.\d+)?$/.test(s)) {
    const n = Number(s);
    // Un epoch Unix de esta época tiene 10 dígitos; un serial de Excel, 5.
    const ms = n > 1_000_000_000 ? n * 1000 : (n - EXCEL_EPOCH_OFFSET_DAYS) * MS_PER_DAY;
    const d = new Date(ms);
    return Number.isNaN(d.getTime()) ? null : d.toISOString();
  }

  // MM-DD-YY o M/D/YY, con hora opcional.
  const m = s.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{2,4})(?:\s+(\d{1,2}):(\d{2}))?$/);
  if (m) {
    const [, mo, da, yr, hh, mi] = m;
    const year = yr.length === 2 ? 2000 + Number(yr) : Number(yr);
    const d = new Date(Date.UTC(year, Number(mo) - 1, Number(da), Number(hh ?? 0), Number(mi ?? 0)));
    return Number.isNaN(d.getTime()) ? null : d.toISOString();
  }

  return null;
}

export function isoDateOnly(iso: string | null): string | null {
  return iso ? iso.slice(0, 10) : null;
}

/* ------------------------------------------------------------------ *
 * Sede
 * ------------------------------------------------------------------ */

const CO_PLACES = /COLOMB|BOGOT|MEDELL|CALI|BARRANQ|CARTAG|PEREIRA|BUCARAMANGA|CUCUTA|IBAGUE|MANIZALES/;
const PA_PLACES = /PANAM|PTY|CHIRIQUI|DAVID|COLON/;

/**
 * Cascada validada contra los datos: ciudad/país resuelve 363 clientes, el
 * patrón telefónico resuelve otros 171, y solo 4 dan señales en conflicto
 * (gana la ciudad, que es un dato escrito a mano sobre el cliente).
 */
export function inferLocation(row: RawRow): { code: LocationCode; inferred: boolean } {
  const place = `${cell(row.city) ?? ""} ${cell(row.country) ?? ""}`.toUpperCase();
  if (PA_PLACES.test(place)) return { code: "PA", inferred: false };
  if (CO_PLACES.test(place)) return { code: "CO", inferred: false };

  const digits = (cell(row.phone) ?? "").replace(/\D/g, "");
  if (digits) {
    if (digits.startsWith("507")) return { code: "PA", inferred: false };
    if (digits.startsWith("57") && digits.length >= 12) return { code: "CO", inferred: false };
    if (digits.length === 10 && digits.startsWith("3")) return { code: "CO", inferred: false };
    if (digits.length === 8) return { code: "PA", inferred: false };
  }

  return { code: "PA", inferred: true };
}

/* ------------------------------------------------------------------ *
 * Medidas
 * ------------------------------------------------------------------ */

interface FieldSpec {
  /** Columna del legacy. */
  column: string;
  /** Clave en GARMENT_MEASUREMENT_FIELDS (src/lib/constants.ts). */
  field: string;
  /** Rango plausible en cm. */
  min: number;
  max: number;
  /**
   * Por debajo de este umbral la medida está tomada a la MITAD y se duplica.
   * Ver el comentario de `saco_Espalda`.
   */
  doubleBelow?: number;
  /**
   * Por encima del umbral la columna guarda en realidad otra medida distinta.
   * Ver el comentario de `pant_entrepierna`.
   */
  splitAbove?: { threshold: number; field: string; min: number; max: number };
}

/**
 * Rangos calibrados con la mediana REAL de cada columna del dump, no con un
 * rango genérico: `saco_Hombro` (mediana 15) y `pant_bota` (mediana 18) son
 * correctos aunque parezcan bajos — son largo de hombro y ancho de bota, no
 * circunferencias. Lo que sí se descarta son imposibles como un Torax de 10 cm
 * donde la mediana es 109.
 */
const SACO_FIELDS: FieldSpec[] = [
  { column: "saco_Torax", field: "chest", min: 60, max: 180 },
  { column: "saco_Largo", field: "back_length", min: 45, max: 100 },
  { column: "saco_Manga", field: "sleeve_length", min: 40, max: 85 },
  { column: "saco_Hombro", field: "shoulder_seam", min: 8, max: 25 },
  /**
   * `saco_Espalda` viene con DOS convenciones mezcladas: 180 clientes la tienen
   * tomada a media espalda y 202 completa. No es ruido, está demostrado:
   *
   *   - La distribución es bimodal con un valle limpio en 28–33. El grupo bajo
   *     tiene mediana 22 y el alto mediana 44 — exactamente el doble.
   *   - Contrastado contra `cami_Espalda` (siempre completa, mediana 48) en los
   *     289 clientes que tienen ambas: el grupo bajo da una razón camisa/saco de
   *     2.14 y el alto de 1.09.
   *
   * Por eso los valores bajo 28 se duplican en vez de descartarse: descartarlos
   * tiraba 180 medidas buenas.
   */
  { column: "saco_Espalda", field: "back_width", min: 28, max: 70, doubleBelow: 28 },
  { column: "saco_Cintura", field: "waist", min: 55, max: 180 },
  { column: "saco_Base", field: "hem_circ", min: 60, max: 190 },
  { column: "saco_hah", field: "shoulder_width", min: 30, max: 60 },
  { column: "saco_contorno_brazo", field: "arm_circ", min: 20, max: 60 },
  { column: "saco_contorno_puno", field: "cuff", min: 10, max: 32 },
];

const CAMISA_FIELDS: FieldSpec[] = [
  { column: "cami_Cuello", field: "neck", min: 28, max: 65 },
  { column: "cami_Espalda", field: "back_width", min: 30, max: 65 },
  { column: "cami_Manga", field: "sleeve_length", min: 40, max: 85 },
  { column: "cami_Largo", field: "shirt_length", min: 50, max: 110 },
  { column: "cami_Base", field: "hem_circ", min: 60, max: 180 },
  { column: "cami_Cintura", field: "waist", min: 55, max: 185 },
  { column: "cami_Pecho", field: "chest", min: 60, max: 185 },
  { column: "cami_puno", field: "cuff", min: 12, max: 40 },
];

const PANTALON_FIELDS: FieldSpec[] = [
  { column: "pant_cintura", field: "waist", min: 40, max: 150 },
  { column: "pant_base", field: "hip", min: 50, max: 160 },
  { column: "pant_muslo", field: "thigh", min: 22, max: 85 },
  { column: "pant_rodilla", field: "knee", min: 14, max: 50 },
  { column: "pant_bota", field: "hem", min: 12, max: 40 },
  { column: "pant_largo", field: "outseam", min: 60, max: 130 },
  /**
   * `pant_entrepierna` también guarda dos medidas distintas, pero acá NO es
   * cuestión de mitades: 129 valores rondan los 27 cm (eso es el TIRO, no la
   * entrepierna — una entrepierna de adulto ronda los 80) y 5 rondan los 71
   * (esos sí son entrepierna real). Duplicar 27 daría 54, que no corresponde a
   * ninguna de las dos, así que se separan por umbral.
   *
   * Importa además para el maniquí 3D: `pose.ts` levanta toda la figura desde
   * `inseam`, así que meter 27 ahí dejaría piernas de 27 cm.
   */
  {
    column: "pant_entrepierna",
    field: "rise",
    min: 18,
    max: 40,
    splitAbove: { threshold: 45, field: "inseam", min: 45, max: 100 },
  },
];

const CHALECO_FIELDS: FieldSpec[] = [
  { column: "chl_Escote", field: "neckline", min: 20, max: 60 },
  { column: "chl_Largo_Delante", field: "front_length", min: 30, max: 90 },
  { column: "chl__Largo_detras", field: "vest_back_length", min: 28, max: 85 },
  { column: "chl_Pecho", field: "chest", min: 60, max: 180 },
  { column: "chl_Cintura", field: "waist", min: 55, max: 175 },
  { column: "chl_Hombro", field: "shoulder_width", min: 8, max: 60 },
  { column: "chl_Espalda", field: "back_width", min: 10, max: 70 },
];

export const GARMENT_FIELD_SPECS: Array<{ garment: GarmentType; fields: FieldSpec[] }> = [
  { garment: "saco", fields: SACO_FIELDS },
  { garment: "camisa", fields: CAMISA_FIELDS },
  { garment: "pantalon", fields: PANTALON_FIELDS },
  { garment: "chaleco", fields: CHALECO_FIELDS },
];

/** Columnas de texto libre que acompañan a cada prenda (no son medidas). */
const EXTRA_COLUMNS: Array<{ column: string; label: string }> = [
  { column: "saco_Letras", label: "Iniciales saco" },
  { column: "saco_metraje", label: "Material saco" },
  { column: "saco_Observacion", label: "Obs. saco" },
  { column: "cami_Letras", label: "Iniciales camisa" },
  { column: "cami_metraje", label: "Material camisa" },
  { column: "cami_Observacion", label: "Obs. camisa" },
  { column: "pant_metraje", label: "Material pantalón" },
  { column: "pant_observacion", label: "Obs. pantalón" },
  { column: "chl_metraje", label: "Material chaleco" },
  { column: "chl_Observacion", label: "Obs. chaleco" },
];

export function extractMeasurements(
  row: RawRow,
  legacyId: string,
  fullName: string,
  takenAt: string | null
): {
  measurements: ParsedMeasurement[];
  discarded: DiscardedMeasurement[];
  normalized: NormalizedMeasurement[];
} {
  const measurements: ParsedMeasurement[] = [];
  const discarded: DiscardedMeasurement[] = [];
  const normalized: NormalizedMeasurement[] = [];

  for (const { garment, fields } of GARMENT_FIELD_SPECS) {
    const values: Record<string, number> = {};
    for (const spec of fields) {
      const raw = numeric(row[spec.column]);
      if (raw == null) continue;

      let value = raw;
      let field = spec.field;
      let min = spec.min;
      let max = spec.max;

      if (spec.splitAbove && raw >= spec.splitAbove.threshold) {
        field = spec.splitAbove.field;
        min = spec.splitAbove.min;
        max = spec.splitAbove.max;
        normalized.push({
          legacy_client_id: legacyId,
          full_name: fullName,
          garment_type: garment,
          legacy_column: spec.column,
          field,
          original: raw,
          value,
          rule: `≥${spec.splitAbove.threshold} cm: se interpreta como "${field}" y no como "${spec.field}"`,
        });
      } else if (spec.doubleBelow != null && raw < spec.doubleBelow) {
        value = raw * 2;
        normalized.push({
          legacy_client_id: legacyId,
          full_name: fullName,
          garment_type: garment,
          legacy_column: spec.column,
          field,
          original: raw,
          value,
          rule: `<${spec.doubleBelow} cm: medida tomada a la mitad, se duplica`,
        });
      }

      if (value < min || value > max) {
        discarded.push({
          legacy_client_id: legacyId,
          full_name: fullName,
          garment_type: garment,
          legacy_column: spec.column,
          field,
          value: raw,
          reason: `fuera del rango plausible ${min}–${max} cm`,
        });
        continue;
      }
      values[field] = value;
    }
    if (Object.keys(values).length > 0) {
      measurements.push({
        import_source_key: `jh-meas-${legacyId}-${garment}`,
        legacy_client_id: legacyId,
        garment_type: garment,
        values,
        taken_at: takenAt,
      });
    }
  }

  return { measurements, discarded, normalized };
}

/* ------------------------------------------------------------------ *
 * Clientes
 * ------------------------------------------------------------------ */

function buildFullName(row: RawRow): string {
  return [cell(row.name), cell(row.lastName), cell(row.marriedName)]
    .filter(Boolean)
    .join(" ")
    .replace(/\s+/g, " ")
    .trim();
}

function buildClientNotes(row: RawRow, locationInferred: boolean): string | null {
  const parts: string[] = [];
  const obs = cell(row.obs);
  if (obs) parts.push(obs);

  const address = cell(row.address);
  if (address) parts.push(`Dirección: ${address}`);

  const place = [cell(row.city), cell(row.country)].filter((v): v is string => v != null).join(", ");
  if (place) parts.push(place);

  for (const { column, label } of EXTRA_COLUMNS) {
    const v = cell(row[column]);
    if (v) parts.push(`${label}: ${v}`);
  }

  if (locationInferred) parts.push("[Sede inferida en el import — verificar]");

  return parts.length > 0 ? parts.join(" · ") : null;
}

/* ------------------------------------------------------------------ *
 * Entrada principal
 * ------------------------------------------------------------------ */

export function parseBackup(
  clientRows: RawRow[],
  orderRows: RawRow[],
  today = new Date()
): {
  clients: ParsedBackupClient[];
  measurements: ParsedMeasurement[];
  orders: ParsedBackupOrder[];
  discarded: DiscardedMeasurement[];
  normalized: NormalizedMeasurement[];
  report: BackupReport;
} {
  const clients: ParsedBackupClient[] = [];
  const measurements: ParsedMeasurement[] = [];
  const discarded: DiscardedMeasurement[] = [];
  const normalized: NormalizedMeasurement[] = [];
  const phoneCollisions: BackupReport["phone_collisions"] = [];
  const locationByClient = new Map<string, LocationCode>();

  /** unique (home_location_id, phone) obliga a resolver choques en el import. */
  const usedPhones = new Set<string>();
  let withoutPhone = 0;
  let inferredCount = 0;

  for (const row of clientRows) {
    const legacyId = cell(row.id);
    if (!legacyId) continue;

    const fullName = buildFullName(row);
    if (!fullName) continue;

    const { code, inferred } = inferLocation(row);
    if (inferred) inferredCount++;
    locationByClient.set(legacyId, code);

    const digits = (cell(row.phone) ?? "").replace(/\D/g, "");
    let phone: string;
    if (!digits) {
      // La columna es NOT NULL: se usa un placeholder determinista.
      phone = `SIN-TEL-${legacyId}`;
      withoutPhone++;
    } else {
      phone = digits;
    }

    const key = `${code}|${phone}`;
    if (usedPhones.has(key)) {
      phone = `${phone}-${legacyId}`;
      phoneCollisions.push({ legacy_id: legacyId, full_name: fullName, phone });
    }
    usedPhones.add(`${code}|${phone}`);

    clients.push({
      import_source_key: `jh-client-${legacyId}`,
      legacy_id: legacyId,
      full_name: fullName,
      phone,
      email: cell(row.email),
      document_id: cell(row.doc),
      notes: buildClientNotes(row, inferred),
      location_code: code,
      location_inferred: inferred,
    });

    // `birthday` se descarta a propósito: el formulario legacy pedía elegir el
    // año actual, así que todos los años son basura (2024).
    const takenAt = parseLegacyDate(row.dateModified) ?? parseLegacyDate(row.dateCreated);
    const extracted = extractMeasurements(row, legacyId, fullName, takenAt);
    measurements.push(...extracted.measurements);
    discarded.push(...extracted.discarded);
    normalized.push(...extracted.normalized);
  }

  /* ---------------------------- órdenes ---------------------------- */

  const GARMENT_COLUMNS: Array<{ column: string; garment: GarmentType }> = [
    { column: "pantalon", garment: "pantalon" },
    { column: "saco", garment: "saco" },
    { column: "camisa", garment: "camisa" },
  ];

  const orders: ParsedBackupOrder[] = [];
  const ordersWithoutItems: string[] = [];
  let orphan = 0;
  let itemCount = 0;
  const byLocation: BackupReport["by_location"] = {
    CO: { clients: 0, orders: 0 },
    PA: { clients: 0, orders: 0 },
  };
  for (const c of clients) byLocation[c.location_code].clients++;

  const todayIso = today.toISOString().slice(0, 10);

  for (const row of orderRows) {
    const legacyId = cell(row.id);
    const clientId = cell(row.idClient);
    if (!legacyId || !clientId) continue;

    const code = locationByClient.get(clientId);
    if (!code) {
      orphan++;
      continue;
    }

    const items: ParsedBackupOrderItem[] = [];
    for (const { column, garment } of GARMENT_COLUMNS) {
      const spec = cell(row[column]);
      if (spec) items.push({ garment_type: garment, notes: spec });
    }
    const otra = cell(row.otra);
    const otraName = cell(row.otra_nombre);
    if (otra || otraName) {
      items.push({
        garment_type: "otro",
        notes: [otraName, otra].filter(Boolean).join(": "),
      });
    }
    if (items.length === 0) ordersWithoutItems.push(legacyId);
    itemCount += items.length;

    const createdAt = parseLegacyDate(row.dateOrder);
    const deliveryIso = parseLegacyDate(row.dateEnd);
    const delivery = isoDateOnly(deliveryIso);
    const testIso = isoDateOnly(parseLegacyDate(row.dateTest));

    // El flag `end` solo vale 1 en 13 de 1070 filas, así que no sirve para
    // decidir el estado. Se usa la fecha de entrega contra hoy.
    const status: ParsedBackupOrder["status"] =
      delivery && delivery > todayIso ? "in_production" : "delivered";

    const notes: string[] = [];
    if (testIso) notes.push(`Fecha de prueba: ${testIso}`);

    orders.push({
      import_source_key: `jh-order-${legacyId}`,
      legacy_id: legacyId,
      legacy_client_id: clientId,
      order_number: `JH-${code}-${legacyId.padStart(6, "0")}`,
      location_code: code,
      status,
      created_at: createdAt ?? new Date().toISOString(),
      expected_delivery_date: delivery,
      notes: notes.length > 0 ? notes.join(" · ") : null,
      items,
    });

    byLocation[code].orders++;
  }

  const measurementsByGarment: Record<string, number> = {};
  for (const m of measurements) {
    measurementsByGarment[m.garment_type] = (measurementsByGarment[m.garment_type] ?? 0) + 1;
  }

  const report: BackupReport = {
    clients_rows: clientRows.length,
    clients_parsed: clients.length,
    clients_without_phone: withoutPhone,
    phone_collisions: phoneCollisions,
    location_inferred: inferredCount,
    by_location: byLocation,
    measurements_rows: measurements.length,
    measurements_by_garment: measurementsByGarment,
    discarded_measurements: discarded.length,
    normalized_measurements: normalized.length,
    normalized_by_rule: normalized.reduce<Record<string, number>>((acc, n) => {
      const key = `${n.legacy_column} → ${n.field}`;
      acc[key] = (acc[key] ?? 0) + 1;
      return acc;
    }, {}),
    orders_rows: orderRows.length,
    orders_parsed: orders.length,
    orders_orphan: orphan,
    orders_without_items: ordersWithoutItems,
    order_items_rows: itemCount,
  };

  return { clients, measurements, orders, discarded, normalized, report };
}
