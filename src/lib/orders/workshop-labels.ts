/**
 * Vocabulario y forma de la orden de trabajo.
 *
 * Vive aparte de las consultas (`workshop-order.ts`, marcado `server-only`)
 * porque la hoja imprimible y el editor de destinatarios son componentes de
 * cliente y necesitan estos mismos tipos y rótulos: sin la separación,
 * importar una etiqueta arrastraría el cliente de Supabase al bundle del
 * navegador — el mismo motivo por el que existe `finance/labels.ts`.
 */
import type { GarmentType, MeasurementUnit, OrderStatus, WorkshopRecipientRole } from "@/types/database.types";

export const WORKSHOP_ROLE_LABELS: Record<WorkshopRecipientRole, string> = {
  tailor: "Sastre",
  sales: "Vendedor",
  fabric_supplier: "Proveedor de tela",
};

export interface WorkshopGarment {
  id: string;
  garmentType: GarmentType;
  /** "Saco", "Pantalón"… */
  label: string;
  quantity: number;
  fabricName: string | null;
  fabricCode: string | null;
  /** Composición y proveedor: lo que hace falta para comprar la tela. */
  fabricComposition: string | null;
  fabricSupplier: string | null;
  modelName: string | null;
  /** Medidas en el orden canónico de la prenda, ya etiquetadas. */
  measurements: Array<{ label: string; value: string }>;
  measurementUnit: MeasurementUnit;
  /** El "Pedido": la especificación tal como la escribió el vendedor. */
  spec: string | null;
}

export interface WorkshopOrder {
  orderId: string;
  orderNumber: string;
  status: OrderStatus;
  statusLabel: string;
  /** Solo el nombre — nunca teléfono, cédula ni correo. */
  clientName: string;
  locationName: string;
  locationPhone: string | null;
  createdAtLabel: string;
  expectedDeliveryLabel: string | null;
  /** Próxima cita de prueba del cliente, si hay una agendada. */
  fittingDateLabel: string | null;
  /** Notas de la orden completa (no de una prenda). */
  notes: string | null;
  garments: WorkshopGarment[];
}

export interface WorkshopRecipient {
  id: string;
  locationId: string | null;
  role: WorkshopRecipientRole;
  name: string;
  email: string;
  notes: string | null;
  isActive: boolean;
}
