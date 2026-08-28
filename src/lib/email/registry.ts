import type { EmailCopy, EmailCopyOverride } from "./copy";
import {
  APPOINTMENT_CANCELLED_COPY,
  APPOINTMENT_CONFIRMATION_COPY,
  APPOINTMENT_RESCHEDULED_COPY,
  APPOINTMENT_STAFF_COPY,
  appointmentCancelledClientEmail,
  appointmentConfirmationClientEmail,
  appointmentRescheduledClientEmail,
  appointmentStaffNotificationEmail,
} from "./templates/appointment";
import {
  ORDER_CONFIRMATION_COPY,
  ORDER_READY_COPY,
  ORDER_STATUS_UPDATE_COPY,
  ORDER_SUMMARY_COPY,
  ORDER_THANK_YOU_COPY,
  orderConfirmationClientEmail,
  orderReadyForDeliveryClientEmail,
  orderStatusUpdateClientEmail,
  orderSummaryClientEmail,
  orderThankYouClientEmail,
} from "./templates/order";
import { WORKSHOP_ORDER_COPY, workshopOrderEmail } from "./templates/workshop";

/**
 * Catálogo de todos los correos que el sistema puede enviar.
 *
 * Existe para que "qué correos manda esto" sea un dato consultable y no algo
 * que haya que reconstruir leyendo Server Actions. El módulo /correos se dibuja
 * entero desde acá: si mañana se agrega una plantilla, aparece sola en el
 * listado, con su vista previa y su envío de prueba, sin tocar la interfaz.
 *
 * `renderSample` es lo que hace posible previsualizar y probar sin datos
 * reales: cada plantilla trae un ejemplo representativo de la sastrería, no un
 * "Lorem ipsum" que esconde cómo se ve un nombre largo o tres prendas.
 */

export type EmailTemplateKey =
  | "appointment_confirmation"
  | "appointment_staff_notification"
  | "appointment_rescheduled"
  | "appointment_cancelled"
  | "order_confirmation"
  | "order_thank_you"
  | "order_summary"
  | "order_status_update"
  | "order_ready_for_delivery"
  | "workshop_order";

/** `workshop` = taller y proveedores: no es cliente, pero tampoco staff del CMS. */
export type EmailAudience = "client" | "staff" | "workshop";

export interface EmailTemplateDefinition {
  key: EmailTemplateKey;
  name: string;
  /** Qué es el correo, en una línea. */
  description: string;
  /** Qué acción del sistema lo dispara. */
  trigger: string;
  audience: EmailAudience;
  /** Variables disponibles en los textos editables. */
  variables: string[];
  defaultCopy: EmailCopy;
  /** Render con datos de ejemplo, para vista previa y correo de prueba. */
  renderSample: (override?: EmailCopyOverride | null) => { subject: string; html: string };
  /**
   * Si el correo puede desactivarse. Los avisos de cita al cliente son parte
   * del compromiso con quien reservó: apagarlos deja a alguien esperando en
   * una sede a una hora que ya no existe.
   */
  canDisable: boolean;
}

const SAMPLE_SITE_URL = "https://johnhenryoficial.com";
const SAMPLE_BOOKING_URL = `${SAMPLE_SITE_URL}/citas`;

