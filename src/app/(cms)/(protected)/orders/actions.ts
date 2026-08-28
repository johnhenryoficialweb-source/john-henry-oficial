"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireAdminSession, requireStaffSession } from "@/lib/auth/roles";
import { createClient } from "@/lib/supabase/server";
import { sendSystemEmail } from "@/lib/email/send";
import { bookingUrl } from "@/lib/email/links";
import {
  orderConfirmationClientEmail,
  orderReadyForDeliveryClientEmail,
  orderStatusUpdateClientEmail,
  orderSummaryClientEmail,
  orderThankYouClientEmail,
} from "@/lib/email/templates/order";
import { ORDER_STATUS_CLIENT_DETAIL, ORDER_STATUS_NOTIFIABLE } from "@/lib/email/order-status";
import { sendWorkshopOrderEmails } from "@/lib/email/workshop";
import { GARMENT_TYPE_LABELS, ORDER_STATUS_LABELS } from "@/lib/constants";
import { formatCurrency } from "@/lib/currency/exchange";
import { parseAmount } from "@/lib/currency/parse";
import {
  compareMeasurements,
  isMoldMatch,
  type GarmentSpecRef,
  type MoldMatch,
} from "@/lib/orders/garment-specs";
import type { GarmentType, MeasurementUnit, OrderStatus, PaymentMethod } from "@/types/database.types";

export interface OrderItemInput {
  garmentType: GarmentType;
  fabricId: string | null;
  garmentModelId: string | null;
  quantity: number;
  unitPrice: number;
  measurements: Record<string, number>;
  measurementUnit: MeasurementUnit;
  /** Iniciales/material/observaciones de ESTA pieza (modelo, corte, etc.), ya formateado. */
  notes?: string | null;
}

export async function getLatestMeasurement(clientId: string, garmentType: GarmentType) {
  const supabase = await createClient();
  /*
   * Se ordena y se toma la primera en vez de usar `maybeSingle()`.
   *
   * `maybeSingle()` devuelve error si hay más de una fila, y llegó a haberlas:
   * el trigger que desmarca la medida anterior lo bloqueaba RLS en silencio
   * (ver 0028). El efecto era que la precarga de medidas moría sin avisar justo
   * para los clientes recurrentes. Ya está arreglado de raíz, pero leer la más
   * reciente en vez de exigir que haya exactamente una hace que un duplicado
   * degrade en "muestra la más nueva" y no en "no muestra nada".
   */
  const { data } = await supabase
    .from("client_measurements")
    .select("values, unit")
    .eq("client_id", clientId)
    .eq("garment_type", garmentType)
    .eq("source", "profile")
    .eq("is_latest", true)
    .order("taken_at", { ascending: false })
    .limit(1);

  return data?.[0] ?? null;
}

/**
 * Últimas especificaciones que se le hicieron a ESTE cliente para ESTA prenda.
 *
 * Es el punto de partida real del sastre: los datos del legacy muestran que
 * solo el 8% de los clientes repite su especificación palabra por palabra, pero
 * casi siempre parte de la anterior y la ajusta. Copiar y editar es el flujo,
 * no elegir de un catálogo cerrado.
 */
export async function getClientGarmentSpecs(
  clientId: string,
  garmentType: GarmentType,
  limit = 5
): Promise<GarmentSpecRef[]> {
  const supabase = await createClient();

  const { data } = await supabase
    .from("order_items")
    .select("notes, fabrics(name), orders!inner(order_number, created_at, client_id)")
    .eq("garment_type", garmentType)
    .eq("orders.client_id", clientId)
    .not("notes", "is", null)
    .order("created_at", { referencedTable: "orders", ascending: false })
    .limit(limit * 3);

  const seen = new Set<string>();
  const specs: GarmentSpecRef[] = [];

  for (const row of data ?? []) {
    const spec = (row.notes ?? "").trim();
    if (!spec) continue;
    const key = spec.toLowerCase();
    // El mismo texto repetido en varios pedidos es una sola sugerencia útil.
    if (seen.has(key)) continue;
    seen.add(key);

    const order = row.orders as unknown as { order_number: string | null; created_at: string };
    const fabric = row.fabrics as unknown as { name: string } | null;
    specs.push({
      orderNumber: order?.order_number ?? null,
      createdAt: order?.created_at ?? "",
      fabricName: fabric?.name ?? null,
      spec,
    });
    if (specs.length >= limit) break;
  }

  return specs;
}

/**
 * Otros clientes cuyo cuerpo cabe en el mismo molde para esta prenda.
 *
 * Sirve para cuando una prenda ya cortada se cae (el cliente no la recoge, se
 * arrepiente): en vez de perderla, se busca a quién más le sirve.
 */
