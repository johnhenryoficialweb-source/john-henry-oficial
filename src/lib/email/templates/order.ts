import { brandEmailLayout, brandEmailRow, BRAND } from "./layout";
import {
  esc,
  escMultiline,
  interpolate,
  paragraph,
  resolveCopy,
  type EmailCopy,
  type EmailCopyOverride,
} from "../copy";

/** Encabezado común: sello pequeño + número de orden en grande. */
function orderEyebrow(label: string, orderNumber: string) {
  return `
    <p style="margin:0 0 4px 0;font-size:11px;letter-spacing:0.25em;text-transform:uppercase;color:${BRAND.goldDim};">${label}</p>
    <p style="margin:0 0 24px 0;font-size:22px;color:${BRAND.ivory};">${orderNumber}</p>`;
}

/* -------------------------------------------------------------------------- *
 * Orden creada — confirmación
 * -------------------------------------------------------------------------- */

export interface OrderConfirmationEmailData {
  clientName: string;
  orderNumber: string;
  locationName: string;
  itemsSummary: string[]; // ej. "1x Saco — Lana italiana gris"
  expectedDeliveryLabel?: string | null;
  totalLabel?: string; // omitido si no se muestran precios
}

export const ORDER_CONFIRMATION_COPY: EmailCopy = {
  subject: "Confirmación de orden {{orderNumber}}",
  heading: "Estimado {{clientName}},",
  intro: "Su orden <strong>{{orderNumber}}</strong> ha sido registrada en {{locationName}}:",
  outro: "Gracias por confiar en JOHN HENRY.",
};

export function orderConfirmationClientEmail(
  data: OrderConfirmationEmailData,
  override?: EmailCopyOverride | null,
) {
  const copy = resolveCopy(ORDER_CONFIRMATION_COPY, override);
  const vars = {
    clientName: esc(data.clientName),
    orderNumber: esc(data.orderNumber),
    locationName: esc(data.locationName),
    expectedDeliveryLabel: esc(data.expectedDeliveryLabel ?? ""),
    totalLabel: esc(data.totalLabel ?? ""),
  };

  const html = brandEmailLayout({
    title: `Orden ${data.orderNumber} — JOHN HENRY`,
    preheader: `Su orden ${data.orderNumber} quedó registrada en ${data.locationName}.`,
    bodyHtml: `
      ${paragraph(interpolate(copy.heading, vars), "font-size:20px;")}
      ${paragraph(interpolate(copy.intro, vars), "margin-bottom:10px;")}
      <ul style="margin:0 0 20px 0;padding-left:20px;">
        ${data.itemsSummary.map((line) => `<li style="margin:5px 0;">${esc(line)}</li>`).join("")}
      </ul>
      ${vars.expectedDeliveryLabel ? paragraph(`Fecha estimada de entrega: ${vars.expectedDeliveryLabel}`, `color:${BRAND.gold};`) : ""}
      ${vars.totalLabel ? paragraph(`Total: <strong>${vars.totalLabel}</strong>`, "font-size:18px;") : ""}
      ${paragraph(interpolate(copy.outro, vars), "margin-bottom:0;")}
    `,
  });

  return { subject: interpolate(copy.subject, vars), html };
}

/* -------------------------------------------------------------------------- *
 * Resumen de orden — sin medidas corporales
 * -------------------------------------------------------------------------- */

export interface OrderSummaryClientEmailData {
  clientName: string;
  orderNumber: string;
  locationName: string;
  garments: Array<{
    label: string;
    fabricLabel: string;
    styleNotes?: string | null;
    lineTotalLabel: string;
  }>;
  subtotalLabel: string;
  discountLabel?: string;
  totalLabel: string;
  totalPaidLabel: string;
  balanceLabel: string;
  expectedDeliveryLabel?: string | null;
  orderNotes?: string | null;
}

export const ORDER_SUMMARY_COPY: EmailCopy = {
  subject: "Resumen de orden {{orderNumber}}",
  heading: "Resumen de orden",
  intro: "Estimado {{clientName}}, este es el resumen de su orden en {{locationName}}.",
  outro: "",
};

/**
 * Resumen de orden para el cliente — sin medidas corporales.
 *
 * Las medidas nunca salen en este correo: son datos íntimos del cliente y no
 * aportan nada a la confirmación de una compra. El taller las consulta en el
 * sistema; el correo solo lleva prendas, tela y dinero.
 */
