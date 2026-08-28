"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireAdminSession, requireStaffSession } from "@/lib/auth/roles";
import { createClient } from "@/lib/supabase/server";
import { revalidateClientOrderPaths } from "@/lib/clients/revalidate-orders";

export interface CreateClientInput {
  fullName: string;
  phone: string;
  email?: string;
  homeLocationId: string;
  /**
   * Documento de identificación (cédula, pasaporte). Opcional a propósito: es
   * el identificador estable de una persona —un teléfono cambia, un nombre se
   * escribe de tres formas distintas, la cédula no— pero exigirlo frenaría el
   * registro en mostrador, que es donde el dato muchas veces todavía no está.
   */
  documentId?: string;
  notes?: string;
}

/**
 * Deja la cédula en solo dígitos y letras, sin puntos ni espacios.
 *
 * "1.020.304" y "1020304" son la misma persona, y guardarlos distinto rompe
 * justamente lo que la cédula viene a resolver: poder encontrar al cliente sin
 * depender de cómo se escribió el nombre.
 */
function normalizeDocumentId(raw: string | undefined): string | null {
  const cleaned = (raw ?? "").replace(/[^\p{L}\p{N}]/gu, "").toUpperCase();
  return cleaned || null;
}

/**
 * Código de violación de unicidad de Postgres. Ver `assertDocumentIsFree`.
 */
const UNIQUE_VIOLATION = "23505";

/**
 * Bloquea guardar una cédula que ya tiene otro cliente.
 *
 * Corre antes del insert/update para poder decir CON QUIÉN choca — "Esta cédula
 * ya es de Juan Felipe Ardila" manda a resolverlo; un error de base de datos
 * solo manda a intentar de nuevo. El índice único de 0037 es la garantía real:
 * esta función es la que la hace explicable.
 *
 * No la reemplaza, por dos razones. Entre la consulta y el insert cabe otro
 * registro con la misma cédula, y sobre todo RLS: un asesor de Bogotá no ve a
 * los clientes de Panamá (política `clients_select` en 0015), así que este
 * chequeo es ciego a un choque en la otra sede. Ese caso lo ataja la base y se
 * traduce en `describeDocumentConflict` sin revelar de quién es la ficha ajena.
 */
async function assertDocumentIsFree(
  supabase: Awaited<ReturnType<typeof createClient>>,
  documentId: string | null,
  excludeClientId?: string
) {
  if (!documentId) return;

  let query = supabase
    .from("clients")
    .select("id, full_name")
    .eq("document_id", documentId)
    .is("deleted_at", null)
    .limit(1);

  if (excludeClientId) query = query.neq("id", excludeClientId);

  const { data: existing } = await query;
  const clash = existing?.[0];
  if (!clash) return;

  throw new Error(
    `La cédula ${documentId} ya está registrada a nombre de ${clash.full_name}. ` +
      `Si es la misma persona, usa esa ficha en vez de crear una nueva; si no, revisa el documento.`
  );
}

/**
 * Traduce el choque que solo detectó la base (típicamente, la otra sede).
 *
 * No nombra al cliente en conflicto a propósito: si RLS no dejó verlo, el
 * mensaje de error tampoco debería filtrarlo.
 */
function describeDocumentConflict(error: { code?: string; message?: string }, documentId: string | null) {
  const isDocumentClash =
    error.code === UNIQUE_VIOLATION && (error.message ?? "").includes("clients_document_id");

  if (!isDocumentClash) return null;

  return new Error(
    `La cédula ${documentId ?? ""} ya está registrada en otro cliente, posiblemente en la otra sede. ` +
      `Pídele a un administrador que verifique antes de volver a intentarlo.`
  );
}

/**
 * Inserta el cliente sin redirigir — la usa tanto /clients/nuevo (via
 * createClientRecord) como el paso 1 del asistente de "Nueva orden"
 * (new-order-wizard.tsx), que necesita el id creado para seguir al paso 2
 * sin abandonar el flujo.
 */
