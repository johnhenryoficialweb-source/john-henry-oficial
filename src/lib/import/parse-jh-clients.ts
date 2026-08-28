import type { GarmentType } from "@/types/database.types";

export type LocationCode = "CO" | "PA";

export interface RawClientRow {
  document_id: string;
  full_name: string;
  phone_raw: string;
  email: string;
  address: string;
  source_row: number;
}

export interface ParsedClient {
  client_key: string;
  full_name: string;
  phone: string;
  email: string | null;
  document_id: string | null;
  notes: string | null;
  location_code: LocationCode;
  source_rows: number[];
  merged_from: number;
}

export interface ParsedOrderItem {
  garment_type: GarmentType;
  quantity: number;
  unit_price: number;
}

export interface ParsedOrder {
  import_source_key: string;
  client_key: string;
  client_name: string;
  location_code: LocationCode;
  status: "delivered";
  created_at: string;
  expected_delivery_date: string | null;
  notes: string;
  subtotal: number;
  discount: number;
  total: number;
  items: ParsedOrderItem[];
  source_row: number;
  pedido_raw: string;
}

export interface JhImportReport {
  clients_input_rows: number;
  clients_parsed: number;
  clients_merged: number;
  clients_without_orders: number;
  orders_parsed: number;
  orders_orphan: number;
  synthetic_phones: Array<{ client_key: string; full_name: string; phone: string }>;
  merged_names: Array<{ client_key: string; full_name: string; merged_rows: number[] }>;
  by_location: Record<LocationCode, { clients: number; orders: number }>;
  garment_type_counts: Record<string, number>;
}

/** Normaliza nombre para cruce clientes ↔ pedidos. */
export function normalizeName(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ");
}

/** Serial Excel → ISO date (YYYY-MM-DD). */
export function excelSerialToDateString(serial: number): string {
  const ms = (serial - 25569) * 86400 * 1000;
  return new Date(ms).toISOString().slice(0, 10);
}

/** Serial Excel → ISO timestamp. */
export function excelSerialToIso(serial: number): string {
  const ms = (serial - 25569) * 86400 * 1000;
  return new Date(ms).toISOString();
}

function isBadPhone(value: string): boolean {
  const s = value.trim();
  return !s || s.includes("ERROR") || s.includes("NAME");
}

function cleanPhoneDigits(value: string): string | null {
  const digits = value.replace(/\D/g, "");
  return digits.length >= 6 ? digits : null;
}

/** Infiere sede CO (Bogotá) o PA (Panamá). */
export function inferLocationCode(row: RawClientRow): LocationCode {
  const addr = row.address.trim().toUpperCase();
  const phone = isBadPhone(row.phone_raw) ? null : cleanPhoneDigits(row.phone_raw);
  const doc = String(row.document_id ?? "").trim();

  if (/COLOMBIA|BOGOTA|BOGOTÁ|DIMAYOR|CARRERA|CRA |CR |CLL |CALLE /i.test(addr)) {
    return "CO";
  }
  if (/PANAMA|PANAMÁ/i.test(addr)) return "PA";

  if (phone) {
    if (phone.startsWith("57") && phone.length >= 11) return "CO";
    if (/^3\d{9}$/.test(phone)) return "CO";
    if (phone.length <= 8) return "PA";
  }

  if (/^\d{8,10}$/.test(doc.replace(/\D/g, "")) && !doc.includes("-")) return "CO";
  if (doc.includes("-")) return "PA";

  return "PA";
}

function scoreClientRow(row: RawClientRow): number {
  let score = 0;
  if (!isBadPhone(row.phone_raw)) score += 10;
  if (row.email.trim()) score += 5;
  if (row.document_id) score += 2;
  if (row.address.trim()) score += 1;
  return score;
}

function buildNotes(address: string, mergedAddresses: string[]): string | null {
  const parts = [address, ...mergedAddresses].map((p) => p.trim()).filter(Boolean);
  const unique = [...new Set(parts)];
  return unique.length > 0 ? unique.join(" | ") : null;
}

/** Tokeniza columna Pedido → garment_type[]. */
export function parseGarmentTokens(pedido: string): GarmentType[] {
  const tokens = pedido
    .trim()
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean);

  const map: Record<string, GarmentType> = {
    saco: "saco",
    pantalon: "pantalon",
    camisa: "camisa",
    chaleco: "chaleco",
    otra: "otro",
  };

  const seen = new Set<GarmentType>();
  const result: GarmentType[] = [];
  for (const token of tokens) {
    const gt = map[token];
    if (gt && !seen.has(gt)) {
      seen.add(gt);
      result.push(gt);
    }
  }
  return result.length > 0 ? result : ["otro"];
}

function assignPhones(
  clients: Array<ParsedClient & { _source_row: number }>
): { clients: ParsedClient[]; synthetic: JhImportReport["synthetic_phones"] } {
  const used = new Set<string>();
  const synthetic: JhImportReport["synthetic_phones"] = [];

  const resolved = clients.map((c) => {
    let phone = c.phone;
    const key = `${c.location_code}|${phone}`;
    if (used.has(key)) {
      phone = `IMPORT-${c._source_row}`;
      synthetic.push({ client_key: c.client_key, full_name: c.full_name, phone });
    }
    used.add(`${c.location_code}|${phone}`);
    const { _source_row, ...rest } = c;
    return { ...rest, phone };
  });

  return { clients: resolved, synthetic };
}