export const EMAIL_TEMPLATES: Record<EmailTemplateKey, EmailTemplateDefinition> = {
  appointment_confirmation: {
    key: "appointment_confirmation",
    name: "Cita creada — cliente",
    description: "Confirma al cliente la cita que acaba de quedar agendada, con sede, servicio y hora.",
    trigger: "Al crear una cita desde el formulario público o desde el CMS.",
    audience: "client",
    canDisable: false,
    variables: ["clientName", "locationName", "locationAddress", "serviceLabel", "startsAtLabel"],
    defaultCopy: APPOINTMENT_CONFIRMATION_COPY,
    renderSample: (override) =>
      appointmentConfirmationClientEmail(
        {
          clientName: "Alejandro Restrepo",
          locationName: "Bogotá",
          locationAddress: "Calle 82 #12-45, Zona T",
          serviceLabel: "Saco a medida",
          startsAtLabel: "martes 19 de agosto de 2026, 10:00 a. m.",
        },
        override,
      ),
  },

  appointment_staff_notification: {
    key: "appointment_staff_notification",
    name: "Cita creada — aviso interno",
    description: "Avisa al equipo de la sede que entró una cita nueva, con los datos de contacto.",
    trigger: "Al crear una cita, si NOTIFY_STAFF_EMAIL está configurado.",
    audience: "staff",
    canDisable: true,
    variables: ["clientName", "clientPhone", "clientEmail", "locationName", "serviceLabel", "startsAtLabel"],
    defaultCopy: APPOINTMENT_STAFF_COPY,
    renderSample: (override) =>
      appointmentStaffNotificationEmail(
        {
          clientName: "Alejandro Restrepo",
          clientPhone: "+57 310 555 0142",
          clientEmail: "alejandro@ejemplo.com",
          locationName: "Bogotá",
          serviceLabel: "Saco a medida",
          startsAtLabel: "martes 19 de agosto de 2026, 10:00 a. m.",
        },
        override,
      ),
  },

  appointment_rescheduled: {
    key: "appointment_rescheduled",
    name: "Cita reprogramada",
    description: "Informa la nueva fecha y hora cuando se mueve una cita.",
    trigger: "Al reprogramar una cita desde el CMS.",
    audience: "client",
    canDisable: false,
    variables: ["clientName", "locationName", "locationAddress", "serviceLabel", "startsAtLabel"],
    defaultCopy: APPOINTMENT_RESCHEDULED_COPY,
    renderSample: (override) =>
      appointmentRescheduledClientEmail(
        {
          clientName: "Alejandro Restrepo",
          locationName: "Bogotá",
          locationAddress: "Calle 82 #12-45, Zona T",
          serviceLabel: "Saco a medida",
          startsAtLabel: "jueves 21 de agosto de 2026, 4:00 p. m.",
        },
        override,
      ),
  },

  appointment_cancelled: {
    key: "appointment_cancelled",
    name: "Cita cancelada",
    description: "Confirma la cancelación e invita a reagendar.",
    trigger: "Al cancelar una cita desde el CMS.",
    audience: "client",
    canDisable: false,
    variables: ["clientName", "locationName", "serviceLabel", "startsAtLabel"],
    defaultCopy: APPOINTMENT_CANCELLED_COPY,
    renderSample: (override) =>
      appointmentCancelledClientEmail(
        {
          clientName: "Alejandro Restrepo",
          locationName: "Bogotá",
          serviceLabel: "Saco a medida",
          startsAtLabel: "martes 19 de agosto de 2026, 10:00 a. m.",
        },
        override,
        { bookingUrl: SAMPLE_BOOKING_URL },
      ),
  },

  order_confirmation: {
    key: "order_confirmation",
    name: "Orden registrada",
    description:
      "Comprobante inmediato con las prendas, la entrega estimada y el total. Sale junto con el agradecimiento: si prefieres que el cliente reciba un solo correo al comprar, desactiva uno de los dos.",
    trigger: "Al crear una orden en el CMS, si el cliente tiene correo.",
    audience: "client",
    canDisable: true,
    variables: ["clientName", "orderNumber", "locationName", "expectedDeliveryLabel", "totalLabel"],
    defaultCopy: ORDER_CONFIRMATION_COPY,
    renderSample: (override) =>
      orderConfirmationClientEmail(
        {
          clientName: "Alejandro Restrepo",
          orderNumber: "BOG-2026-0184",
          locationName: "Bogotá",
          itemsSummary: ["1x Saco", "1x Pantalón", "2x Camisa"],
          expectedDeliveryLabel: "12 de septiembre de 2026",
          totalLabel: "$4.850.000 COP",
        },
        override,
      ),
  },

  order_thank_you: {
    key: "order_thank_you",
    name: "Agradecimiento de compra",
    description:
      "Correo de cortesía tras la compra. No lleva medidas ni cifras: solo agradece y cuenta que la orden entró al taller.",
    trigger:
      "Al crear una orden (junto al comprobante), o manualmente con el botón «Agradecimiento» en la ficha de la orden.",
    audience: "client",
    canDisable: true,
    variables: ["clientName", "orderNumber", "locationName", "expectedDeliveryLabel"],
    defaultCopy: ORDER_THANK_YOU_COPY,
    renderSample: (override) =>
      orderThankYouClientEmail(
        {
          clientName: "Alejandro Restrepo",
          orderNumber: "BOG-2026-0184",
          locationName: "Bogotá",
          garmentsSummary: ["1x Saco — Lana italiana gris Oxford", "1x Pantalón — Lana italiana gris Oxford"],
          expectedDeliveryLabel: "12 de septiembre de 2026",
        },
        override,
      ),
  },

  order_summary: {
    key: "order_summary",
    name: "Resumen de orden",
    description:
      "Detalle completo con prendas, telas, totales y saldo. Nunca incluye medidas corporales.",
    trigger: "Manual, desde el botón de la ficha de la orden.",
    audience: "client",
    canDisable: true,
    variables: ["clientName", "orderNumber", "locationName", "totalLabel", "balanceLabel"],
    defaultCopy: ORDER_SUMMARY_COPY,
    renderSample: (override) =>
      orderSummaryClientEmail(
        {
          clientName: "Alejandro Restrepo",
          orderNumber: "BOG-2026-0184",
          locationName: "Bogotá",
          garments: [
            {
              label: "1x Saco",
              fabricLabel: "Lana italiana gris Oxford · Modelo Windsor",
              styleNotes: "Dos botones, solapa de muesca, forro burdeos.\nIniciales A.R. en el puño interno.",
              lineTotalLabel: "$3.200.000",
            },
            {
              label: "1x Pantalón",
              fabricLabel: "Lana italiana gris Oxford",
              styleNotes: "Sin pinzas, bota 18 cm.",
              lineTotalLabel: "$1.650.000",
            },
          ],
          subtotalLabel: "$5.100.000",
          // El envío real solo manda descuento cuando lo hay; el ejemplo hace
          // lo mismo, con un valor distinto de cero, para que la vista previa
          // muestre esa fila como se ve de verdad y no como "-$0".
          discountLabel: "$250.000",
          totalLabel: "$4.850.000",
          totalPaidLabel: "$2.000.000",
          balanceLabel: "$2.850.000",
          expectedDeliveryLabel: "12 de septiembre de 2026",
          orderNotes: "Entregar antes del matrimonio del 20 de septiembre.",
        },
        override,
      ),
  },

  order_status_update: {
    key: "order_status_update",
    name: "Actualización de orden",
    description: "Avisa al cliente cada vez que su orden avanza de etapa en el taller.",
    trigger: "Al cambiar el estado de una orden en el CMS.",
    audience: "client",
    canDisable: true,
    variables: [
      "clientName",
      "orderNumber",
      "statusLabel",
      "statusDetail",
      "locationName",
      "expectedDeliveryLabel",
    ],
    defaultCopy: ORDER_STATUS_UPDATE_COPY,
    renderSample: (override) =>
      orderStatusUpdateClientEmail(
        {
          clientName: "Alejandro Restrepo",
          orderNumber: "BOG-2026-0184",
          statusLabel: "En preparación",
          statusDetail: "Su tela ya está cortada y las piezas entraron a confección.",
          locationName: "Bogotá",
          expectedDeliveryLabel: "12 de septiembre de 2026",
        },
        override,
      ),
  },

  order_ready_for_delivery: {
    key: "order_ready_for_delivery",
    name: "Prenda lista para entregar",
    description: "Avisa que la prenda terminó y puede recogerse, con sede, horario y saldo pendiente.",
    trigger: "Al pasar una orden al estado «Lista para entrega».",
    audience: "client",
    canDisable: true,
    variables: ["clientName", "orderNumber", "locationName", "locationAddress", "balanceLabel", "scheduleLabel"],
    defaultCopy: ORDER_READY_COPY,
    renderSample: (override) =>
      orderReadyForDeliveryClientEmail(
        {
          clientName: "Alejandro Restrepo",
          orderNumber: "BOG-2026-0184",
          locationName: "Bogotá",
          locationAddress: "Calle 82 #12-45, Zona T",
          garmentsSummary: ["1x Saco — Lana italiana gris Oxford", "1x Pantalón — Lana italiana gris Oxford"],
          balanceLabel: "$2.850.000 COP",
          scheduleLabel: "Lunes a sábado, 9:00 a. m. – 6:00 p. m.",
        },
        override,
        { bookingUrl: SAMPLE_BOOKING_URL },
      ),
  },

  workshop_order: {
    key: "workshop_order",
    name: "Orden de trabajo",
    description:
      "El documento del taller: prenda, tela, especificación y medidas. Solo el nombre del cliente — sin teléfono, sin cédula y sin precios.",
    trigger:
      "Al crear una orden y al confirmarla. Va al sastre, al vendedor y al proveedor de tela configurados en Destinatarios.",
    audience: "workshop",
    canDisable: true,
    variables: [
      "orderNumber",
      "clientName",
      "locationName",
      "statusLabel",
      "expectedDeliveryLabel",
      "fittingDateLabel",
      "recipientRoleLabel",
    ],
    defaultCopy: WORKSHOP_ORDER_COPY,
    renderSample: (override) =>
      workshopOrderEmail(
        {
          orderNumber: "BOG-2026-0184",
          statusLabel: "Aceptada",
          clientName: "Alejandro Restrepo",
          locationName: "Bogotá",
          locationPhone: "+57 319 283 7704",
          createdAtLabel: "12 de agosto de 2026",
          expectedDeliveryLabel: "12 de septiembre de 2026",
          fittingDateLabel: "28 de agosto de 2026",
          notes: "Entregar antes del matrimonio del 20 de septiembre.",
          recipientRoleLabel: "Sastre",
          garments: [
            {
              label: "Saco",
              quantity: 1,
              fabricName: "Lana italiana gris Oxford",
              fabricCode: "VBC-1234",
              fabricComposition: "100% lana Super 130s",
              fabricSupplier: "Vitale Barberis Canonico",
              modelName: "Clásico dos botones",
              measurements: [
                { label: "Torax", value: "106" },
                { label: "Largo", value: "74" },
                { label: "Manga", value: "63" },
                { label: "Hombro", value: "17" },
                { label: "Espalda", value: "47" },
                { label: "Cintura", value: "100" },
                { label: "Base", value: "107" },
                { label: "Hombro A Hombro", value: "46" },
                { label: "Contorno de Brazo", value: "38" },
                { label: "Contorno de Puño", value: "26 1/2" },
              ],
              measurementUnit: "cm",
              spec: "Dos botones / Solapa de muesca / Bolsillo de tapa / Forro burdeos / Aberturas laterales / Iniciales A.R. en puño izquierdo",
            },
            {
              label: "Pantalón",
              quantity: 1,
              fabricName: "Lana italiana gris Oxford",
              fabricCode: "VBC-1234",
              fabricComposition: "100% lana Super 130s",
              fabricSupplier: "Vitale Barberis Canonico",
              modelName: null,
              measurements: [
                { label: "Cintura", value: "90" },
                { label: "Base", value: "107" },
                { label: "Muslo", value: "62" },
                { label: "Rodilla", value: "23" },
                { label: "Bota", value: "18" },
                { label: "Largo", value: "95" },
                { label: "Entrepierna", value: "26 1/2" },
              ],
              measurementUnit: "cm",
              spec: "Hebilla a los lados / Bolsillo sesgado / Pretina cruzada / Liso / 2 bolsillos atrás / Bota lisa / Pretina sostenida",
            },
          ],
        },
        override,
        { printUrl: `${SAMPLE_SITE_URL}/orders/ejemplo/orden-taller` },
      ),
  },
};

export const EMAIL_TEMPLATE_KEYS = Object.keys(EMAIL_TEMPLATES) as EmailTemplateKey[];

export function isEmailTemplateKey(value: string): value is EmailTemplateKey {
  return value in EMAIL_TEMPLATES;
}

/** Agrupación del listado. El orden es el del recorrido real del cliente. */
export const EMAIL_TEMPLATE_GROUPS: Array<{
  label: string;
  description: string;
  keys: EmailTemplateKey[];
}> = [
  {
    label: "Citas",
    description: "El primer contacto: lo que recibe quien reserva antes de ser cliente.",
    keys: [
      "appointment_confirmation",
      "appointment_rescheduled",
      "appointment_cancelled",
      "appointment_staff_notification",
    ],
  },
  {
    label: "Órdenes",
    description: "Lo que acompaña una compra desde que entra al taller hasta que sale por la puerta.",
    keys: [
      "order_confirmation",
      "order_thank_you",
      "order_summary",
      "order_status_update",
      "order_ready_for_delivery",
    ],
  },
  {
    label: "Taller",
    description: "Lo que sale hacia adentro: el documento con el que se corta y se compra la tela.",
    keys: ["workshop_order"],
  },
];
