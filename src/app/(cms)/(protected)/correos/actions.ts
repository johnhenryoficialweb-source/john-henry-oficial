"use server";

import { revalidatePath } from "next/cache";
import { requireAdminSession } from "@/lib/auth/roles";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendSystemEmail } from "@/lib/email/send";
import { EMAIL_TEMPLATES, isEmailTemplateKey, type EmailTemplateKey } from "@/lib/email/registry";
import type { WorkshopRecipientRole } from "@/types/database.types";

/**
 * Acciones del módulo de correos.
 *
 * Leer y previsualizar lo puede hacer cualquier miembro del staff —saber qué
 * le llega al cliente es parte de atenderlo—, pero editar los textos y mandar
 * pruebas es de admin: es la voz de la marca y consume créditos de envío.
 */

function assertKey(raw: string): EmailTemplateKey {
  const key = raw.trim();
  if (!isEmailTemplateKey(key)) throw new Error("Plantilla desconocida.");
  return key;
}

/** Campo vacío = volver al texto por defecto de esa línea. */
function optionalText(raw: FormDataEntryValue | null): string | null {
  const value = String(raw ?? "").trim();
  return value.length > 0 ? value : null;
}

export async function saveEmailTemplate(formData: FormData) {
  const session = await requireAdminSession();
  const key = assertKey(String(formData.get("key") ?? ""));
  const admin = createAdminClient();

  const { error } = await admin.from("email_templates").upsert(
    {
      key,
      subject: optionalText(formData.get("subject")),
      heading: optionalText(formData.get("heading")),
      intro: optionalText(formData.get("intro")),
      outro: optionalText(formData.get("outro")),
      cta_label: optionalText(formData.get("ctaLabel")),
      is_enabled: formData.get("isEnabled") !== "false",
      updated_by: session.userId,
    },
    { onConflict: "key" },
  );

  if (error) throw new Error(error.message);

  revalidatePath("/correos");
  revalidatePath(`/correos/${key}`);
}

/** Borra la sobrescritura: la plantilla vuelve a los textos del código. */
export async function resetEmailTemplate(rawKey: string) {
  await requireAdminSession();
  const key = assertKey(rawKey);
  const admin = createAdminClient();

  const { error } = await admin.from("email_templates").delete().eq("key", key);
  if (error) throw new Error(error.message);

  revalidatePath("/correos");
  revalidatePath(`/correos/${key}`);
}

export async function toggleEmailTemplate(rawKey: string, isEnabled: boolean) {
  const session = await requireAdminSession();
  const key = assertKey(rawKey);

  if (!EMAIL_TEMPLATES[key].canDisable && !isEnabled) {
    throw new Error(
      "Este correo no se puede desactivar: quien reservó una cita tiene que enterarse de los cambios.",
    );
  }

  const admin = createAdminClient();
  const { error } = await admin
    .from("email_templates")
    .upsert({ key, is_enabled: isEnabled, updated_by: session.userId }, { onConflict: "key" });

  if (error) throw new Error(error.message);

  revalidatePath("/correos");
  revalidatePath(`/correos/${key}`);
}

/**
 * Envía una plantilla con datos de ejemplo.
 *
 * Usa `force` para saltarse el interruptor de activación: probar una plantilla
 * apagada es exactamente lo que se hace antes de encenderla.
 */
export async function sendTestEmail(rawKey: string, recipient: string) {
  const session = await requireAdminSession();
  const key = assertKey(rawKey);

  const to = recipient.trim();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(to)) {
    throw new Error("Escribe un correo válido para la prueba.");
  }

  const result = await sendSystemEmail({
    templateKey: key,
    to,
    isTest: true,
    force: true,
    triggeredBy: session.userId,
    render: (override) => EMAIL_TEMPLATES[key].renderSample(override),
  });

  revalidatePath("/correos");

  if (!result.ok) {
    throw new Error(result.error ?? "No se pudo enviar el correo de prueba.");
  }

  return { subject: result.subject ?? "" };
}

export interface SystemEmailCheckResult {
  key: EmailTemplateKey;
  name: string;
  ok: boolean;
  error?: string;
}

/**
 * Prueba TODAS las plantillas de una vez contra un mismo destinatario.
 *
 * Es la respuesta a "asegúrate de que todos los correos funcionan": en vez de
 * confiar en que el código compila, manda los nueve y reporta cuál llegó y
 * cuál no. Van en serie a propósito — nueve envíos simultáneos es justo el
 * patrón que hace que Brevo devuelva 429 y que la prueba falle por la prueba
 * misma, no por el sistema.
 */
export async function sendAllTestEmails(recipient: string): Promise<SystemEmailCheckResult[]> {
  const session = await requireAdminSession();

  const to = recipient.trim();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(to)) {
    throw new Error("Escribe un correo válido para la prueba.");
  }

  const results: SystemEmailCheckResult[] = [];

  for (const definition of Object.values(EMAIL_TEMPLATES)) {
    const result = await sendSystemEmail({
      templateKey: definition.key,
      to,
      isTest: true,
      force: true,
      triggeredBy: session.userId,
      render: (override) => definition.renderSample(override),
    });

    results.push({
      key: definition.key,
      name: definition.name,
      ok: result.ok,
      error: result.error,
    });
  }

  revalidatePath("/correos");
  return results;
}

/* -------------------------------------------------------------------------- *
 * Destinatarios de la orden de trabajo
 * -------------------------------------------------------------------------- */

function parseEmail(raw: FormDataEntryValue | null): string {
  const email = String(raw ?? "").trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new Error("Escribe un correo válido.");
  }
  return email;
}

export async function createWorkshopRecipient(formData: FormData) {
  await requireAdminSession();

  const name = String(formData.get("name") ?? "").trim();
  if (!name) throw new Error("Escribe el nombre de quien recibe.");

  const role = String(formData.get("role") ?? "") as WorkshopRecipientRole;
  if (!["tailor", "sales", "fabric_supplier"].includes(role)) {
    throw new Error("Selecciona un rol válido.");
  }

  const locationId = String(formData.get("locationId") ?? "").trim();
  const notes = String(formData.get("notes") ?? "").trim();

  const admin = createAdminClient();
  const { error } = await admin.from("workshop_recipients").insert({
    name,
    email: parseEmail(formData.get("email")),
    role,
    location_id: locationId || null,
    notes: notes || null,
  });

  if (error) {
    throw new Error(
      error.code === "23505"
        ? "Ese correo ya está registrado con ese rol para esa sede."
        : error.message,
    );
  }

  revalidatePath("/correos/destinatarios");
}

export async function toggleWorkshopRecipient(id: string, isActive: boolean) {
  await requireAdminSession();
  const admin = createAdminClient();

  const { error } = await admin
    .from("workshop_recipients")
    .update({ is_active: isActive })
    .eq("id", id);

  if (error) throw new Error(error.message);
  revalidatePath("/correos/destinatarios");
}

export async function deleteWorkshopRecipient(id: string) {
  await requireAdminSession();
  const admin = createAdminClient();

  const { error } = await admin.from("workshop_recipients").delete().eq("id", id);
  if (error) throw new Error(error.message);

  revalidatePath("/correos/destinatarios");
}
