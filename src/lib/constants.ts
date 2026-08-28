import type { GarmentType } from "@/types/database.types";

/**
 * Convención de campos de medida por tipo de prenda, almacenados en
 * client_measurements.values (jsonb). Ver supabase/migrations/0008_*.sql.
 *
 * Jerga y set de medidas tomados 1:1 de la ficha de cliente en papel/legacy
 * (una medida por prenda, nombrada como la usa el sastre) — no de una
 * convención genérica de patronaje. "Talla" y "Talle" existían como campos
 * en la ficha de Saco pero nunca se usaban (siempre vacíos), así que no se
 * migran.
 */
export const GARMENT_MEASUREMENT_FIELDS: Record<GarmentType, string[]> = {
  saco: [
    "chest", // Torax
    "back_length", // Largo
    "sleeve_length", // Manga
    "shoulder_seam", // Hombro
    "back_width", // Espalda
    "waist", // Cintura
    "hem_circ", // Base
    "shoulder_width", // Hombro A Hombro
    "arm_circ", // Contorno de Brazo
    "cuff", // Contorno de Puño
  ],
  chaleco: [
    "neckline", // Escote
    "front_length", // Largo Delantero
    "vest_back_length", // Largo Trasero
    "chest", // Pecho
    "waist", // Cintura
    "shoulder_width", // Hombro
    "back_width", // Espalda
  ],
  camisa: [
    "neck", // Cuello
    "back_width", // Espalda
    "sleeve_length", // Manga
    "shirt_length", // Largo
    "hem_circ", // Base
    "waist", // Cintura
    "chest", // Pecho
    "cuff", // Puño
  ],
  pantalon: [
    "waist", // Cintura
    "hip", // Base
    "thigh", // Muslo
    "knee", // Rodilla
    "hem", // Bota
    "outseam", // Largo
    "inseam", // Entrepierna
  ],
  otro: [],
};

/** Etiquetas legibles compartidas por el formulario 2D y el maniquí 3D. */
export const MEASUREMENT_FIELD_LABELS: Record<string, string> = {
  chest: "Pecho",
  waist: "Cintura",
  hip: "Base",
  shoulder_width: "Hombro",
  shoulder_seam: "Hombro",
  sleeve_length: "Manga",
  back_length: "Largo",
  neck: "Cuello",
  back_width: "Espalda",
  cuff: "Puño",
  shirt_length: "Largo",
  hem_circ: "Base",
  inseam: "Entrepierna",
  outseam: "Largo",
  thigh: "Muslo",
  knee: "Rodilla",
  hem: "Bota",
  arm_circ: "Contorno de Brazo",
  neckline: "Escote",
  front_length: "Largo Delantero",
  vest_back_length: "Largo Trasero",
};

/**
 * Un mismo campo puede llamarse distinto según la prenda (el pecho del saco
 * es "Torax" en la ficha, el mismo punto en camisa/chaleco es "Pecho"). Solo
 * se listan las excepciones; todo lo demás usa MEASUREMENT_FIELD_LABELS tal
 * cual.
 */
const GARMENT_FIELD_LABEL_OVERRIDES: Partial<Record<GarmentType, Record<string, string>>> = {
  saco: {
    chest: "Torax",
    shoulder_width: "Hombro A Hombro",
    cuff: "Contorno de Puño",
  },
};

export function getMeasurementFieldLabel(garmentType: GarmentType, field: string): string {
  return (
    GARMENT_FIELD_LABEL_OVERRIDES[garmentType]?.[field] ??
    MEASUREMENT_FIELD_LABELS[field] ??
    field
  );
}

export interface GarmentExtraField {
  id: string;
  label: string;
  kind: "text" | "textarea";
  help?: string;
}

/**
 * Campos "extra" de la ficha legacy que no son medidas en cm: no alimentan
 * el maniquí 3D ni MEASUREMENT_FIELD_CONFIG, viven como texto libre y se
 * guardan en order_items.notes al crear la orden. También es donde el
 * sastre anota el modelo/corte de una prenda puntual (p.ej. dos sacos del
 * mismo cliente con solapas distintas), porque en la ficha en papel esa
 * distinción siempre vivió en "Observaciones".
 */