export async function createClientInline(input: CreateClientInput) {
  const session = await requireStaffSession();
  const supabase = await createClient();

  const fullName = input.fullName.trim();
  const phone = input.phone.trim();
  const email = (input.email ?? "").trim();
  const notes = (input.notes ?? "").trim();
  const documentId = normalizeDocumentId(input.documentId);

  if (!fullName || !phone || !input.homeLocationId) {
    throw new Error("Nombre, teléfono y sede son obligatorios.");
  }

  await assertDocumentIsFree(supabase, documentId);

  const { data: client, error } = await supabase
    .from("clients")
    .insert({
      full_name: fullName,
      phone,
      email: email || null,
      document_id: documentId,
      home_location_id: input.homeLocationId,
      notes: notes || null,
      created_by: session.userId,
    })
    .select("id, full_name, phone, home_location_id, locations(code)")
    .single();

  if (error || !client) {
    throw describeDocumentConflict(error ?? {}, documentId) ??
      new Error(error?.message ?? "No se pudo crear el cliente.");
  }

  const location = client.locations as { code: string } | null;
  revalidatePath("/clients");
  return {
    id: client.id,
    full_name: client.full_name,
    phone: client.phone,
    home_location_id: client.home_location_id,
    location_code: location?.code ?? null,
  };
}

export async function updateClient(clientId: string, input: CreateClientInput) {
  await requireStaffSession();
  const supabase = await createClient();

  const fullName = input.fullName.trim();
  const phone = input.phone.trim();
  const email = (input.email ?? "").trim();
  const notes = (input.notes ?? "").trim();
  const documentId = normalizeDocumentId(input.documentId);

  if (!fullName || !phone || !input.homeLocationId) {
    throw new Error("Nombre, teléfono y sede son obligatorios.");
  }

  await assertDocumentIsFree(supabase, documentId, clientId);

  const { error } = await supabase
    .from("clients")
    .update({
      full_name: fullName,
      phone,
      email: email || null,
      document_id: documentId,
      home_location_id: input.homeLocationId,
      notes: notes || null,
    })
    .eq("id", clientId);

  if (error) {
    throw describeDocumentConflict(error, documentId) ??
      new Error(error.message ?? "No se pudo actualizar el cliente.");
  }

  revalidatePath("/clients");
  revalidatePath(`/clients/${clientId}`);
  await revalidateClientOrderPaths(clientId);
}

import { GARMENT_MEASUREMENT_FIELDS } from "@/lib/constants";
import type { GarmentType, MeasurementUnit } from "@/types/database.types";

export async function saveClientGarmentMeasurement(
  clientId: string,
  garmentType: GarmentType,
  values: Record<string, number>,
  unit: MeasurementUnit = "cm"
) {
  const session = await requireStaffSession();
  const supabase = await createClient();

  const fields = GARMENT_MEASUREMENT_FIELDS[garmentType];
  const cleaned = Object.fromEntries(
    fields.map((field) => [field, Math.max(0, Number(values[field]) || 0)])
  ) as Record<string, number>;

  const hasAny = fields.some((field) => cleaned[field] > 0);
  if (!hasAny) {
    throw new Error("Ingresa al menos una medida antes de guardar.");
  }

  const { error } = await supabase.from("client_measurements").insert({
    client_id: clientId,
    garment_type: garmentType,
    values: cleaned,
    unit,
    source: "profile",
    taken_by: session.userId,
  });

  if (error) {
    throw new Error(error.message ?? "No se pudieron guardar las medidas.");
  }

  revalidatePath(`/clients/${clientId}`);
  revalidatePath(`/clients/${clientId}/medidas`);
  await revalidateClientOrderPaths(clientId);
}

export async function createClientRecord(formData: FormData) {
  const client = await createClientInline({
    fullName: String(formData.get("fullName") ?? ""),
    phone: String(formData.get("phone") ?? ""),
    email: String(formData.get("email") ?? ""),
    documentId: String(formData.get("documentId") ?? ""),
    homeLocationId: String(formData.get("homeLocationId") ?? ""),
    notes: String(formData.get("notes") ?? ""),
  });

  redirect(`/clients/${client.id}`);
}

export interface ClientDeletionBlockers {
  fullName: string;
  ordersCount: number;
  appointmentsCount: number;
}

export async function getClientDeletionBlockers(
  clientId: string
): Promise<ClientDeletionBlockers> {
  await requireAdminSession();
  const supabase = await createClient();

  const [{ data: client }, { count: ordersCount }, { count: appointmentsCount }] =
    await Promise.all([
      supabase.from("clients").select("full_name, deleted_at").eq("id", clientId).single(),
      supabase
        .from("orders")
        .select("id", { count: "exact", head: true })
        .eq("client_id", clientId),
      supabase
        .from("appointments")
        .select("id", { count: "exact", head: true })
        .eq("client_id", clientId),
    ]);

  if (!client || client.deleted_at) {
    throw new Error("Cliente no encontrado.");
  }

  return {
    fullName: client.full_name,
    ordersCount: ordersCount ?? 0,
    appointmentsCount: appointmentsCount ?? 0,
  };
}

