import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import type { EmailCopyOverride } from "./copy";
import type { EmailTemplateKey } from "./registry";

/**
 * Sobrescrituras de texto guardadas por el administrador.
 *
 * Se leen con el cliente admin y no con el de sesión porque un correo puede
 * originarse sin usuario autenticado: el formulario público de citas manda la
 * confirmación desde un route handler donde no hay sesión de staff.
 */

export interface EmailTemplateOverride extends EmailCopyOverride {
  key: EmailTemplateKey;
  isEnabled: boolean;
  updatedAt: string | null;
}

function mapRow(row: {
  key: string;
  subject: string | null;
  heading: string | null;
  intro: string | null;
  outro: string | null;
  cta_label: string | null;
  is_enabled: boolean;
  updated_at: string;
}): EmailTemplateOverride {
  return {
    key: row.key as EmailTemplateKey,
    subject: row.subject ?? undefined,
    heading: row.heading ?? undefined,
    intro: row.intro ?? undefined,
    outro: row.outro ?? undefined,
    ctaLabel: row.cta_label ?? undefined,
    isEnabled: row.is_enabled,
    updatedAt: row.updated_at,
  };
}

/** Sobrescritura de UNA plantilla. `null` = usar los textos por defecto. */
export async function getEmailOverride(
  key: EmailTemplateKey,
): Promise<EmailTemplateOverride | null> {
  try {
    const admin = createAdminClient();
    const { data } = await admin
      .from("email_templates")
      .select("key, subject, heading, intro, outro, cta_label, is_enabled, updated_at")
      .eq("key", key)
      .maybeSingle();

    return data ? mapRow(data) : null;
  } catch (error) {
    /*
     * Un fallo leyendo las sobrescrituras no puede impedir el envío: el correo
     * con los textos por defecto es infinitamente mejor que ningún correo. Si
     * la migración 0034 todavía no está aplicada, este catch es justamente lo
     * que mantiene el sistema andando.
     */
    console.error("[email] no se pudieron leer las sobrescrituras de plantilla", error);
    return null;
  }
}

/** Todas las sobrescrituras, indexadas por clave. Para el módulo /correos. */
export async function getAllEmailOverrides(): Promise<
  Partial<Record<EmailTemplateKey, EmailTemplateOverride>>
> {
  try {
    const admin = createAdminClient();
    const { data } = await admin
      .from("email_templates")
      .select("key, subject, heading, intro, outro, cta_label, is_enabled, updated_at");

    const map: Partial<Record<EmailTemplateKey, EmailTemplateOverride>> = {};
    for (const row of data ?? []) {
      map[row.key as EmailTemplateKey] = mapRow(row);
    }
    return map;
  } catch (error) {
    console.error("[email] no se pudieron leer las plantillas", error);
    return {};
  }
}