export async function findMoldMatches(
  garmentType: GarmentType,
  measurements: Record<string, number>,
  excludeClientId: string | null,
  limit = 6
): Promise<MoldMatch[]> {
  const supabase = await createClient();

  const { data } = await supabase
    .from("client_measurements")
    .select("client_id, values, clients!inner(full_name, deleted_at)")
    .eq("garment_type", garmentType)
    .eq("source", "profile")
    .eq("is_latest", true);

  const matches: MoldMatch[] = [];

  for (const row of data ?? []) {
    if (row.client_id === excludeClientId) continue;
    const client = row.clients as unknown as { full_name: string; deleted_at: string | null };
    if (!client || client.deleted_at) continue;

    const result = compareMeasurements(
      garmentType,
      measurements,
      row.values as Record<string, number>
    );
    if (!result || !isMoldMatch(result)) continue;

    matches.push({
      clientId: row.client_id,
      fullName: client.full_name,
      averageDeltaCm: result.averageDeltaCm,
      maxDeltaCm: result.maxDeltaCm,
      comparedFields: result.comparedFields,
    });
  }

  matches.sort((a, b) => a.averageDeltaCm - b.averageDeltaCm);
  return matches.slice(0, limit);
}

export interface CreateOrderInput {
  clientId: string;
  locationId: string;
  expectedDeliveryDate?: string;
  notes?: string;
  advancePayment?: number;
  /** Medio por el que entró el abono; de él sale la comisión. */
  advanceChannelId?: string | null;
  /** Método suelto, para cuando todavía no hay canales configurados. */
  advanceMethod?: PaymentMethod | null;
  discount?: number;
  items: OrderItemInput[];
}

export async function createOrder(input: CreateOrderInput) {
  const session = await requireStaffSession();
  const supabase = await createClient();

  const { clientId, locationId } = input;
  const expectedDeliveryDate = input.expectedDeliveryDate ?? "";
  const notes = (input.notes ?? "").trim();
  const advancePayment = input.advancePayment ?? 0;
  const discount = input.discount ?? 0;
  const items = input.items;

  if (!clientId || !locationId) {
    throw new Error("Selecciona un cliente y una sede.");
  }

  if (items.length === 0) {
    throw new Error("Agrega al menos una prenda a la orden.");
  }

  const { data: order, error: orderError } = await supabase
    .from("orders")
    .insert({
      client_id: clientId,
      location_id: locationId,
      expected_delivery_date: expectedDeliveryDate || null,
      notes: notes || null,
      discount,
      created_by: session.userId,
    })
    .select("*")
    .single();

  if (orderError || !order) throw new Error(orderError?.message ?? "No se pudo crear la orden.");

  for (const item of items) {
    let measurementId: string | null = null;

    if (Object.keys(item.measurements).length > 0) {
      const { data: profileMeasurement } = await supabase
        .from("client_measurements")
        .insert({
          client_id: clientId,
          garment_type: item.garmentType,
          values: item.measurements,
          unit: item.measurementUnit,
          source: "profile",
          taken_by: session.userId,
        })
        .select("id")
        .single();

      const { data: snapshot } = await supabase
        .from("client_measurements")
        .insert({
          client_id: clientId,
          garment_type: item.garmentType,
          values: item.measurements,
          unit: item.measurementUnit,
          source: "order_snapshot",
          order_id: order.id,
          taken_by: session.userId,
        })
        .select("id")
        .single();

      measurementId = snapshot?.id ?? profileMeasurement?.id ?? null;
    }

    await supabase.from("order_items").insert({
      order_id: order.id,
      garment_type: item.garmentType,
      fabric_id: item.fabricId,
      garment_model_id: item.garmentModelId,
      measurement_id: measurementId,
      quantity: item.quantity,
      unit_price: item.unitPrice,
      notes: item.notes || null,
    });
  }

  if (advancePayment > 0) {
    const advanceChannelId = input.advanceChannelId ?? null;
    // El canal define método y comisión; el trigger la congela al insertar.
    const method = advanceChannelId
      ? ((
          await supabase
            .from("payment_channels")
            .select("method")
            .eq("id", advanceChannelId)
            .single()
        ).data?.method ?? "cash")
      : (input.advanceMethod ?? "cash");

    await supabase.from("payments").insert({
      order_id: order.id,
      amount: advancePayment,
      currency: order.currency ?? "USD",
      method: method as PaymentMethod,
      channel_id: advanceChannelId,
      recorded_by: session.userId,
      notes: "Anticipo al crear la orden",
    });
  }

  try {
    const { data: client } = await supabase.from("clients").select("full_name, email").eq("id", clientId).single();
    const { data: location } = await supabase.from("locations").select("name").eq("id", locationId).single();
    const { data: freshOrder } = await supabase.from("orders").select("total, currency, order_number").eq("id", order.id).single();

    if (client?.email && freshOrder) {
      const orderNumber = freshOrder.order_number ?? order.id;
      const itemsSummary = items.map(
        (item) => `${item.quantity}x ${GARMENT_TYPE_LABELS[item.garmentType]}`,
      );

      /*
       * Salen dos correos y no uno. El de confirmación es el comprobante —
       * lleva prendas, entrega estimada y total—; el de agradecimiento es el
       * gesto de marca y deliberadamente no lleva cifras ni medidas. Son
       * registros distintos y mezclarlos convierte el agradecimiento en
       * factura. Cada uno se puede apagar por separado desde /correos.
       */
      await Promise.all([
        sendSystemEmail({
          templateKey: "order_confirmation",
          to: client.email,
          orderId: order.id,
          triggeredBy: session.userId,
          render: (override) =>
            orderConfirmationClientEmail(
              {
                clientName: client.full_name,
                orderNumber,
                locationName: location?.name ?? "",
                itemsSummary,
                expectedDeliveryLabel: expectedDeliveryDate || undefined,
                totalLabel: formatCurrency(freshOrder.total, freshOrder.currency ?? "USD"),
              },
              override,
            ),
        }),
        sendSystemEmail({
          templateKey: "order_thank_you",
          to: client.email,
          orderId: order.id,
          triggeredBy: session.userId,
          render: (override) =>
            orderThankYouClientEmail(
              {
                clientName: client.full_name,
                orderNumber,
                locationName: location?.name ?? "",
                garmentsSummary: itemsSummary,
                expectedDeliveryLabel: expectedDeliveryDate || undefined,
              },
              override,
            ),
        }),
      ]);
    }
  } catch (error) {
    console.error("[orders] fallo al enviar correo de confirmación de orden", error);
  }

  /*
   * La orden de trabajo sale aparte de los correos al cliente: va a otra gente
   * (taller, proveedor de tela), no depende de que el cliente tenga correo, y
   * es la que de verdad pone la orden en marcha.
   */
  try {
    await sendWorkshopOrderEmails({
      orderId: order.id,
      locationId,
      triggeredBy: session.userId,
    });
  } catch (error) {
    console.error("[orders] fallo al enviar la orden de trabajo", error);
  }

  revalidatePath("/orders");
  redirect(`/orders/${order.id}`);
}

