import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { brevoSend } from "./brevo";
import { htmlToText, type EmailCopyOverride } from "./copy";
import { getEmailOverride } from "./overrides";
import { EMAIL_TEMPLATES, type EmailTemplateKey } from "./registry";

/**
 * Punto único de salida de correo del sistema.
 *
 * Todo correo pasa por acá, y eso compra tres cosas que antes no existían:
 * los textos editables se aplican solos, cada envío queda en la bitácora
 * (incluidos los fallos, que es lo que de verdad hace falta saber), y una
 * plantilla desactivada deja de enviarse sin tocar el código que la dispara.
 *
 * No lanza nunca. Un correo es un efecto secundario de la operación real
 * —crear la orden, cambiar el estado, agendar la cita—; que Brevo esté caído
 * no puede tumbar la operación que el sastre acaba de hacer. El error se
 * devuelve y se registra, no se propaga.
 */

export interface SendSystemEmailParams {
  templateKey: EmailTemplateKey;
  to: string | null | undefined;
  /** Render de la plantilla. Recibe la sobrescritura ya resuelta. */
  render: (override: EmailCopyOverride | null) => { subject: string; html: string };
  orderId?: string | null;
  appointmentId?: string | null;
  triggeredBy?: string | null;
  isTest?: boolean;
  /** Ignora `is_enabled`. Solo para el envío de prueba del módulo /correos. */
  force?: boolean;
}

export interface SendSystemEmailResult {
  ok: boolean;
  skipped?: boolean;
  error?: string;
  subject?: string;
}

async function logEmail(entry: {
  templateKey: string;
  recipient: string;
  subject: string;
  status: "sent" | "failed" | "skipped";
  error?: string | null;
  providerMessageId?: string | null;
  isTest: boolean;
  orderId?: string | null;
  appointmentId?: string | null;
  triggeredBy?: string | null;
}) {
  try {
    const admin = createAdminClient();
    await admin.from("email_log").insert({
      template_key: entry.templateKey,
      recipient: entry.recipient,
      subject: entry.subject,
      status: entry.status,
      error: entry.error ?? null,
      provider_message_id: entry.providerMessageId ?? null,
      is_test: entry.isTest,
      order_id: entry.orderId ?? null,
      appointment_id: entry.appointmentId ?? null,
      triggered_by: entry.triggeredBy ?? null,
    });
  } catch (error) {
    // La bitácora es observabilidad, no parte del envío: si falla, el correo
    // ya salió y perder el registro no justifica reportar un error al usuario.
    console.error("[email] no se pudo registrar el envío en la bitácora", error);
  }
}

export async function sendSystemEmail(
  params: SendSystemEmailParams,
): Promise<SendSystemEmailResult> {
  const definition = EMAIL_TEMPLATES[params.templateKey];
  const recipient = params.to?.trim();

  if (!recipient) {
    // Sin destinatario no hay nada que registrar: un cliente sin correo es un
    // caso normal en la sastrería, no una falla del sistema.
    return { ok: false, skipped: true, error: "El destinatario no tiene correo." };
  }

  const override = await getEmailOverride(params.templateKey);

  if (!params.force && override && override.isEnabled === false && definition.canDisable) {
    const { subject } = params.render(override);
    await logEmail({
      templateKey: params.templateKey,
      recipient,
      subject,
      status: "skipped",
      error: "Plantilla desactivada desde /correos.",
      isTest: params.isTest ?? false,
      orderId: params.orderId,
      appointmentId: params.appointmentId,
      triggeredBy: params.triggeredBy,
    });
    return { ok: false, skipped: true, subject };
  }

  const { subject, html } = params.render(override);

  const result = await brevoSend({
    to: recipient,
    subject,
    html,
    text: htmlToText(html),
    tags: [params.templateKey, ...(params.isTest ? ["prueba"] : [])],
  });

  await logEmail({
    templateKey: params.templateKey,
    recipient,
    subject,
    status: result.ok ? "sent" : "failed",
    error: result.error,
    providerMessageId: result.messageId,
    isTest: params.isTest ?? false,
    orderId: params.orderId,
    appointmentId: params.appointmentId,
    triggeredBy: params.triggeredBy,
  });

  if (!result.ok) {
    console.error(`[email] fallo al enviar "${params.templateKey}" a ${recipient}: ${result.error}`);
  }

  return { ok: result.ok, error: result.error, subject };
}

/* -------------------------------------------------------------------------- *
 * Lectura de la bitácora — alimenta el módulo /correos
 * -------------------------------------------------------------------------- */

export interface EmailLogEntry {
  id: string;
  templateKey: string;
  recipient: string;
  subject: string;
  status: "sent" | "failed" | "skipped";
  error: string | null;
  isTest: boolean;
  createdAt: string;
}

export async function getEmailLog(limit = 40): Promise<EmailLogEntry[]> {
  try {
    const admin = createAdminClient();
    const { data } = await admin
      .from("email_log")
      .select("id, template_key, recipient, subject, status, error, is_test, created_at")
      .order("created_at", { ascending: false })
      .limit(limit);

    return (data ?? []).map((row) => ({
      id: row.id,
      templateKey: row.template_key,
      recipient: row.recipient,
      subject: row.subject,
      status: row.status,
      error: row.error,
      isTest: row.is_test,
      createdAt: row.created_at,
    }));
  } catch (error) {
    console.error("[email] no se pudo leer la bitácora", error);
    return [];
  }
}

export interface EmailTemplateActivity {
  lastSentAt: string | null;
  lastFailedAt: string | null;
  lastError: string | null;
  sentCount: number;
  failedCount: number;
}

/**
 * Actividad reciente por plantilla.
 *
 * Es lo que convierte el listado de /correos en algo que responde la pregunta
 * real del administrador —"¿esto está funcionando?"— en vez de solo mostrar
 * qué plantillas existen.
 */
export async function getEmailActivityByTemplate(): Promise<
  Partial<Record<string, EmailTemplateActivity>>
> {
  try {
    const admin = createAdminClient();
    const { data } = await admin
      .from("email_log")
      .select("template_key, status, error, created_at, is_test")
      .eq("is_test", false)
      .order("created_at", { ascending: false })
      .limit(500);

    const map: Partial<Record<string, EmailTemplateActivity>> = {};
    for (const row of data ?? []) {
      const entry = (map[row.template_key] ??= {
        lastSentAt: null,
        lastFailedAt: null,
        lastError: null,
        sentCount: 0,
        failedCount: 0,
      });

      if (row.status === "sent") {
        entry.sentCount += 1;
        entry.lastSentAt ??= row.created_at;
      } else if (row.status === "failed") {
        entry.failedCount += 1;
        if (!entry.lastFailedAt) {
          entry.lastFailedAt = row.created_at;
          entry.lastError = row.error;
        }
      }
    }

    // Un fallo viejo (p. ej. antes de configurar BREVO_API_KEY) no debe tapar un
    // envío exitoso posterior: solo mostramos el error si el último intento falló.
    for (const entry of Object.values(map)) {
      // `map` es Partial<Record<…>>: TypeScript no sabe que solo se escribieron
      // claves con valor.
      if (!entry) continue;
      if (
        entry.lastSentAt &&
        (!entry.lastFailedAt || entry.lastSentAt >= entry.lastFailedAt)
      ) {
        entry.lastError = null;
      }
    }

    return map;
  } catch (error) {
    console.error("[email] no se pudo leer la actividad", error);
    return {};
  }
}