export function orderSummaryClientEmail(
  data: OrderSummaryClientEmailData,
  override?: EmailCopyOverride | null,
) {
  const copy = resolveCopy(ORDER_SUMMARY_COPY, override);
  const vars = {
    clientName: esc(data.clientName),
    orderNumber: esc(data.orderNumber),
    locationName: esc(data.locationName),
    totalLabel: esc(data.totalLabel),
    balanceLabel: esc(data.balanceLabel),
  };

  const html = brandEmailLayout({
    title: `Resumen de orden ${data.orderNumber}`,
    preheader: `Orden ${data.orderNumber} · Total ${data.totalLabel} · Saldo ${data.balanceLabel}`,
    bodyHtml: `
      ${orderEyebrow(interpolate(copy.heading, vars), vars.orderNumber)}
      ${paragraph(interpolate(copy.intro, vars), "margin-bottom:24px;")}
      ${data.garments
        .map(
          (garment) => `
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 16px 0;border-top:1px solid ${BRAND.hairline};">
          <tr>
            <td style="padding:14px 0 0 0;font-size:17px;color:${BRAND.gold};vertical-align:top;">${esc(garment.label)}</td>
            <td style="padding:14px 0 0 0;font-size:13px;text-align:right;white-space:nowrap;vertical-align:top;">${esc(garment.lineTotalLabel)}</td>
          </tr>
          <tr>
            <td colspan="2" style="padding:6px 0 0 0;font-size:12px;color:${BRAND.muted};">${esc(garment.fabricLabel)}</td>
          </tr>
          ${
            garment.styleNotes
              ? `<tr><td colspan="2" style="padding:10px 0 14px 0;font-size:12px;color:rgba(245,240,230,0.8);">${escMultiline(garment.styleNotes)}</td></tr>`
              : `<tr><td colspan="2" style="padding-bottom:14px;"></td></tr>`
          }
        </table>`,
        )
        .join("")}
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-top:1px solid ${BRAND.hairline};font-size:13px;">
        <tr><td style="padding-top:14px;color:${BRAND.muted};">Subtotal</td><td align="right" style="padding-top:14px;">${esc(data.subtotalLabel)}</td></tr>
        ${data.discountLabel ? `<tr><td style="color:${BRAND.muted};padding-top:4px;">Descuento</td><td align="right" style="padding-top:4px;">-${esc(data.discountLabel)}</td></tr>` : ""}
        <tr><td style="padding-top:8px;font-size:16px;">Total</td><td align="right" style="padding-top:8px;font-size:16px;color:${BRAND.gold};"><strong>${vars.totalLabel}</strong></td></tr>
        <tr><td style="color:${BRAND.muted};padding-top:10px;">Pagado</td><td align="right" style="padding-top:10px;">${esc(data.totalPaidLabel)}</td></tr>
        <tr><td style="padding-top:4px;font-weight:600;">Saldo pendiente</td><td align="right" style="padding-top:4px;font-weight:600;">${vars.balanceLabel}</td></tr>
      </table>
      ${data.expectedDeliveryLabel ? paragraph(`Fecha estimada de entrega: ${esc(data.expectedDeliveryLabel)}`, `margin-top:22px;color:${BRAND.gold};`) : ""}
      ${data.orderNotes ? paragraph(`&ldquo;${escMultiline(data.orderNotes)}&rdquo;`, `font-size:12px;color:${BRAND.muted};font-style:italic;`) : ""}
      ${copy.outro ? paragraph(interpolate(copy.outro, vars), "margin-bottom:0;") : ""}
    `,
  });

  return { subject: interpolate(copy.subject, vars), html };
}

/** @deprecated Usar orderSummaryClientEmail */
export const orderMeasurementSummaryEmail = orderSummaryClientEmail;
export type OrderMeasurementSummaryEmailData = OrderSummaryClientEmailData;

/* -------------------------------------------------------------------------- *
 * Agradecimiento de compra — sin medidas
 * -------------------------------------------------------------------------- */

export interface OrderThankYouEmailData {
  clientName: string;
  orderNumber: string;
  locationName: string;
  garmentsSummary: string[];
  expectedDeliveryLabel?: string | null;
}