/* ------------------------------------------------------------------------- *
 * Digitalización de órdenes históricas
 * ------------------------------------------------------------------------- */

/** Marca en notas para distinguir lo digitalizado a mano de lo nacido en el sistema. */
const DIGITIZED_NOTE = "Orden digitalizada desde registro histórico.";

/**
 * Fecha (YYYY-MM-DD) → instante al mediodía UTC.
 *
 * Un pago histórico no tiene hora, solo día. Guardarlo a medianoche haría que
 * en Bogotá/Panamá (UTC-5) se muestre el día anterior; el mediodía deja el
 * mismo día en cualquier huso de América y en UTC.
 */
function dateToInstant(date: string): string {
  return `${date}T12:00:00.000Z`;
}

function roundMoney(value: number): number {
  return Math.round(value * 100) / 100;
}

export interface DigitizeLineInput {
  /** Prenda que ya existe en la orden; null si es una línea nueva. */
  itemId: string | null;
  garmentType: GarmentType;
  quantity: number;
  /** Precio por unidad. Dos sacos del mismo pedido pueden valer distinto. */
  unitPrice: number;
}

export interface DigitizePaymentInput {
  amount: number;
  /** Medio por el que entró: de él sale la comisión que se congela. */
  channelId: string | null;
  /** Método suelto, para cuando todavía no hay canales configurados. */
  method?: PaymentMethod | null;
  /** YYYY-MM-DD. */
  paidAt: string;
  /** 'inicio' = abono al tomar la orden · 'final' = saldo a la entrega. */
  stage: PaymentStage;
}

export type PaymentStage = "inicio" | "final";

const STAGE_NOTES: Record<PaymentStage, string> = {
  inicio: "Abono inicial (orden digitalizada)",
  final: "Pago final (orden digitalizada)",
};

export interface DigitizeOrderInput {
  clientId: string;
  /** Orden que ya existe en el sistema y a la que se le registra el dinero. */
  orderId: string | null;
  /** Datos de identidad cuando la orden no existe y hay que crearla. */
  newOrder: {
    locationId: string;
    /** YYYY-MM-DD: el día en que se tomó la orden. */
    orderDate: string;
  } | null;
  /** Asesor que hizo la venta. */
  assignedStaffId: string | null;
  /** Las prendas con su precio. El total de la orden es su suma. */
  lines: DigitizeLineInput[];
  /** Los pagos que ya ocurrieron, cada uno con su fecha y su medio. */
  payments: DigitizePaymentInput[];
}

export type DigitizeOrderResult =
  | { ok: true; orderId: string; orderNumber: string | null; total: number; paidAmount: number }
  | { ok: false; error: string };

/**
 * Registra en el sistema una orden que ya ocurrió en papel, con el dinero que
 * ya entró por ella.
 *
 * Existe porque el import histórico trajo las órdenes sin plata: número,
 * cliente y prendas sí, valores y abonos no. Sin esto, poblar las entradas de
 * dinero obligaría a recrear cada orden desde el asistente completo (medidas,
 * telas, modelos) para llegar a lo único que falta: cuánto costó cada pieza y
 * cuándo pagaron.
 *
 * El precio se recibe por prenda y no como un total suelto: una orden de dos
 * sacos y una camisa tiene tres precios distintos, y repartir un total entre
 * ellas a partes iguales inventaría números que después nadie puede auditar.
 *
 * Devuelve el error en el resultado en vez de lanzarlo porque en producción
 * Next enmascara los mensajes de las excepciones de server actions, y estos
 * son mensajes que el sastre necesita leer.
 */