export const GARMENT_EXTRA_FIELDS: Record<GarmentType, GarmentExtraField[]> = {
  saco: [
    { id: "initials", label: "Iniciales", kind: "text" },
    { id: "fabric_yardage", label: "Material empleado", kind: "text" },
    { id: "notes", label: "Observaciones", kind: "textarea", help: "Modelo, corte, botones, aberturas, etc." },
  ],
  camisa: [
    { id: "initials", label: "Iniciales", kind: "text" },
    { id: "fabric_yardage", label: "Material empleado", kind: "text" },
    { id: "notes", label: "Observaciones", kind: "textarea" },
  ],
  pantalon: [
    { id: "fabric_yardage", label: "Material empleado", kind: "text" },
    { id: "notes", label: "Observaciones", kind: "textarea" },
  ],
  chaleco: [
    { id: "fabric_yardage", label: "Material empleado", kind: "text" },
    { id: "notes", label: "Observaciones", kind: "textarea" },
  ],
  otro: [{ id: "notes", label: "Observaciones", kind: "textarea" }],
};

/**
 * order_items.notes es una sola columna de texto; acá se combinan los
 * campos "extra" de una pieza (Iniciales, Material empleado, Observaciones)
 * en un bloque legible para esa columna.
 */
export function formatGarmentExtraNotes(
  garmentType: GarmentType,
  extra: Record<string, string>
): string {
  return GARMENT_EXTRA_FIELDS[garmentType]
    .map((f) => [f.label, (extra[f.id] ?? "").trim()] as const)
    .filter(([, value]) => value.length > 0)
    .map(([label, value]) => `${label}: ${value}`)
    .join("\n");
}

export const GARMENT_TYPE_LABELS: Record<GarmentType, string> = {
  saco: "Saco",
  chaleco: "Chaleco",
  camisa: "Camisa",
  pantalon: "Pantalón",
  otro: "Otro",
};

/**
 * Vocabulario del formulario público de citas. Es distinto del check
 * constraint `appointments.appointment_type` (medidas/prueba/entrega/
 * consulta/otro), que describe la *etapa* del proceso, no la prenda de
 * interés. Ver SERVICE_TYPE_TO_APPOINTMENT_TYPE para el mapeo entre ambos.
 */
export const SERVICE_TYPES = [
  "saco",
  "tuxido",
  "camisa",
  "ajuste",
  "primera_consulta",
] as const;
export type ServiceType = (typeof SERVICE_TYPES)[number];

export const SERVICE_TYPE_LABELS: Record<ServiceType, string> = {
  saco: "Saco a medida",
  tuxido: "Tuxido / Esmoquin",
  camisa: "Camisa de vestir a medida",
  ajuste: "Ajuste de prenda existente",
  primera_consulta: "Primera consulta",
};

export const SERVICE_TYPE_DURATION_MINUTES: Record<ServiceType, number> = {
  saco: 60,
  tuxido: 60,
  camisa: 45,
  ajuste: 30,
  primera_consulta: 30,
};

export const SERVICE_TYPE_TO_APPOINTMENT_TYPE: Record<ServiceType, string> = {
  saco: "medidas",
  tuxido: "medidas",
  camisa: "medidas",
  ajuste: "prueba",
  primera_consulta: "consulta",
};

export const ORDER_STATUS_LABELS: Record<
  "draft" | "confirmed" | "in_production" | "ready_for_delivery" | "delivered" | "cancelled",
  string
> = {
  draft: "Orden creada",
  confirmed: "Aceptada",
  in_production: "En preparación",
  ready_for_delivery: "Lista para entrega",
  delivered: "Entregada",
  cancelled: "Cancelada",
};

export const APPOINTMENT_STATUS_LABELS: Record<
  "pending" | "confirmed" | "completed" | "cancelled" | "no_show",
  string
> = {
  pending: "Pendiente",
  confirmed: "Confirmada",
  completed: "Completada",
  cancelled: "Cancelada",
  no_show: "No asistió",
};
