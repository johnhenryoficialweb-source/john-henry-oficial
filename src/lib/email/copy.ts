/**
 * Textos editables de los correos.
 *
 * La plantilla se parte en dos: la estructura (tablas de datos, totales,
 * listas de prendas, el envoltorio de marca) vive en código, y la prosa
 * (asunto, saludo, párrafo de apertura, cierre, etiqueta del botón) vive acá
 * como texto con `{{variables}}` que el administrador puede editar desde
 * /correos sin poder romper el HTML.
 *
 * Esa frontera es deliberada: dejar que se edite el HTML completo convierte
 * cada corrección de copy en un riesgo de romper el correo en Outlook, y
 * bloquear todo obliga a pedir un despliegue para cambiar una coma.
 */

/** Escapa datos de cliente antes de meterlos en el HTML del correo. */
export function esc(value: string | number | null | undefined): string {
  if (value === null || value === undefined) return "";
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/** Convierte saltos de línea en <br/> tras escapar. Para notas libres. */
export function escMultiline(value: string | null | undefined): string {
  return esc(value).replace(/\r?\n/g, "<br/>");
}

export interface EmailCopy {
  subject: string;
  heading: string;
  intro: string;
  outro: string;
  ctaLabel?: string;
}

export type EmailCopyOverride = Partial<EmailCopy>;

/**
 * Reemplaza `{{variable}}` por su valor.
 *
 * Los valores llegan ya escapados por quien construye el mapa; acá no se
 * escapa de nuevo para no convertir `&amp;` en `&amp;amp;`. Una variable que
 * no exista se reemplaza por vacío en vez de dejar `{{...}}` visible en el
 * correo del cliente: un hueco es feo, pero `{{clientName}}` en un correo de
 * la sastrería es peor.
 */
export function interpolate(template: string, vars: Record<string, string>): string {
  return template.replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (_match, key: string) => vars[key] ?? "");
}

/** Une la copy por defecto de la plantilla con lo que el admin haya editado. */
export function resolveCopy(base: EmailCopy, override?: EmailCopyOverride | null): EmailCopy {
  if (!override) return base;
  return {
    subject: override.subject?.trim() || base.subject,
    heading: override.heading?.trim() || base.heading,
    intro: override.intro?.trim() || base.intro,
    outro: override.outro?.trim() || base.outro,
    ctaLabel: override.ctaLabel?.trim() || base.ctaLabel,
  };
}

/** Párrafo estándar del cuerpo, ya con el ritmo tipográfico de la marca. */
export function paragraph(html: string, style = "") {
  if (!html) return "";
  return `<p style="margin:0 0 18px 0;${style}">${html}</p>`;
}

/** Deriva un texto plano legible del HTML, para clientes que no rendericen. */
export function htmlToText(html: string): string {
  return html
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<head[\s\S]*?<\/head>/gi, "")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(p|tr|div|li|h1|h2|h3)>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&[a-z]+;/gi, "")
    .replace(/\n{3,}/g, "\n\n")
    .split("\n")
    .map((line) => line.trim())
    .join("\n")
    .trim();
}