export async function digitizeOrder(input: DigitizeOrderInput): Promise<DigitizeOrderResult> {
  const session = await requireStaffSession();
  const supabase = await createClient();

  const lines = input.lines.filter((line) => line.quantity > 0);
  if (lines.length === 0) {
    return { ok: false, error: "Agrega al menos una prenda con su precio." };
  }

  const total = roundMoney(
    lines.reduce((sum, line) => sum + line.quantity * roundMoney(line.unitPrice), 0)
  );
  if (!(total > 0)) {
    return { ok: false, error: "Ponle precio a por lo menos una prenda." };
  }

  const payments = input.payments.filter((payment) => roundMoney(payment.amount) > 0);
  const paidAmount = roundMoney(
    payments.reduce((sum, payment) => sum + roundMoney(payment.amount), 0)
  );

  for (const payment of payments) {
    if (!payment.paidAt) return { ok: false, error: "Cada pago necesita su fecha." };
  }

  let orderId = input.orderId;

  if (orderId) {
    const { data: order } = await supabase
      .from("orders")
      .select("id, client_id")
      .eq("id", orderId)
      .single();

    if (!order) return { ok: false, error: "No encontramos esa orden." };
    if (order.client_id !== input.clientId) {
      return { ok: false, error: "Esa orden pertenece a otro cliente." };
    }

    if (input.assignedStaffId) {
      const { error } = await supabase
        .from("orders")
        .update({ assigned_staff_id: input.assignedStaffId })
        .eq("id", orderId);
      if (error) return { ok: false, error: error.message };
    }
  } else {
    const draft = input.newOrder;
    if (!draft) return { ok: false, error: "Falta la información de la orden." };
    if (!draft.locationId) return { ok: false, error: "Selecciona la sede de la orden." };
    if (!draft.orderDate) return { ok: false, error: "Escribe la fecha de la orden." };

    const today = new Date().toISOString().slice(0, 10);
    const { data: order, error: orderError } = await supabase
      .from("orders")
      .insert({
        client_id: input.clientId,
        location_id: draft.locationId,
        // Una orden con fecha pasada ya se entregó; una de hoy sigue viva.
        status: (draft.orderDate < today ? "delivered" : "in_production") as OrderStatus,
        created_at: dateToInstant(draft.orderDate),
        expected_delivery_date: draft.orderDate,
        assigned_staff_id: input.assignedStaffId,
        notes: DIGITIZED_NOTE,
        created_by: session.userId,
      })
      .select("id")
      .single();

    if (orderError || !order) {
      return { ok: false, error: orderError?.message ?? "No se pudo crear la orden." };
    }

    orderId = order.id;
  }

  /*
   * Las prendas que ya existían se actualizan; las nuevas se insertan. No se
   * borra ninguna: una pieza del histórico que el sastre no reconoce es un
   * dato para revisar, no para hacer desaparecer desde un diálogo de captura.
   */
  for (const line of lines) {
    const unitPrice = roundMoney(line.unitPrice);

    if (line.itemId) {
      const { error } = await supabase
        .from("order_items")
        .update({
          garment_type: line.garmentType,
          quantity: line.quantity,
          unit_price: unitPrice,
          item_discount: 0,
        })
        .eq("id", line.itemId)
        .eq("order_id", orderId);
      if (error) return { ok: false, error: error.message };
    } else {
      const { error } = await supabase.from("order_items").insert({
        order_id: orderId,
        garment_type: line.garmentType,
        quantity: line.quantity,
        unit_price: unitPrice,
      });
      if (error) return { ok: false, error: error.message };
    }
  }

  const { data: freshOrder } = await supabase
    .from("orders")
    .select("order_number, currency")
    .eq("id", orderId)
    .single();

  /*
   * Cada pago entra como su propia fila: un abono de enero cobrado en efectivo
   * y el saldo de marzo por datáfono son dos entradas de dinero en dos meses
   * distintos, con dos comisiones distintas. Colapsarlos en un solo pago
   * borraría justamente lo que hace útil el histórico.
   */
  for (const payment of payments) {
    const channelId = payment.channelId;
    const method = channelId
      ? ((
          await supabase.from("payment_channels").select("method").eq("id", channelId).single()
        ).data?.method ?? "cash")
      : (payment.method ?? "cash");

    const { error } = await supabase.from("payments").insert({
      order_id: orderId,
      amount: roundMoney(payment.amount),
      currency: freshOrder?.currency ?? "USD",
      method: method as PaymentMethod,
      channel_id: channelId || null,
      paid_at: dateToInstant(payment.paidAt),
      // Quien digita, no quien vendió: el asesor de la venta va en la orden
      // (assigned_staff_id) y este campo es rastro de auditoría de la captura.
      recorded_by: session.userId,
      notes: STAGE_NOTES[payment.stage],
    });
    if (error) return { ok: false, error: error.message };
  }

  revalidatePath(`/clients/${input.clientId}`);
  revalidatePath(`/orders/${orderId}`);
  revalidatePath("/orders");
  revalidatePath("/finance");
  revalidatePath("/finance/payments");
  revalidatePath("/finance/cobrar");

  return {
    ok: true,
    orderId,
    orderNumber: freshOrder?.order_number ?? null,
    total,
    paidAmount,
  };
}

