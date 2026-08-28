import {
  esc,
  escMultiline,
  interpolate,
  resolveCopy,
  type EmailCopy,
  type EmailCopyOverride,
} from "../copy";

/**
 * Orden de trabajo — el documento del taller.
 *
 * No usa `brandEmailLayout`. El resto de los correos van sobre navy porque son
 * superficie de marca y se leen en pantalla; este se imprime y se deja sobre
 * una mesa de corte, y un fondo azul oscuro a página completa es tinta que el
 * taller paga y un documento que se vuelve ilegible en cuanto la impresora
 * decide ahorrar tóner. Así que va al revés: papel claro, tinta oscura, filetes
 * en oro apagado. La marca aparece en la cabecera y en las reglas, no en el
 * fondo.
 *
 * El oro tampoco es el mismo: `#E8D090` es legible sobre navy y desaparece
 * sobre papel. Acá se usa un oro más profundo, que mantiene el registro de la
 * marca y sobrevive a una impresión en blanco y negro.
 */

const PAPER = {
  bg: "#F4F1EA",
  sheet: "#FFFFFF",
  ink: "#1C1B18",
  inkSoft: "#5A564C",
  inkFaint: "#8A857A",
  gold: "#8A6D2F",
  rule: "#DDD7C9",
} as const;

export interface WorkshopEmailGarment {
  label: string;
  quantity: number;
  fabricName: string | null;
  fabricCode: string | null;
  fabricComposition: string | null;
  fabricSupplier: string | null;
  modelName: string | null;
  measurements: Array<{ label: string; value: string }>;
  measurementUnit: string;
  spec: string | null;
}

export interface WorkshopOrderEmailData {
  orderNumber: string;
  statusLabel: string;
  clientName: string;
  locationName: string;
  locationPhone: string | null;
  createdAtLabel: string;
  expectedDeliveryLabel: string | null;
  fittingDateLabel: string | null;
  notes: string | null;
  garments: WorkshopEmailGarment[];
  /** Rol de quien recibe, para encabezar el correo ("Sastre", "Vendedor"…). */
  recipientRoleLabel?: string | null;
}

export const WORKSHOP_ORDER_COPY: EmailCopy = {
  subject: "Orden de trabajo {{orderNumber}} — {{clientName}}",
  heading: "Orden de trabajo {{orderNumber}}",
  intro:
    "Adjunto el detalle de confección de la orden <strong>{{orderNumber}}</strong> ({{statusLabel}}), registrada en {{locationName}}.",
  outro:
    "Este documento no incluye datos de contacto del cliente ni valores. Para cualquier aclaración sobre la orden, responde este correo.",
  ctaLabel: "Abrir versión para imprimir",
};