/** Mueve el cliente a la papelera (borrado lógico). */
export async function deleteClient(clientId: string) {
  const session = await requireAdminSession();
  const supabase = await createClient();

  const blockers = await getClientDeletionBlockers(clientId);

  const { error } = await supabase
    .from("clients")
    .update({
      deleted_at: new Date().toISOString(),
      deleted_by: session.userId,
    })
    .eq("id", clientId)
    .is("deleted_at", null);

  if (error) {
    throw new Error(error.message ?? "No se pudo mover el cliente a la papelera.");
  }

  revalidatePath("/clients");
  revalidatePath("/clients/papelera");
  revalidatePath(`/clients/${clientId}`);

  return blockers.fullName;
}

/** Restaura un cliente desde la papelera. */
export async function restoreClient(clientId: string) {
  await requireAdminSession();
  const supabase = await createClient();

  const { data: client, error: fetchError } = await supabase
    .from("clients")
    .select("id, full_name, deleted_at, document_id")
    .eq("id", clientId)
    .single();

  if (fetchError || !client) {
    throw new Error("Cliente no encontrado.");
  }

  if (!client.deleted_at) {
    throw new Error("Este cliente no está en la papelera.");
  }

  /*
   * Mientras esta ficha estuvo en la papelera, su cédula quedó libre y otra
   * ficha pudo tomarla — el índice único de 0037 solo cubre clientes activos.
   * Restaurar sin avisar fallaría contra la base con un error ilegible; peor,
   * restaurar "a la fuerza" dejaría dos fichas activas de la misma persona, que
   * es justo lo que la cédula única viene a impedir.
   */
  if (client.document_id) {
    const { data: clash } = await supabase
      .from("clients")
      .select("id, full_name")
      .eq("document_id", client.document_id)
      .is("deleted_at", null)
      .neq("id", clientId)
      .limit(1);

    if (clash?.[0]) {
      throw new Error(
        `No se puede restaurar: mientras estaba en la papelera, la cédula ${client.document_id} ` +
          `quedó registrada en ${clash[0].full_name}. Decide cuál ficha se queda con el documento antes de restaurar.`
      );
    }
  }

  const { error } = await supabase
    .from("clients")
    .update({
      deleted_at: null,
      deleted_by: null,
    })
    .eq("id", clientId);

  if (error) {
    if (error.code === "23505") {
      throw new Error(
        "No se puede restaurar: ya existe un cliente activo con el mismo teléfono en esta sede."
      );
    }
    throw new Error(error.message ?? "No se pudo restaurar el cliente.");
  }

  revalidatePath("/clients");
  revalidatePath("/clients/papelera");
  revalidatePath(`/clients/${clientId}`);

  return client.full_name;
}

export interface DocumentOwner {
  id: string;
  fullName: string;
}

/**
 * Quién tiene ya esta cédula, si alguien la tiene.
 *
 * Alimenta el aviso en vivo del formulario. La validación de verdad vive en
 * `assertDocumentIsFree` y en el índice único de 0037 — esto es solo para no
 * hacer al usuario llenar el formulario completo antes de enterarse de que la
 * persona ya está registrada.
 *
 * Devuelve null cuando no hay choque visible. Ojo: "visible" es literal — RLS
 * limita al asesor a su sede, así que un duplicado en la otra sede no se ve
 * aquí y solo lo ataja la base al guardar.
 */
export async function findClientByDocument(
  rawDocumentId: string,
  excludeClientId?: string
): Promise<DocumentOwner | null> {
  await requireStaffSession();

  const documentId = normalizeDocumentId(rawDocumentId);
  if (!documentId) return null;

  const supabase = await createClient();

  let query = supabase
    .from("clients")
    .select("id, full_name")
    .eq("document_id", documentId)
    .is("deleted_at", null)
    .limit(1);

  if (excludeClientId) query = query.neq("id", excludeClientId);

  const { data } = await query;
  const owner = data?.[0];
  return owner ? { id: owner.id, fullName: owner.full_name } : null;
}