export async function updateOrderStatus(orderId: string, status: OrderStatus) {
  const session = await requireStaffSession();
  const supabase = await createClient();

  const { data: previous } = await supabase.from("orders").select("status").eq("id", orderId).single();

  await supabase.from("orders").update({ status }).eq("id", orderId);

  // Reordenar la misma etapa dos veces no debe volver a escribirle al cliente.
  if (previous?.status !== status) {
    await notifyOrderStatusChange(orderId, status, session.userId);

    /*
     * Al confirmar, el taller recibe la orden de trabajo otra vez.
     *
     * No es un duplicado por descuido: la que salió al crear la orden es un
     * borrador que todavía puede cambiar, y esta es la versión en firme. El
     * documento lleva el estado impreso justamente para que el sastre sepa
     * cuál de las dos hojas manda.
     */
    if (status === "confirmed") {
      try {
        const { data: order } = await supabase
          .from("orders")
          .select("location_id")
          .eq("id", orderId)
          .single();

        await sendWorkshopOrderEmails({
          orderId,
          locationId: order?.location_id ?? null,
          triggeredBy: session.userId,
        });
      } catch (error) {
        console.error("[orders] fallo al reenviar la orden de trabajo al confirmar", error);
      }
    }
  }

  revalidatePath(`/orders/${orderId}`);
  revalidatePath("/orders");
}

/**
 * Avisa al cliente que su orden avanzó de etapa.
 *
 * "Lista para entrega" tiene correo propio en vez de reusar el de estado: es
 * el único cambio que le pide algo al cliente —venir a la sede—, y para eso
 * necesita dirección, horario y saldo pendiente. Mandar eso con la plantilla
 * genérica de estado dejaría a alguien sabiendo que su traje está listo pero
 * no dónde recogerlo.
 */
async function notifyOrderStatusChange(
  orderId: string,
  status: OrderStatus,
  triggeredBy: string,
) {
  if (!ORDER_STATUS_NOTIFIABLE[status]) return;

  try {
    const supabase = await createClient();
    const { data: order } = await supabase
      .from("orders")
      .select(
        "order_number, expected_delivery_date, total, currency, clients(full_name, email), locations(name, address)",
      )
      .eq("id", orderId)
      .single();

    if (!order) return;

    const client = order.clients as unknown as { full_name: string; email: string | null } | null;
    const location = order.locations as unknown as { name: string; address: string | null } | null;
    if (!client?.email) return;

    const orderNumber = order.order_number ?? orderId;
    const currency = order.currency ?? "USD";

    if (status === "ready_for_delivery") {
      const [{ data: items }, { data: payments }] = await Promise.all([
        supabase
          .from("order_items")
          .select("quantity, garment_type, fabrics(name)")
          .eq("order_id", orderId),
        supabase.from("payments").select("amount").eq("order_id", orderId),
      ]);

      const totalPaid = (payments ?? []).reduce((sum, payment) => sum + payment.amount, 0);
      const balance = Math.max(order.total - totalPaid, 0);

      const garmentsSummary = (items ?? []).map((item) => {
        const fabric = item.fabrics as unknown as { name: string } | null;
        const label = `${item.quantity}x ${GARMENT_TYPE_LABELS[item.garment_type]}`;
        return fabric?.name ? `${label} — ${fabric.name}` : label;
      });

      await sendSystemEmail({
        templateKey: "order_ready_for_delivery",
        to: client.email,
        orderId,
        triggeredBy,
        render: (override) =>
          orderReadyForDeliveryClientEmail(
            {
              clientName: client.full_name,
              orderNumber,
              locationName: location?.name ?? "",
              locationAddress: location?.address,
              garmentsSummary,
              balanceLabel: balance > 0 ? formatCurrency(balance, currency) : null,
            },
            override,
            { bookingUrl: bookingUrl() },
          ),
      });
      return;
    }

    await sendSystemEmail({
      templateKey: "order_status_update",
      to: client.email,
      orderId,
      triggeredBy,
      render: (override) =>
        orderStatusUpdateClientEmail(
          {
            clientName: client.full_name,
            orderNumber,
            statusLabel: ORDER_STATUS_LABELS[status],
            statusDetail: ORDER_STATUS_CLIENT_DETAIL[status],
            locationName: location?.name,
            expectedDeliveryLabel: order.expected_delivery_date,
          },
          override,
        ),
    });
  } catch (error) {
    // El estado ya cambió en la base: el correo es un extra, no la operación.
    console.error("[orders] fallo al notificar el cambio de estado", error);
  }
}

/**
 * Convierte la fecha del formulario (`YYYY-MM-DD`) en el instante que se guarda
 * en `payments.paid_at`.
 *
 * Se ancla a mediodía UTC, no a medianoche: Bogotá y Panamá están en UTC-5, así
 * que un `2026-08-13T00:00:00Z` se lee como el 12 de agosto en pantalla y el
 * pago aparecería un día antes del que el sastre escribió. Mediodía deja el día
 * calendario intacto en todo el huso horario del negocio.
 *
 * Si la fecha es la de hoy devuelve null para que mande el `default now()` de la
 * tabla: un cobro de hoy merece su hora real, que es dato de auditoría.
 */
function parsePaidAt(raw: FormDataEntryValue | null): string | null {
  const value = String(raw ?? "").trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;

  const today = new Date().toISOString().slice(0, 10);
  if (value === today) return null;

  const parsed = new Date(`${value}T12:00:00.000Z`);
  if (Number.isNaN(parsed.getTime())) return null;
  if (parsed.getTime() > Date.now()) {
    throw new Error("La fecha del pago no puede estar en el futuro.");
  }

  return parsed.toISOString();
}