/** Medidas en rejilla de tres columnas, como la ficha en papel. */
function measurementGrid(garment: WorkshopEmailGarment) {
  if (garment.measurements.length === 0) {
    return `<p style="margin:0;font-size:13px;color:${PAPER.inkFaint};font-style:italic;">Sin medidas registradas para esta prenda.</p>`;
  }

  const rows: string[] = [];
  for (let index = 0; index < garment.measurements.length; index += 3) {
    const cells = garment.measurements.slice(index, index + 3);
    // Se rellena la última fila para que las celdas conserven el ancho: sin
    // esto, una fila de una sola medida la estira a todo lo ancho de la tabla.
    while (cells.length < 3) cells.push({ label: "", value: "" });

    rows.push(
      `<tr>${cells
        .map((cell) =>
          cell.label
            ? `<td style="width:33.33%;padding:8px 10px;border:1px solid ${PAPER.rule};">
                 <span style="display:block;font-size:10px;letter-spacing:0.08em;text-transform:uppercase;color:${PAPER.inkFaint};">${esc(cell.label)}</span>
                 <span style="display:block;font-size:16px;color:${PAPER.ink};">${esc(cell.value)}</span>
               </td>`
            : `<td style="width:33.33%;border:1px solid ${PAPER.rule};"></td>`,
        )
        .join("")}</tr>`,
    );
  }

  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;">
    ${rows.join("")}
  </table>`;
}

function garmentBlock(garment: WorkshopEmailGarment, unitLabel: string) {
  const fabricLine = [garment.fabricName, garment.fabricCode ? `Cód. ${garment.fabricCode}` : null]
    .filter(Boolean)
    .join(" · ");
  const fabricDetail = [garment.fabricComposition, garment.fabricSupplier]
    .filter(Boolean)
    .join(" · ");

  return `
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 26px 0;border:1px solid ${PAPER.rule};background-color:${PAPER.sheet};">
    <tr>
      <td style="padding:16px 20px;border-bottom:2px solid ${PAPER.gold};">
        <span style="font-size:10px;letter-spacing:0.2em;text-transform:uppercase;color:${PAPER.inkFaint};">Prenda</span>
        <div style="font-size:20px;letter-spacing:0.06em;text-transform:uppercase;color:${PAPER.ink};">
          ${esc(garment.label)}${garment.quantity > 1 ? ` <span style="font-size:14px;color:${PAPER.gold};">&times;${garment.quantity}</span>` : ""}
        </div>
      </td>
    </tr>

    ${
      fabricLine || garment.modelName
        ? `<tr>
            <td style="padding:14px 20px;border-bottom:1px solid ${PAPER.rule};">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                ${
                  fabricLine
                    ? `<tr>
                        <td style="width:80px;font-size:11px;letter-spacing:0.08em;text-transform:uppercase;color:${PAPER.inkFaint};vertical-align:top;padding:2px 0;">Tela</td>
                        <td style="font-size:14px;color:${PAPER.ink};padding:2px 0;">${esc(fabricLine)}${fabricDetail ? `<br/><span style="font-size:12px;color:${PAPER.inkSoft};">${esc(fabricDetail)}</span>` : ""}</td>
                      </tr>`
                    : ""
                }
                ${
                  garment.modelName
                    ? `<tr>
                        <td style="width:80px;font-size:11px;letter-spacing:0.08em;text-transform:uppercase;color:${PAPER.inkFaint};vertical-align:top;padding:2px 0;">Modelo</td>
                        <td style="font-size:14px;color:${PAPER.ink};padding:2px 0;">${esc(garment.modelName)}</td>
                      </tr>`
                    : ""
                }
              </table>
            </td>
          </tr>`
        : ""
    }

    <tr>
      <td style="padding:16px 20px 6px 20px;">
        <span style="font-size:11px;letter-spacing:0.18em;text-transform:uppercase;color:${PAPER.gold};">Medidas (${esc(unitLabel)})</span>
      </td>
    </tr>
    <tr><td style="padding:0 20px 16px 20px;">${measurementGrid(garment)}</td></tr>

    ${
      garment.spec
        ? `<tr>
            <td style="padding:0 20px 20px 20px;">
              <span style="display:block;margin-bottom:6px;font-size:11px;letter-spacing:0.18em;text-transform:uppercase;color:${PAPER.gold};">Pedido</span>
              <!-- Recuadro y no filete lateral: el resto del documento habla
                   en campos con caja (la rejilla de medidas, los datos
                   generales), igual que la ficha en papel. -->
              <div style="padding:12px 14px;border:1px solid ${PAPER.rule};background-color:${PAPER.bg};font-size:14px;line-height:1.6;color:${PAPER.ink};">${escMultiline(garment.spec)}</div>
            </td>
          </tr>`
        : ""
    }
  </table>`;
}

export function workshopOrderEmail(
  data: WorkshopOrderEmailData,
  override?: EmailCopyOverride | null,
  options?: { printUrl?: string | null },
) {
  const copy = resolveCopy(WORKSHOP_ORDER_COPY, override);
  const vars = {
    orderNumber: esc(data.orderNumber),
    clientName: esc(data.clientName),
    locationName: esc(data.locationName),
    statusLabel: esc(data.statusLabel),
    expectedDeliveryLabel: esc(data.expectedDeliveryLabel ?? ""),
    fittingDateLabel: esc(data.fittingDateLabel ?? ""),
    recipientRoleLabel: esc(data.recipientRoleLabel ?? ""),
  };

  const unitLabel = data.garments[0]?.measurementUnit ?? "cm";

  const metaRow = (label: string, value: string) =>
    value
      ? `<td style="padding:0 16px 0 0;vertical-align:top;">
           <span style="display:block;font-size:10px;letter-spacing:0.14em;text-transform:uppercase;color:${PAPER.inkFaint};">${label}</span>
           <span style="display:block;font-size:14px;color:${PAPER.ink};">${value}</span>
         </td>`
      : "";

  const html = `<!doctype html>
<html lang="es">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <meta name="color-scheme" content="light" />
    <meta name="supported-color-schemes" content="light" />
    <title>Orden de trabajo ${vars.orderNumber}</title>
  </head>
  <body style="margin:0;padding:0;background-color:${PAPER.bg};font-family:Georgia,'Times New Roman',serif;color:${PAPER.ink};-webkit-font-smoothing:antialiased;">
    <div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent;">Orden de trabajo ${vars.orderNumber} — ${vars.clientName}, ${data.garments.length} ${data.garments.length === 1 ? "prenda" : "prendas"}.&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;</div>

    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:${PAPER.bg};padding:28px 0;">
      <tr>
        <td align="center">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:620px;">

            <!-- Cabecera -->
            <tr>
              <td style="padding:0 0 18px 0;border-bottom:2px solid ${PAPER.gold};">
                <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                  <tr>
                    <td style="vertical-align:bottom;">
                      <div style="letter-spacing:0.3em;font-size:15px;color:${PAPER.ink};text-transform:uppercase;">JOHN HENRY</div>
                      <div style="letter-spacing:0.26em;font-size:9px;color:${PAPER.gold};text-transform:uppercase;margin-top:5px;">Sastrer&iacute;a &middot; Est. 2004</div>
                    </td>
                    <td align="right" style="vertical-align:bottom;">
                      <div style="font-size:10px;letter-spacing:0.2em;text-transform:uppercase;color:${PAPER.inkFaint};">Orden de trabajo</div>
                      <div style="font-size:19px;color:${PAPER.ink};margin-top:3px;">${vars.orderNumber}</div>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>

            <!-- Saludo -->
            <tr>
              <td style="padding:22px 0 0 0;font-size:15px;line-height:1.65;">
                ${vars.recipientRoleLabel ? `<p style="margin:0 0 6px 0;font-size:11px;letter-spacing:0.16em;text-transform:uppercase;color:${PAPER.gold};">Para: ${vars.recipientRoleLabel}</p>` : ""}
                <p style="margin:0 0 16px 0;">${interpolate(copy.intro, vars)}</p>
              </td>
            </tr>

            <!-- Datos generales -->
            <tr>
              <td style="padding:6px 0 24px 0;">
                <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-top:1px solid ${PAPER.rule};border-bottom:1px solid ${PAPER.rule};padding:14px 0;">
                  <tr>
                    ${metaRow("Cliente", vars.clientName)}
                    ${metaRow("Sede", vars.locationName)}
                    ${metaRow("Fecha", esc(data.createdAtLabel))}
                  </tr>
                </table>
                ${
                  data.fittingDateLabel || data.expectedDeliveryLabel
                    ? `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-bottom:1px solid ${PAPER.rule};padding:14px 0;">
                        <tr>
                          ${metaRow("Fecha de prueba", vars.fittingDateLabel)}
                          ${metaRow("Fecha de entrega", vars.expectedDeliveryLabel)}
                          ${metaRow("Estado", vars.statusLabel)}
                        </tr>
                      </table>`
                    : ""
                }
              </td>
            </tr>

            <!-- Prendas -->
            <tr>
              <td>${data.garments.map((garment) => garmentBlock(garment, unitLabel)).join("")}</td>
            </tr>

            ${
              data.notes
                ? `<tr>
                    <td style="padding:0 0 24px 0;">
                      <span style="display:block;margin-bottom:6px;font-size:11px;letter-spacing:0.18em;text-transform:uppercase;color:${PAPER.gold};">Notas de la orden</span>
                      <div style="padding:12px 14px;border:1px dashed ${PAPER.rule};font-size:14px;line-height:1.6;color:${PAPER.ink};">${escMultiline(data.notes)}</div>
                    </td>
                  </tr>`
                : ""
            }

            ${
              options?.printUrl && copy.ctaLabel
                ? `<tr>
                    <td style="padding:0 0 24px 0;">
                      <table role="presentation" cellpadding="0" cellspacing="0">
                        <tr>
                          <td style="border:1px solid ${PAPER.gold};">
                            <a href="${options.printUrl}" style="display:inline-block;padding:12px 26px;font-family:Georgia,serif;font-size:11px;letter-spacing:0.18em;text-transform:uppercase;color:${PAPER.gold};text-decoration:none;">${esc(copy.ctaLabel)}</a>
                          </td>
                        </tr>
                      </table>
                    </td>
                  </tr>`
                : ""
            }

            <!-- Pie -->
            <tr>
              <td style="padding:18px 0 0 0;border-top:1px solid ${PAPER.rule};">
                <p style="margin:0 0 8px 0;font-size:12px;line-height:1.6;color:${PAPER.inkSoft};">${interpolate(copy.outro, vars)}</p>
                <p style="margin:0;font-size:11px;color:${PAPER.inkFaint};">JOHN HENRY &middot; ${vars.locationName}${data.locationPhone ? ` &middot; ${esc(data.locationPhone)}` : ""}</p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;

  return { subject: interpolate(copy.subject, vars), html };
}
