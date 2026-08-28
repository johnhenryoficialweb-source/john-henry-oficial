import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  GARMENT_MEASUREMENT_FIELDS,
  GARMENT_TYPE_LABELS,
  ORDER_STATUS_LABELS,
  getMeasurementFieldLabel,
} from "@/lib/constants";
import type { GarmentType, MeasurementUnit } from "@/types/database.types";
import type { WorkshopGarment, WorkshopOrder, WorkshopRecipient } from "./workshop-labels";

export * from "./workshop-labels";

/**
 * La orden de trabajo: el documento con el que el sastre corta.
 *
 * Es deliberadamente POBRE en datos del cliente. Lleva su nombre y nada más:
 * ni teléfono, ni cédula, ni correo, ni dirección. El documento sale por
 * correo a terceros —el taller, y en adelante quien vende la tela— y se
 * imprime para quedar sobre una mesa de corte; cada dato de contacto que
 * viajara ahí sería un dato del cliente circulando fuera del sistema sin que
 * nadie lo necesite para coser.
 *
 * Tampoco lleva precios. El sastre no negocia el valor de la prenda y el
 * proveedor de tela no tiene por qué saber a cuánto se vendió: lo que ambos
 * necesitan es qué prenda, en qué tela, con qué especificación y con qué
 * medidas.
 */

function formatDate(value: string | null | undefined): string | null {
  if (!value) return null;
  const date = new Date(value.length <= 10 ? `${value}T12:00:00` : value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toLocaleDateString("es-CO", { day: "2-digit", month: "long", year: "numeric" });
}

/**
 * Ordena las medidas como las canta el sastre, no como caigan del JSON.
 *
 * `GARMENT_MEASUREMENT_FIELDS` conserva el orden de la ficha en papel, y ese
 * orden es memoria muscular para quien lleva veinte años tomando medidas.
 * Cualquier campo que no esté en la convención —una medida vieja de un import,
 * algo que agregue el digitalizador— se anexa al final en vez de perderse.
 */
function orderMeasurements(
  garmentType: GarmentType,
  values: Record<string, unknown>,
): Array<{ label: string; value: string }> {
  const canonical = GARMENT_MEASUREMENT_FIELDS[garmentType] ?? [];
  const seen = new Set<string>();
  const rows: Array<{ label: string; value: string }> = [];

  const push = (field: string) => {
    if (seen.has(field)) return;
    seen.add(field);
    const raw = values[field];
    if (raw === null || raw === undefined || raw === "") return;
    rows.push({ label: getMeasurementFieldLabel(garmentType, field), value: String(raw) });
  };

  canonical.forEach(push);
  Object.keys(values).forEach(push);

  return rows;
}

export async function getWorkshopOrder(orderId: string): Promise<WorkshopOrder | null> {
  const admin = createAdminClient();

  const { data: order } = await admin
    .from("orders")
    .select(
      "id, order_number, status, notes, created_at, expected_delivery_date, client_id, clients(full_name), locations(name, phone)",
    )
    .eq("id", orderId)
    .single();

  if (!order) return null;

  const client = order.clients as unknown as { full_name: string } | null;
  const location = order.locations as unknown as { name: string; phone: string | null } | null;

  const { data: items } = await admin
    .from("order_items")
    .select(
      "id, garment_type, quantity, notes, fabrics(name, code, composition, supplier), garment_models(name), client_measurements(values, unit)",
    )
    .eq("order_id", orderId)
    .order("created_at");

  /*
   * La fecha de prueba no vive en la orden: vive en la agenda. Se busca la
   * próxima cita de tipo "prueba" del cliente porque es el dato que el sastre
   * usa para priorizar la mesa —una prenda que se prueba el jueves va antes
   * que una que se entrega en tres semanas—. Si no hay cita agendada, la fila
   * simplemente no aparece en el documento.
   */
  const { data: fitting } = await admin
    .from("appointments")
    .select("starts_at")
    .eq("client_id", order.client_id)
    .eq("appointment_type", "prueba")
    .neq("status", "cancelled")
    .gte("starts_at", new Date().toISOString())
    .order("starts_at", { ascending: true })
    .limit(1);

  const garments: WorkshopGarment[] = (items ?? []).map((item) => {
    const fabric = item.fabrics as unknown as {
      name: string;
      code: string | null;
      composition: string | null;
      supplier: string | null;
    } | null;
    const model = item.garment_models as unknown as { name: string } | null;
    const measurement = item.client_measurements as unknown as {
      values: Record<string, unknown>;
      unit: MeasurementUnit;
    } | null;

    return {
      id: item.id,
      garmentType: item.garment_type,
      label: GARMENT_TYPE_LABELS[item.garment_type],
      quantity: item.quantity,
      fabricName: fabric?.name ?? null,
      fabricCode: fabric?.code ?? null,
      fabricComposition: fabric?.composition ?? null,
      fabricSupplier: fabric?.supplier ?? null,
      modelName: model?.name ?? null,
      measurements: orderMeasurements(item.garment_type, measurement?.values ?? {}),
      measurementUnit: measurement?.unit ?? "cm",
      spec: item.notes,
    };
  });

  return {
    orderId: order.id,
    orderNumber: order.order_number ?? order.id,
    status: order.status,
    statusLabel: ORDER_STATUS_LABELS[order.status],
    clientName: client?.full_name ?? "Cliente",
    locationName: location?.name ?? "",
    locationPhone: location?.phone ?? null,
    createdAtLabel: formatDate(order.created_at) ?? "",
    expectedDeliveryLabel: formatDate(order.expected_delivery_date),
    fittingDateLabel: formatDate(fitting?.[0]?.starts_at ?? null),
    notes: order.notes,
    garments,
  };
}

/* -------------------------------------------------------------------------- *
 * Destinatarios
 * -------------------------------------------------------------------------- */

export async function getWorkshopRecipients(options?: {
  locationId?: string | null;
  includeInactive?: boolean;
}): Promise<WorkshopRecipient[]> {
  try {
    const admin = createAdminClient();
    let query = admin
      .from("workshop_recipients")
      .select("id, location_id, role, name, email, notes, is_active")
      .order("role")
      .order("name");

    if (!options?.includeInactive) query = query.eq("is_active", true);

    const { data } = await query;

    const rows = (data ?? []).map((row) => ({
      id: row.id,
      locationId: row.location_id,
      role: row.role,
      name: row.name,
      email: row.email,
      notes: row.notes,
      isActive: row.is_active,
    }));

    // El filtro por sede se hace acá y no en la consulta porque un
    // destinatario con location_id null recibe las órdenes de TODAS las sedes,
    // y eso en PostgREST exigiría un `or(...)` que oscurece la intención.
    if (options?.locationId === undefined) return rows;
    return rows.filter(
      (row) => row.locationId === null || row.locationId === options.locationId,
    );
  } catch (error) {
    console.error("[workshop] no se pudieron leer los destinatarios", error);
    return [];
  }
}