export async function registerPayment(orderId: string, formData: FormData) {
  const session = await requireStaffSession();
  const supabase = await createClient();

  const amount = parseAmount(String(formData.get("amount") ?? ""));
  const channelId = String(formData.get("channelId") ?? "").trim();
  const reference = String(formData.get("reference") ?? "").trim();
  const paidAt = parsePaidAt(formData.get("paidAt"));

  if (amount <= 0) throw new Error("El monto debe ser mayor a cero.");

  const { data: order } = await supabase.from("orders").select("currency").eq("id", orderId).single();
  if (!order) throw new Error("Orden no encontrada.");

  /*
   * El método sale del canal, no del formulario: el canal es lo que el sastre
   * elige ("Datáfono Bold") y de él cuelgan tanto el método como la comisión,
   * que el trigger payments_set_channel_fee congela al insertar.
   */
  const method = channelId
    ? ((
        await supabase.from("payment_channels").select("method").eq("id", channelId).single()
      ).data?.method ?? "cash")
    : ((String(formData.get("method") ?? "cash") as PaymentMethod) ?? "cash");

  await supabase.from("payments").insert({
    order_id: orderId,
    amount,
    currency: order.currency ?? "USD",
    method: method as PaymentMethod,
    channel_id: channelId || null,
    reference: reference || null,
    recorded_by: session.userId,
    ...(paidAt ? { paid_at: paidAt } : {}),
  });

  revalidatePath(`/orders/${orderId}`);
  revalidatePath("/finance");
  revalidatePath("/finance/payments");
  revalidatePath("/finance/reportes");
}

/**
 * Envía el resumen de orden por correo al cliente — sin medidas corporales.
 */
export async function sendOrderSummaryEmail(orderId: string) {
  const session = await requireStaffSession();
  const supabase = await createClient();

  const { data: order } = await supabase
    .from("orders")
    .select("*, clients(full_name, email), locations(name)")
    .eq("id", orderId)
    .single();
  if (!order) throw new Error("Orden no encontrada.");

  const client = order.clients as unknown as { full_name: string; email: string | null } | null;
  const location = order.locations as unknown as { name: string } | null;

  if (!client?.email) {
    throw new Error("El cliente no tiene correo registrado.");
  }

  const [{ data: items }, { data: payments }] = await Promise.all([
    supabase
      .from("order_items")
      .select("garment_type, quantity, unit_price, line_total, notes, fabrics(name, code), garment_models(name)")
      .eq("order_id", orderId),
    supabase.from("payments").select("amount").eq("order_id", orderId),
  ]);

  const currency = order.currency ?? "USD";
  const totalPaid = (payments ?? []).reduce((sum, payment) => sum + payment.amount, 0);
  const balance = Math.max(order.total - totalPaid, 0);

  const garments = (items ?? []).map((item) => {
    const fabric = item.fabrics as unknown as { name: string; code: string | null } | null;
    const model = item.garment_models as unknown as { name: string } | null;
    return {
      label: `${item.quantity}x ${GARMENT_TYPE_LABELS[item.garment_type]}`,
      fabricLabel: model?.name
        ? `${fabric?.name ?? "Tela por definir"} · ${model.name}`
        : (fabric?.name ?? "Tela por definir"),
      styleNotes: item.notes,
      lineTotalLabel: formatCurrency(item.line_total, currency),
    };
  });

  const result = await sendSystemEmail({
    templateKey: "order_summary",
    to: client.email,
    orderId,
    triggeredBy: session.userId,
    render: (override) =>
      orderSummaryClientEmail(
        {
          clientName: client.full_name,
          orderNumber: order.order_number ?? order.id,
          locationName: location?.name ?? "",
          garments,
          subtotalLabel: formatCurrency(order.subtotal, currency),
          discountLabel: order.discount > 0 ? formatCurrency(order.discount, currency) : undefined,
          totalLabel: formatCurrency(order.total, currency),
          totalPaidLabel: formatCurrency(totalPaid, currency),
          balanceLabel: formatCurrency(balance, currency),
          expectedDeliveryLabel: order.expected_delivery_date,
          orderNotes: order.notes,
        },
        override,
      ),
  });

  /*
   * Este envío sí propaga el error, al revés que los automáticos: lo disparó
   * un sastre pulsando un botón y esperando ver algo pasar. Un fallo silencioso
   * acá lo deja creyendo que el cliente recibió el resumen.
   */
  if (!result.ok) {
    throw new Error(result.error ?? "No se pudo enviar el resumen.");
  }
}

/**
 * Reenvía el agradecimiento de compra.
 *
 * Existe porque el automático se manda una sola vez, al crear la orden, y a
 * veces no llega: el cliente dio mal el correo, o lo cazó su filtro de spam.
 * Sin esto la única salida era crear una orden falsa.
 */
