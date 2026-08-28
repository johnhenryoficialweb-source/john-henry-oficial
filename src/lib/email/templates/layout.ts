/**
 * Envoltorio HTML compartido por todas las plantillas de correo.
 *
 * Es superficie de marca — llega al cliente. Por eso usa la paleta bloqueada
 * (navy, oro pálido, marfil) y no el gris/dorado antiguo. Sin blanco puro.
 *
 * El correo no puede cargar Cormorant Garamond ni Cinzel de forma fiable
 * (los clientes de correo no admiten webfonts de manera consistente), así que
 * cae a una serif de sistema: es lo más cercano al registro tipográfico de la
 * marca sin depender de una fuente que no va a llegar.
 *
 * Todo va en tablas y estilos en línea a propósito: Outlook y Gmail siguen sin
 * soportar flexbox, grid ni <style> de forma confiable. Lo que acá parece
 * anticuado es lo único que se ve igual en los dos.
 */

export const BRAND = {
  navy: "#0D1F3C",
  navyDeep: "#081527",
  gold: "#E8D090",
  goldDim: "#C4A55A",
  ivory: "#F5F0E6",
  hairline: "rgba(232,208,144,0.16)",
  muted: "rgba(245,240,230,0.62)",
} as const;

export interface BrandEmailLayoutParams {
  title: string;
  bodyHtml: string;
  /**
   * Texto que los clientes de correo muestran en la lista, junto al asunto.
   * Sin él, Gmail arranca el preview con "JOHN HENRY Sastrería Est. 2004",
   * que es la cabecera y no dice nada del contenido.
   */
  preheader?: string;
  cta?: { label: string; url: string } | null;
}

/** Botón de acción. Tabla y no <a> con padding: Outlook ignora el padding del <a>. */
export function brandEmailButton(label: string, url: string) {
  return `
    <table role="presentation" cellpadding="0" cellspacing="0" style="margin:28px 0 8px 0;">
      <tr>
        <td style="background-color:${BRAND.gold};">
          <a href="${url}" style="display:inline-block;padding:13px 30px;font-family:Georgia,'Times New Roman',serif;font-size:12px;letter-spacing:0.18em;text-transform:uppercase;color:${BRAND.navyDeep};text-decoration:none;">${label}</a>
        </td>
      </tr>
    </table>`;
}

/** Fila etiqueta/valor de los bloques de datos (cita, orden, entrega). */
export function brandEmailRow(label: string, value: string) {
  return `<tr>
    <td style="padding:7px 0;color:${BRAND.gold};font-size:13px;vertical-align:top;width:132px;">${label}</td>
    <td style="padding:7px 0;font-size:14px;vertical-align:top;">${value}</td>
  </tr>`;
}

export function brandEmailLayout(params: BrandEmailLayoutParams) {
  const { title, bodyHtml, preheader, cta } = params;

  return `<!doctype html>
<html lang="es">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <meta name="color-scheme" content="dark" />
    <meta name="supported-color-schemes" content="dark" />
    <title>${title}</title>
  </head>
  <body style="margin:0;padding:0;background-color:${BRAND.navy};font-family:Georgia,'Times New Roman',serif;color:${BRAND.ivory};-webkit-font-smoothing:antialiased;">
    ${
      preheader
        ? `<div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent;height:0;width:0;">${preheader}&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;</div>`
        : ""
    }
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:${BRAND.navy};padding:32px 0;">
      <tr>
        <td align="center">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background-color:${BRAND.navyDeep};border:1px solid ${BRAND.hairline};overflow:hidden;">
            <tr>
              <td style="padding:36px 40px 24px 40px;text-align:center;border-bottom:1px solid ${BRAND.hairline};">
                <p style="margin:0;letter-spacing:0.3em;font-size:14px;color:${BRAND.gold};text-transform:uppercase;">JOHN HENRY</p>
                <p style="margin:8px 0 0 0;letter-spacing:0.28em;font-size:9px;color:${BRAND.goldDim};text-transform:uppercase;">Sastrer&iacute;a &middot; Est. 2004</p>
              </td>
            </tr>
            <tr>
              <td style="padding:32px 40px;font-size:15px;line-height:1.7;color:${BRAND.ivory};">
                ${bodyHtml}
                ${cta ? brandEmailButton(cta.label, cta.url) : ""}
              </td>
            </tr>
            <tr>
              <td style="padding:24px 40px;border-top:1px solid ${BRAND.hairline};text-align:center;">
                <p style="margin:0 0 10px 0;font-size:12px;font-style:italic;color:${BRAND.muted};">Hecho para su cuerpo. Construido para su vida.</p>
                <p style="margin:0;font-size:11px;color:rgba(245,240,230,0.35);">JOHN HENRY &middot; Bogot&aacute; &middot; Ciudad de Panam&aacute;</p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;
}
