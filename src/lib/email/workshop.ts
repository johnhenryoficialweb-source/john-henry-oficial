import "server-only";
import { sendSystemEmail } from "./send";
import { siteUrl } from "./links";
import { workshopOrderEmail } from "./templates/workshop";
import { getWorkshopOrder, getWorkshopRecipients } from "@/lib/orders/workshop-order";
import { WORKSHOP_ROLE_LABELS } from "@/lib/orders/workshop-labels";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Envío de la orden de trabajo al taller.
 *
 * Los destinatarios se arman de dos fuentes distintas y por razones distintas:
 *
 *   - El sastre y el proveedor de tela salen de `workshop_recipients`, porque
 *     son gente fija que el admin configura una vez.
 *   - El vendedor sale de la orden misma (`created_by`), porque no es un cargo
 *     sino una persona concreta: quien atendió a ESE cliente es quien tiene
 *     que responder si el taller pregunta algo. Mandárselo a "el vendedor"
 *     configurado en una tabla haría que las preguntas cayeran siempre en el
 *     mismo buzón, que casi nunca es el correcto.
 *
 * Cada destinatario recibe SU propio correo, no una copia con todos en el
 * mismo `to`. Cuesta un envío más por persona y evita que el correo del sastre
 * quede a la vista del proveedor de tela, que es un tercero.
 */

export interface WorkshopSendResult {
  sent: number;
  failed: number;
  recipients: Array<{ email: string; roleLabel: string; ok: boolean; error?: string }>;
}

export async function sendWorkshopOrderEmails(params: {
  orderId: string;
  locationId: string | null;
  triggeredBy?: string | null;
  /** Ignora el interruptor de la plantilla. Para el reenvío manual. */
  force?: boolean;
}): Promise<WorkshopSendResult> {
  const result: WorkshopSendResult = { sent: 0, failed: 0, recipients: [] };

  const order = await getWorkshopOrder(params.orderId);
  if (!order) return result;

  const configured = await getWorkshopRecipients({ locationId: params.locationId });

  const targets = configured.map((recipient) => ({
    email: recipient.email,
    roleLabel: WORKSHOP_ROLE_LABELS[recipient.role],
  }));

  // El vendedor: quien registró la orden.
  const seller = await getOrderSeller(params.orderId);
  if (seller) {
    targets.push({ email: seller, roleLabel: WORKSHOP_ROLE_LABELS.sales });
  }

  // Una persona puede estar configurada como sastre Y ser quien vendió; el
  // documento es el mismo, así que se envía una sola vez.
  const deduped = new Map<string, { email: string; roleLabel: string }>();
  for (const target of targets) {
    const key = target.email.trim().toLowerCase();
    if (key && !deduped.has(key)) deduped.set(key, target);
  }

  const printUrl = `${siteUrl()}/orders/${params.orderId}/orden-taller`;

  for (const target of deduped.values()) {
    const outcome = await sendSystemEmail({
      templateKey: "workshop_order",
      to: target.email,
      orderId: params.orderId,
      triggeredBy: params.triggeredBy,
      force: params.force,
      render: (override) =>
        workshopOrderEmail(
          { ...order, recipientRoleLabel: target.roleLabel },
          override,
          { printUrl },
        ),
    });

    if (outcome.ok) result.sent += 1;
    else result.failed += 1;

    result.recipients.push({
      email: target.email,
      roleLabel: target.roleLabel,
      ok: outcome.ok,
      error: outcome.error,
    });
  }

  return result;
}

async function getOrderSeller(orderId: string): Promise<string | null> {
  try {
    const admin = createAdminClient();
    const { data } = await admin
      .from("orders")
      .select("created_by, assigned_staff_id")
      .eq("id", orderId)
      .single();

    // `assigned_staff_id` manda sobre `created_by`: si la orden se le asignó a
    // alguien, esa persona es la que la está atendiendo, aunque la haya
    // registrado otra.
    const staffId = data?.assigned_staff_id ?? data?.created_by;
    if (!staffId) return null;

    const { data: staff } = await admin
      .from("staff_users")
      .select("email, is_active")
      .eq("id", staffId)
      .single();

    return staff?.is_active ? (staff.email ?? null) : null;
  } catch (error) {
    console.error("[workshop] no se pudo resolver el vendedor de la orden", error);
    return null;
  }
}
