import { brandEmailLayout, brandEmailRow, BRAND } from "./layout";
import {
  esc,
  interpolate,
  paragraph,
  resolveCopy,
  type EmailCopy,
  type EmailCopyOverride,
} from "../copy";

export interface AppointmentEmailData {
  clientName: string;
  locationName: string;
  locationAddress?: string | null;
  serviceLabel: string;
  startsAtLabel: string; // ya formateada en la zona horaria de la sede
}

export interface AppointmentStaffEmailData extends AppointmentEmailData {
  clientPhone: string;
  clientEmail?: string | null;
}

function appointmentVars(data: AppointmentEmailData) {
  return {
    clientName: esc(data.clientName),
    locationName: esc(data.locationName),
    locationAddress: esc(data.locationAddress ?? ""),
    serviceLabel: esc(data.serviceLabel),
    startsAtLabel: esc(data.startsAtLabel),
  };
}

function appointmentDetailTable(data: AppointmentEmailData) {
  const v = appointmentVars(data);
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 8px 0;border-collapse:collapse;border-top:1px solid ${BRAND.hairline};border-bottom:1px solid ${BRAND.hairline};padding:4px 0;">
    ${brandEmailRow("Servicio", v.serviceLabel)}
    ${brandEmailRow("Fecha y hora", v.startsAtLabel)}
    ${brandEmailRow("Sede", v.locationAddress ? `${v.locationName}<br/><span style="color:${BRAND.muted};font-size:13px;">${v.locationAddress}</span>` : v.locationName)}
  </table>`;
}

/* -------------------------------------------------------------------------- *
 * Cita creada — cliente
 * -------------------------------------------------------------------------- */

export const APPOINTMENT_CONFIRMATION_COPY: EmailCopy = {
  subject: "Confirmación de cita — {{startsAtLabel}}",
  heading: "Estimado {{clientName}},",
  intro: "Su cita ha sido registrada. A continuación el resumen:",
  outro:
    "Le pedimos llegar 10 minutos antes de la hora acordada. Si necesita reprogramar o cancelar, contáctenos respondiendo este correo.",
};

export function appointmentConfirmationClientEmail(
  data: AppointmentEmailData,
  override?: EmailCopyOverride | null,
) {
  const copy = resolveCopy(APPOINTMENT_CONFIRMATION_COPY, override);
  const vars = appointmentVars(data);

  const html = brandEmailLayout({
    title: "Confirmación de cita — JOHN HENRY",
    preheader: `${data.serviceLabel} · ${data.startsAtLabel} · ${data.locationName}`,
    bodyHtml: `
      ${paragraph(interpolate(copy.heading, vars), "font-size:20px;")}
      ${paragraph(interpolate(copy.intro, vars))}
      ${appointmentDetailTable(data)}
      ${paragraph(interpolate(copy.outro, vars), "margin-top:22px;")}
      ${paragraph("Con aprecio,<br/>JOHN HENRY", "margin-bottom:0;")}
    `,
  });

  return { subject: interpolate(copy.subject, vars), html };
}

/* -------------------------------------------------------------------------- *
 * Cita creada — aviso interno al staff
 * -------------------------------------------------------------------------- */

export const APPOINTMENT_STAFF_COPY: EmailCopy = {
  subject: "Nueva cita — {{clientName}} ({{locationName}})",
  heading: "Nueva cita agendada — {{locationName}}",
  intro: "",
  outro: "",
};

export function appointmentStaffNotificationEmail(
  data: AppointmentStaffEmailData,
  override?: EmailCopyOverride | null,
) {
  const copy = resolveCopy(APPOINTMENT_STAFF_COPY, override);
  const vars = { ...appointmentVars(data), clientPhone: esc(data.clientPhone), clientEmail: esc(data.clientEmail ?? "") };

  const html = brandEmailLayout({
    title: "Nueva cita agendada",
    preheader: `${data.clientName} · ${data.startsAtLabel}`,
    bodyHtml: `
      ${paragraph(interpolate(copy.heading, vars), "font-size:18px;")}
      ${copy.intro ? paragraph(interpolate(copy.intro, vars)) : ""}
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;border-top:1px solid ${BRAND.hairline};">
        ${brandEmailRow("Cliente", vars.clientName)}
        ${brandEmailRow("Teléfono", vars.clientPhone)}
        ${vars.clientEmail ? brandEmailRow("Correo", vars.clientEmail) : ""}
        ${brandEmailRow("Servicio", vars.serviceLabel)}
        ${brandEmailRow("Fecha y hora", vars.startsAtLabel)}
      </table>
      ${copy.outro ? paragraph(interpolate(copy.outro, vars), "margin-top:22px;") : ""}
    `,
  });

  return { subject: interpolate(copy.subject, vars), html };
}

/* -------------------------------------------------------------------------- *
 * Cita cancelada
 * -------------------------------------------------------------------------- */

export const APPOINTMENT_CANCELLED_COPY: EmailCopy = {
  subject: "Cita cancelada — {{startsAtLabel}}",
  heading: "Estimado {{clientName}},",
  intro:
    "Su cita de <strong>{{serviceLabel}}</strong> programada para el {{startsAtLabel}} en {{locationName}} ha sido cancelada.",
  outro: "Si desea reagendar, contáctenos o visite nuevamente nuestro sitio de reservas.",
  ctaLabel: "Agendar una nueva cita",
};

export function appointmentCancelledClientEmail(
  data: AppointmentEmailData,
  override?: EmailCopyOverride | null,
  options?: { bookingUrl?: string | null },
) {
  const copy = resolveCopy(APPOINTMENT_CANCELLED_COPY, override);
  const vars = appointmentVars(data);

  const html = brandEmailLayout({
    title: "Cita cancelada — JOHN HENRY",
    preheader: `Su cita del ${data.startsAtLabel} fue cancelada.`,
    bodyHtml: `
      ${paragraph(interpolate(copy.heading, vars), "font-size:20px;")}
      ${paragraph(interpolate(copy.intro, vars))}
      ${paragraph(interpolate(copy.outro, vars), "margin-bottom:0;")}
    `,
    cta:
      options?.bookingUrl && copy.ctaLabel
        ? { label: copy.ctaLabel, url: options.bookingUrl }
        : null,
  });

  return { subject: interpolate(copy.subject, vars), html };
}

/* -------------------------------------------------------------------------- *
 * Cita reprogramada
 * -------------------------------------------------------------------------- */

export const APPOINTMENT_RESCHEDULED_COPY: EmailCopy = {
  subject: "Cita reprogramada — {{startsAtLabel}}",
  heading: "Estimado {{clientName}},",
  intro:
    "Su cita de <strong>{{serviceLabel}}</strong> en {{locationName}} fue reprogramada. Esta es la nueva fecha:",
  outro: "Si esta fecha no le funciona, contáctenos respondiendo este correo.",
};

export function appointmentRescheduledClientEmail(
  data: AppointmentEmailData,
  override?: EmailCopyOverride | null,
) {
  const copy = resolveCopy(APPOINTMENT_RESCHEDULED_COPY, override);
  const vars = appointmentVars(data);

  const html = brandEmailLayout({
    title: "Cita reprogramada — JOHN HENRY",
    preheader: `Nueva fecha: ${data.startsAtLabel}`,
    bodyHtml: `
      ${paragraph(interpolate(copy.heading, vars), "font-size:20px;")}
      ${paragraph(interpolate(copy.intro, vars))}
      ${paragraph(vars.startsAtLabel, `font-size:19px;color:${BRAND.gold};`)}
      ${appointmentDetailTable(data)}
      ${paragraph(interpolate(copy.outro, vars), "margin-top:22px;margin-bottom:0;")}
    `,
  });

  return { subject: interpolate(copy.subject, vars), html };
}