export function mergeClientsByName(rows: RawClientRow[]): {
  clients: Array<ParsedClient & { _source_row: number }>;
  merged: JhImportReport["merged_names"];
} {
  const byName = new Map<string, RawClientRow[]>();
  for (const row of rows) {
    const key = normalizeName(row.full_name);
    if (!key) continue;
    const list = byName.get(key) ?? [];
    list.push(row);
    byName.set(key, list);
  }

  const merged: JhImportReport["merged_names"] = [];
  const draft: Array<ParsedClient & { _source_row: number }> = [];

  for (const [clientKey, group] of byName) {
    const sorted = [...group].sort((a, b) => scoreClientRow(b) - scoreClientRow(a));
    const primary = sorted[0];
    const location_code = inferLocationCode(primary);

    let phone: string;
    if (!isBadPhone(primary.phone_raw)) {
      phone = cleanPhoneDigits(primary.phone_raw) ?? "";
    } else {
      phone = cleanPhoneDigits(String(primary.document_id)) ?? "";
    }
    if (!phone) phone = `IMPORT-${primary.source_row}`;

    const mergedRows = sorted.slice(1).map((r) => r.source_row);
    if (mergedRows.length > 0) {
      merged.push({
        client_key: clientKey,
        full_name: primary.full_name.trim(),
        merged_rows: mergedRows,
      });
    }

    const mergedAddresses = sorted.slice(1).map((r) => r.address);
    const email = primary.email.trim() || sorted.find((r) => r.email.trim())?.email.trim() || "";
    const doc = String(primary.document_id ?? "").trim() || null;

    draft.push({
      client_key: clientKey,
      full_name: primary.full_name.trim(),
      phone,
      email: email || null,
      document_id: doc,
      notes: buildNotes(primary.address, mergedAddresses),
      location_code,
      source_rows: sorted.map((r) => r.source_row),
      merged_from: mergedRows.length,
      _source_row: primary.source_row,
    });
  }

  return { clients: draft, merged };
}

export interface RawOrderRow {
  order_date_serial: number;
  client_name: string;
  pedido: string;
  delivered_raw: string;
  next_date_serial: number | null;
  source_row: number;
}

export function parseJhCatalog(
  clientRows: RawClientRow[],
  orderRows: RawOrderRow[]
): { clients: ParsedClient[]; orders: ParsedOrder[]; report: JhImportReport } {
  const { clients: draftClients, merged } = mergeClientsByName(clientRows);
  const { clients, synthetic } = assignPhones(draftClients);
  const clientKeys = new Set(clients.map((c) => c.client_key));

  const orders: ParsedOrder[] = [];
  let ordersOrphan = 0;
  const garmentCounts: Record<string, number> = {};
  const byLocation: JhImportReport["by_location"] = {
    CO: { clients: 0, orders: 0 },
    PA: { clients: 0, orders: 0 },
  };

  for (const c of clients) {
    byLocation[c.location_code].clients++;
  }

  const clientsWithOrders = new Set<string>();

  for (const row of orderRows) {
    const clientKey = normalizeName(row.client_name);
    if (!clientKeys.has(clientKey)) {
      ordersOrphan++;
      continue;
    }

    const client = clients.find((c) => c.client_key === clientKey)!;
    clientsWithOrders.add(clientKey);

    const garmentTypes = parseGarmentTokens(row.pedido);
    for (const gt of garmentTypes) {
      garmentCounts[gt] = (garmentCounts[gt] ?? 0) + 1;
    }

    const items: ParsedOrderItem[] = garmentTypes.map((garment_type) => ({
      garment_type,
      quantity: 1,
      unit_price: 0,
    }));

    orders.push({
      import_source_key: `jh-order-row-${row.source_row}`,
      client_key: clientKey,
      client_name: row.client_name.trim(),
      location_code: client.location_code,
      status: "delivered",
      created_at: excelSerialToIso(row.order_date_serial),
      expected_delivery_date:
        row.next_date_serial != null ? excelSerialToDateString(row.next_date_serial) : null,
      notes: row.pedido.trim(),
      subtotal: 0,
      discount: 0,
      total: 0,
      items,
      source_row: row.source_row,
      pedido_raw: row.pedido.trim(),
    });

    byLocation[client.location_code].orders++;
  }

  const report: JhImportReport = {
    clients_input_rows: clientRows.length,
    clients_parsed: clients.length,
    clients_merged: merged.length,
    clients_without_orders: clients.length - clientsWithOrders.size,
    orders_parsed: orders.length,
    orders_orphan: ordersOrphan,
    synthetic_phones: synthetic,
    merged_names: merged,
    by_location: byLocation,
    garment_type_counts: garmentCounts,
  };

  return { clients, orders, report };
}