export async function sendOrderThankYouEmail(orderId: string) {
  const session = await requireStaffSession();
  const supabase = await createClient();

  const { data: order } = await supabase
    .from("orders")
    .select(
      "order_number, expected_delivery_date, clients(full_name, email), locations(name), order_items(quantity, garment_type, fabrics(name))",
    )
    .eq("id", orderId)
    .single();

  if (!order) throw new Error("Orden no encontrada.");

  const client = order.clients as unknown as { full_name: string; email: string | null } | null;
  const location = order.locations as unknown as { name: string } | null;
  const items = order.order_items as unknown as Array<{
    quantity: number;
    garment_type: GarmentType;
    fabrics: { name: string } | null;
  }> | null;

  if (!client?.email) throw new Error("El cliente no tiene correo registrado.");

  const result = await sendSystemEmail({
    templateKey: "order_thank_you",
    to: client.email,
    orderId,
    triggeredBy: session.userId,
    force: true,
    render: (override) =>
      orderThankYouClientEmail(
        {
          clientName: client.full_name,
          orderNumber: order.order_number ?? orderId,
          locationName: location?.name ?? "",
          garmentsSummary: (items ?? []).map((item) => {
            const label = `${item.quantity}x ${GARMENT_TYPE_LABELS[item.garment_type]}`;
            return item.fabrics?.name ? `${label} — ${item.fabrics.name}` : label;
          }),
          expectedDeliveryLabel: order.expected_delivery_date,
        },
        override,
      ),
  });

  if (!result.ok) {
    throw new Error(result.error ?? "No se pudo enviar el agradecimiento.");
  }
}

/**
 * Reenvía la orden de trabajo al taller.
 *
 * Devuelve a quién llegó y a quién no, en vez de un "listo" a secas: cuando el
 * sastre dice que no le llegó, lo que hace falta saber es si el problema fue
 * el envío o es que nunca estuvo configurado como destinatario.
 */
export async function resendWorkshopOrder(orderId: string) {
  const session = await requireStaffSession();
  const supabase = await createClient();

  const { data: order } = await supabase
    .from("orders")
    .select("location_id")
    .eq("id", orderId)
    .single();

  if (!order) throw new Error("Orden no encontrada.");

  const result = await sendWorkshopOrderEmails({
    orderId,
    locationId: order.location_id,
    triggeredBy: session.userId,
    force: true,
  });

  if (result.recipients.length === 0) {
    throw new Error(
      "No hay nadie configurado para recibir la orden de trabajo. Agrégalo en Correos → Destinatarios.",
    );
  }

  return result;
}

/* ------------------------------------------------------------------------ *
 * Edición de una orden ya creada
 *
 * Hasta ahora una orden era inmutable: se creaba y no se volvía a tocar. Eso
 * dejó dos agujeros que el negocio sí tiene. El primero es el histórico
 * importado —más de mil órdenes que llegaron sin precio— que aparece en $0 y
 * arrastra el panel financiero a cero; no se borra, se le carga el valor a mano
 * cuando exista el dato. El segundo es que la sastrería no vende en un solo
 * acto: en una prueba el cliente suma una camisa, o a la semana cancela una de
 * las cinco que pidió, y esa orden tiene que poder moverse.
 *
 * Los totales no se escriben aquí. El trigger `trg_order_items_recalc` (0014)
 * recalcula subtotal y total de la orden ante cualquier insert/update/delete de
 * sus piezas, así que la acción solo toca las piezas y deja que la BD sea la
 * única que sepa sumar.
 * ------------------------------------------------------------------------ */

export interface OrderItemPricingInput {
  id: string;
  quantity: number;
  unitPrice: number;
}

export interface UpdateOrderPricingInput {
  orderId: string;
  items: OrderItemPricingInput[];
  discount?: number;
  expectedDeliveryDate?: string | null;
  /**
   * Quién atendió la venta. Se separa de `created_by` a propósito: el asesor
   * puede no existir todavía como usuario cuando la orden se digita, y se
   * asigna después sin reescribir quién la cargó al sistema.
   */
  assignedStaffId?: string | null;
  notes?: string | null;
}

export async function updateOrderPricing(input: UpdateOrderPricingInput) {
  await requireStaffSession();
  const supabase = await createClient();

  const { orderId, items } = input;

  const { data: order } = await supabase
    .from("orders")
    .select("id, currency")
    .eq("id", orderId)
    .single();

  if (!order) throw new Error("Orden no encontrada.");

  for (const item of items) {
    if (!Number.isFinite(item.unitPrice) || item.unitPrice < 0) {
      throw new Error("El valor de una prenda no puede ser negativo.");
    }
    if (!Number.isInteger(item.quantity) || item.quantity < 1) {
      throw new Error("La cantidad de una prenda debe ser al menos 1.");
    }
  }

  const discount = input.discount ?? 0;
  if (!Number.isFinite(discount) || discount < 0) {
    throw new Error("El descuento no puede ser negativo.");
  }

  /*
   * Las piezas se actualizan una por una y no en un solo upsert: `order_items`
   * tiene columnas generadas (`line_total`) y un trigger de validación por
   * tipo de prenda, y un upsert masivo con filas parciales las pisaría.
   */
  for (const item of items) {
    const { error } = await supabase
      .from("order_items")
      .update({ quantity: item.quantity, unit_price: item.unitPrice })
      .eq("id", item.id)
      .eq("order_id", orderId);

    if (error) throw new Error(`No se pudo actualizar la prenda: ${error.message}`);
  }

  const orderPatch: {
    discount: number;
    expected_delivery_date?: string | null;
    assigned_staff_id?: string | null;
    notes?: string | null;
  } = { discount };

  if (input.expectedDeliveryDate !== undefined) {
    orderPatch.expected_delivery_date = input.expectedDeliveryDate || null;
  }
  if (input.assignedStaffId !== undefined) {
    orderPatch.assigned_staff_id = input.assignedStaffId || null;
  }
  if (input.notes !== undefined) {
    orderPatch.notes = (input.notes ?? "").trim() || null;
  }

  const { error: orderError } = await supabase
    .from("orders")
    .update(orderPatch)
    .eq("id", orderId);

  if (orderError) throw new Error(`No se pudo actualizar la orden: ${orderError.message}`);

  revalidatePath(`/orders/${orderId}`);
  revalidatePath("/orders");
  revalidatePath("/finance");
  revalidatePath("/finance/reportes");
}