export const ORDER_THANK_YOU_COPY: EmailCopy = {
  subject: "Gracias por su compra — orden {{orderNumber}}",
  heading: "Gracias, {{clientName}}.",
  intro:
    "Su orden <strong>{{orderNumber}}</strong> quedó en manos de nuestro taller en {{locationName}}. Desde hoy, un equipo de sastres trabaja en las piezas que eligió.",
  outro:
    "Le escribiremos en cada etapa del proceso. Si necesita cualquier cosa, responda este correo y le atendemos.",
};

/**
 * Agradecimiento por la compra, deliberadamente sin medidas ni precios.
 *
 * Es el correo de cortesía, no el comprobante: el resumen con dinero es
 * `orderSummaryClientEmail` y se manda aparte cuando el cliente lo pide. Meter
 * cifras acá convertiría un gesto de agradecimiento en una factura.
 */
export function orderThankYouClientEmail(
  data: OrderThankYouEmailData,
  override?: EmailCopyOverride | null,
) {
  const copy = resolveCopy(ORDER_THANK_YOU_COPY, override);
  const vars = {
    clientName: esc(data.clientName),
    orderNumber: esc(data.orderNumber),
    locationName: esc(data.locationName),
    expectedDeliveryLabel: esc(data.expectedDeliveryLabel ?? ""),
  };

  const html = brandEmailLayout({
    title: `Gracias por su compra — ${data.orderNumber}`,
    preheader: `Su orden ${data.orderNumber} ya está en el taller.`,
    bodyHtml: `
      ${paragraph(interpolate(copy.heading, vars), `font-size:22px;color:${BRAND.gold};`)}
      ${paragraph(interpolate(copy.intro, vars))}
      ${
        data.garmentsSummary.length > 0
          ? `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:22px 0;border-collapse:collapse;border-top:1px solid ${BRAND.hairline};border-bottom:1px solid ${BRAND.hairline};">
              ${brandEmailRow("Su orden", data.garmentsSummary.map((line) => esc(line)).join("<br/>"))}
              ${vars.expectedDeliveryLabel ? brandEmailRow("Entrega estimada", vars.expectedDeliveryLabel) : ""}
            </table>`
          : ""
      }
      ${paragraph(interpolate(copy.outro, vars))}
      ${paragraph("Con aprecio,<br/>JOHN HENRY", "margin-bottom:0;")}
    `,
  });

  return { subject: interpolate(copy.subject, vars), html };
}

/* -------------------------------------------------------------------------- *
 * Actualización de estado de la orden
 * -------------------------------------------------------------------------- */

export interface OrderStatusUpdateEmailData {
  clientName: string;
  orderNumber: string;
  statusLabel: string;
  /** Frase que explica en qué se traduce el estado para el cliente. */
  statusDetail?: string | null;
  locationName?: string | null;
  expectedDeliveryLabel?: string | null;
}

export const ORDER_STATUS_UPDATE_COPY: EmailCopy = {
  subject: "Orden {{orderNumber}}: {{statusLabel}}",
  heading: "Estimado {{clientName}},",
  intro: "Su orden <strong>{{orderNumber}}</strong> cambió de estado:",
  outro: "Le avisaremos apenas haya una novedad. Gracias por su paciencia.",
};

export function orderStatusUpdateClientEmail(
  data: OrderStatusUpdateEmailData,
  override?: EmailCopyOverride | null,
) {
  const copy = resolveCopy(ORDER_STATUS_UPDATE_COPY, override);
  const vars = {
    clientName: esc(data.clientName),
    orderNumber: esc(data.orderNumber),
    statusLabel: esc(data.statusLabel),
    statusDetail: esc(data.statusDetail ?? ""),
    locationName: esc(data.locationName ?? ""),
    expectedDeliveryLabel: esc(data.expectedDeliveryLabel ?? ""),
  };

  const html = brandEmailLayout({
    title: `Actualización de orden ${data.orderNumber}`,
    preheader: `${data.orderNumber} — ${data.statusLabel}`,
    bodyHtml: `
      ${paragraph(interpolate(copy.heading, vars), "font-size:20px;")}
      ${paragraph(interpolate(copy.intro, vars))}
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 20px 0;border-collapse:collapse;border-top:1px solid ${BRAND.hairline};border-bottom:1px solid ${BRAND.hairline};">
        ${brandEmailRow("Estado", `<span style="font-size:17px;color:${BRAND.gold};">${vars.statusLabel}</span>`)}
        ${vars.locationName ? brandEmailRow("Sede", vars.locationName) : ""}
        ${vars.expectedDeliveryLabel ? brandEmailRow("Entrega estimada", vars.expectedDeliveryLabel) : ""}
      </table>
      ${vars.statusDetail ? paragraph(vars.statusDetail) : ""}
      ${paragraph(interpolate(copy.outro, vars), "margin-bottom:0;")}
    `,
  });

  return { subject: interpolate(copy.subject, vars), html };
}

