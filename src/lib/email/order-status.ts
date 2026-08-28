import type { OrderStatus } from "@/types/database.types";

/**
 * Qué estados de orden merecen un correo, y qué significa cada uno para el
 * cliente.
 *
 * No todos los cambios se avisan. `draft` es un estado interno —la orden ni
 * siquiera está en firme— y `cancelled` se maneja hablando con el cliente, no
 * mandándole un correo automático que le comunique una mala noticia sin
 * contexto ni interlocutor. Avisar de todo entrena al cliente a ignorar los
 * correos de la sastrería, que es justo lo contrario de lo que se busca.
 */
export const ORDER_STATUS_NOTIFIABLE: Record<OrderStatus, boolean> = {
  draft: false,
  confirmed: true,
  in_production: true,
  ready_for_delivery: true,
  delivered: true,
  cancelled: false,
};

/**
 * La traducción del estado interno a lo que el cliente entiende.
 *
 * "in_production" no le dice nada a quien encargó un traje; "su tela ya está
 * cortada" sí. Es la diferencia entre notificar y comunicar.
 */
export const ORDER_STATUS_CLIENT_DETAIL: Partial<Record<OrderStatus, string>> = {
  confirmed:
    "Su orden quedó confirmada y entró a la fila del taller. El siguiente paso es el corte de la tela.",
  in_production:
    "Su tela ya está cortada y las piezas entraron a confección. Es la etapa más larga del proceso: acá es donde la prenda toma forma.",
  ready_for_delivery:
    "Su prenda está terminada y lista para recogerse en la sede. Le esperamos cuando le quede cómodo.",
  delivered: "Su orden fue entregada. Fue un gusto trabajar para usted.",
};