export interface AddOrderItemInput {
  orderId: string;
  garmentType: GarmentType;
  fabricId?: string | null;
  garmentModelId?: string | null;
  quantity: number;
  unitPrice: number;
  notes?: string | null;
}

/** Suma una prenda a una orden existente (el cliente añade en la prueba). */
export async function addOrderItem(input: AddOrderItemInput) {
  await requireStaffSession();
  const supabase = await createClient();

  if (!Number.isInteger(input.quantity) || input.quantity < 1) {
    throw new Error("La cantidad debe ser al menos 1.");
  }
  if (!Number.isFinite(input.unitPrice) || input.unitPrice < 0) {
    throw new Error("El valor de la prenda no puede ser negativo.");
  }

  const { error } = await supabase.from("order_items").insert({
    order_id: input.orderId,
    garment_type: input.garmentType,
    fabric_id: input.fabricId || null,
    garment_model_id: input.garmentModelId || null,
    quantity: input.quantity,
    unit_price: input.unitPrice,
    notes: (input.notes ?? "").trim() || null,
  });

  if (error) throw new Error(`No se pudo agregar la prenda: ${error.message}`);

  revalidatePath(`/orders/${input.orderId}`);
  revalidatePath("/orders");
  revalidatePath("/finance");
}

/**
 * Quita una prenda de la orden (el cliente cancela una de las cinco camisas).
 *
 * Se niega a dejar la orden vacía: una orden sin prendas no es una orden, es
 * basura que igual sigue apareciendo en los listados y en los reportes. Si de
 * verdad se cae toda la venta, lo correcto es cancelar la orden por estado, no
 * vaciarla pieza por pieza.
 */
export async function removeOrderItem(orderId: string, itemId: string) {
  await requireStaffSession();
  const supabase = await createClient();

  const { count } = await supabase
    .from("order_items")
    .select("id", { count: "exact", head: true })
    .eq("order_id", orderId);

  if ((count ?? 0) <= 1) {
    throw new Error(
      "Es la única prenda de la orden. Si se canceló toda la venta, cambia el estado de la orden en vez de vaciarla.",
    );
  }

  const { error } = await supabase
    .from("order_items")
    .delete()
    .eq("id", itemId)
    .eq("order_id", orderId);

  if (error) throw new Error(`No se pudo quitar la prenda: ${error.message}`);

  revalidatePath(`/orders/${orderId}`);
  revalidatePath("/orders");
  revalidatePath("/finance");
}

/**
 * Corrige la fecha de un cobro ya registrado.
 *
 * Solo admin, igual que la política `payments_update_admin` (0015): un pago es
 * un registro contable, y mover su fecha mueve el mes en que la plata se contó.
 */
export async function updatePaymentDate(paymentId: string, orderId: string, formData: FormData) {
  await requireAdminSession();
  const supabase = await createClient();

  const paidAt = parsePaidAt(formData.get("paidAt"));
  if (!paidAt) throw new Error("Escribe una fecha válida para el pago.");

  const { error } = await supabase
    .from("payments")
    .update({ paid_at: paidAt })
    .eq("id", paymentId)
    .eq("order_id", orderId);

  if (error) throw new Error(`No se pudo cambiar la fecha del pago: ${error.message}`);

  revalidatePath(`/orders/${orderId}`);
  revalidatePath("/finance");
  revalidatePath("/finance/payments");
  revalidatePath("/finance/reportes");
}

/**
 * Manda una orden a la papelera.
 *
 * No es un DELETE. Una orden cuelga pagos, correos ya enviados y el rastro de
 * la plata que entró, y `order_items` y `payments` borran en cascada desde
 * ella: un borrado real se lleva el registro financiero y no hay cómo
 * reconstruirlo. Con `deleted_at` la orden sale de listados y reportes y puede
 * volver.
 *
 * Las medidas del cliente no se tocan: viven contra el cliente, no contra la
 * orden.
 */
export async function moveOrderToTrash(orderId: string) {
  const session = await requireStaffSession();
  const supabase = await createClient();

  const { error } = await supabase
    .from("orders")
    .update({ deleted_at: new Date().toISOString(), deleted_by: session.userId })
    .eq("id", orderId);

  if (error) throw new Error(`No se pudo mover la orden a la papelera: ${error.message}`);

  revalidatePath("/orders");
  revalidatePath("/orders/papelera");
  revalidatePath("/finance");
  revalidatePath("/dashboard");
}

export async function restoreOrder(orderId: string) {
  await requireStaffSession();
  const supabase = await createClient();

  const { error } = await supabase
    .from("orders")
    .update({ deleted_at: null, deleted_by: null })
    .eq("id", orderId);

  if (error) throw new Error(`No se pudo restaurar la orden: ${error.message}`);

  revalidatePath("/orders");
  revalidatePath("/orders/papelera");
  revalidatePath("/finance");
  revalidatePath("/dashboard");
}