/* -------------------------------------------------------------------------- *
 * Prenda lista para entregar
 * -------------------------------------------------------------------------- */

export interface OrderReadyForDeliveryEmailData {
  clientName: string;
  orderNumber: string;
  locationName: string;
  locationAddress?: string | null;
  garmentsSummary: string[];
  balanceLabel?: string | null;
  /** Horario de atención de la sede, si se conoce. */
  scheduleLabel?: string | null;
}

export const ORDER_READY_COPY: EmailCopy = {
  subject: "Su prenda está lista — orden {{orderNumber}}",
  heading: "{{clientName}}, su prenda le espera.",
  intro:
    "Terminamos su orden <strong>{{orderNumber}}</strong>. Puede recogerla en {{locationName}} cuando le quede cómodo.",
  outro:
    "Si prefiere coordinar una hora en particular o necesita un ajuste final, responda este correo y lo organizamos.",
  ctaLabel: "Agendar la entrega",
};

/**
 * Aviso de prenda lista para entregar.
 *
 * Muestra el saldo pendiente cuando lo hay — no para cobrar por correo, sino
 * porque llegar a recoger un traje y descubrir un saldo que nadie mencionó es
 * la clase de fricción que arruina el último momento del proceso.
 */
export function orderReadyForDeliveryClientEmail(
  data: OrderReadyForDeliveryEmailData,
  override?: EmailCopyOverride | null,
  options?: { bookingUrl?: string | null },
) {
  const copy = resolveCopy(ORDER_READY_COPY, override);
  const vars = {
    clientName: esc(data.clientName),
    orderNumber: esc(data.orderNumber),
    locationName: esc(data.locationName),
    locationAddress: esc(data.locationAddress ?? ""),
    balanceLabel: esc(data.balanceLabel ?? ""),
    scheduleLabel: esc(data.scheduleLabel ?? ""),
  };

  const html = brandEmailLayout({
    title: `Su prenda está lista — ${data.orderNumber}`,
    preheader: `Orden ${data.orderNumber} lista para recoger en ${data.locationName}.`,
    bodyHtml: `
      ${paragraph(interpolate(copy.heading, vars), `font-size:22px;color:${BRAND.gold};`)}
      ${paragraph(interpolate(copy.intro, vars))}
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:22px 0 8px 0;border-collapse:collapse;border-top:1px solid ${BRAND.hairline};border-bottom:1px solid ${BRAND.hairline};">
        ${data.garmentsSummary.length > 0 ? brandEmailRow("Prendas", data.garmentsSummary.map((line) => esc(line)).join("<br/>")) : ""}
        ${brandEmailRow("Recoger en", vars.locationAddress ? `${vars.locationName}<br/><span style="color:${BRAND.muted};font-size:13px;">${vars.locationAddress}</span>` : vars.locationName)}
        ${vars.scheduleLabel ? brandEmailRow("Horario", vars.scheduleLabel) : ""}
        ${vars.balanceLabel ? brandEmailRow("Saldo pendiente", `<span style="color:${BRAND.gold};">${vars.balanceLabel}</span>`) : ""}
      </table>
      ${paragraph(interpolate(copy.outro, vars), "margin-top:22px;")}
      ${paragraph("Con aprecio,<br/>JOHN HENRY", "margin-bottom:0;")}
    `,
    cta:
      options?.bookingUrl && copy.ctaLabel ? { label: copy.ctaLabel, url: options.bookingUrl } : null,
  });

  return { subject: interpolate(copy.subject, vars), html };
}
