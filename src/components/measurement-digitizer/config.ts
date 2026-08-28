import type { MeasurementUnit } from "@/types/database.types";

export const CM_PER_INCH = 2.54;

export type MeasurementAxis = "circumference" | "length";

export interface MeasurementFieldConfig {
  /**
   * Extremo bajo del rango HABITUAL, en cm. No es un tope: se dibuja como
   * banda en el slider y se avisa al salirse, pero nunca bloquea la captura.
   */
  typicalMin: number;
  /** Extremo alto del rango habitual, en cm. Tampoco bloquea. */
  typicalMax: number;
  /** Slider/stepper increment, in centimeters. */
  step: number;
  /** Sensible starting value used to render the mannequin before the field has a real value. */
  default: number;
  axis: MeasurementAxis;
}

/**
 * Límites duros de captura, iguales para todas las medidas. El rango por
 * campo de MEASUREMENT_FIELD_CONFIG describe al cliente promedio, no al
 * cliente posible: topar ahí dejaba fuera a clientes de medidas grandes
 * (un tórax de 150 cm existe aunque lo habitual sean 80–140) y obligaba a
 * anotar la medida real en observaciones. Lo único que se impide ahora es
 * lo que no es una medida: negativos y números fuera de escala humana.
 */
export const CAPTURE_MIN_CM = 0;
export const CAPTURE_MAX_CM = 200;

export function clampToCaptureRange(valueCm: number): number {
  return Math.min(CAPTURE_MAX_CM, Math.max(CAPTURE_MIN_CM, valueCm));
}

/** true cuando el valor es válido pero se sale del rango habitual del campo. */
export function isOutsideTypicalRange(field: string, valueCm: number): boolean {
  const config = MEASUREMENT_FIELD_CONFIG[field];
  if (!config) return false;
  return valueCm < config.typicalMin || valueCm > config.typicalMax;
}

/**
 * Rango HABITUAL (en cm) de cada campo de GARMENT_MEASUREMENT_FIELDS
 * (src/lib/constants.ts). Es una referencia visual y la base de la
 * estimación por altura, NO un límite de captura: la captura va siempre de
 * CAPTURE_MIN_CM a CAPTURE_MAX_CM. `axis` alimenta la geometría
 * paramétrica (pose.ts): "circumference" controla el radio de un segmento
 * del cuerpo, "length" controla el largo de un segmento o de una barra
 * guía.
 */
export const MEASUREMENT_FIELD_CONFIG: Record<string, MeasurementFieldConfig> = {
  chest: { typicalMin: 80, typicalMax: 140, step: 0.5, default: 100, axis: "circumference" },
  waist: { typicalMin: 60, typicalMax: 130, step: 0.5, default: 88, axis: "circumference" },
  hip: { typicalMin: 80, typicalMax: 140, step: 0.5, default: 100, axis: "circumference" },
  shoulder_width: { typicalMin: 38, typicalMax: 56, step: 0.5, default: 46, axis: "length" },
  shoulder_seam: { typicalMin: 11, typicalMax: 19, step: 0.5, default: 15, axis: "length" },
  sleeve_length: { typicalMin: 55, typicalMax: 70, step: 0.5, default: 63, axis: "length" },
  // "Largo" del saco (largo total de la prenda), no largo de espalda de camisa.
  back_length: { typicalMin: 66, typicalMax: 80, step: 0.5, default: 72, axis: "length" },
  neck: { typicalMin: 33, typicalMax: 48, step: 0.5, default: 39, axis: "circumference" },
  cross_back: { typicalMin: 34, typicalMax: 50, step: 0.5, default: 42, axis: "length" },
  back_width: { typicalMin: 34, typicalMax: 50, step: 0.5, default: 42, axis: "length" },
  hem_circ: { typicalMin: 88, typicalMax: 140, step: 0.5, default: 106, axis: "circumference" },
  arm_circ: { typicalMin: 26, typicalMax: 42, step: 0.5, default: 33, axis: "circumference" },
  neckline: { typicalMin: 28, typicalMax: 44, step: 0.5, default: 35, axis: "length" },
  front_length: { typicalMin: 45, typicalMax: 68, step: 0.5, default: 55, axis: "length" },
  vest_back_length: { typicalMin: 45, typicalMax: 68, step: 0.5, default: 55, axis: "length" },
  cuff: { typicalMin: 18, typicalMax: 28, step: 0.5, default: 22, axis: "circumference" },
  shirt_length: { typicalMin: 65, typicalMax: 85, step: 0.5, default: 75, axis: "length" },
  inseam: { typicalMin: 70, typicalMax: 92, step: 0.5, default: 81, axis: "length" },
  outseam: { typicalMin: 95, typicalMax: 118, step: 0.5, default: 106, axis: "length" },
  rise: { typicalMin: 22, typicalMax: 36, step: 0.5, default: 28, axis: "length" },
  thigh: { typicalMin: 45, typicalMax: 72, step: 0.5, default: 57, axis: "circumference" },
  knee: { typicalMin: 32, typicalMax: 46, step: 0.5, default: 38, axis: "circumference" },
  hem: { typicalMin: 34, typicalMax: 48, step: 0.5, default: 40, axis: "circumference" },
};

/** Altura de referencia (cm) sobre la que están calibrados los `default` de arriba. */
const REFERENCE_HEIGHT_CM = 175;

/**
 * Igual que las medidas: `min`/`max` es lo que se puede capturar y
 * `typicalMin`/`typicalMax` es solo la banda que se dibuja en el slider.
 */
export const HEIGHT_FIELD_CONFIG = {
  min: 120,
  max: 230,
  typicalMin: 150,
  typicalMax: 205,
  step: 1,
  default: REFERENCE_HEIGHT_CM,
};

/**
 * Proporción de cada medida respecto a la altura (medida/REFERENCE_HEIGHT_CM),
 * derivada de los `default` de MEASUREMENT_FIELD_CONFIG. Permite estimar un
 * juego completo de medidas razonable a partir de un solo dato (la altura),
 * para que el sastre solo tenga que hacer ajustes puntuales en vez de
 * arrancar de un maniquí genérico o en cero. Es una aproximación de
 * proporción corporal promedio, no un reemplazo de la medida real tomada
 * con cinta métrica.
 */
export function estimateMeasurementsFromHeight(heightCm: number): Record<string, number> {
  const estimate: Record<string, number> = {};
  for (const [field, config] of Object.entries(MEASUREMENT_FIELD_CONFIG)) {
    const ratio = config.default / REFERENCE_HEIGHT_CM;
    estimate[field] =
      Math.round(
        Math.min(config.typicalMax, Math.max(config.typicalMin, ratio * heightCm)) * 2
      ) / 2;
  }
  return estimate;
}

export function cmToUnit(valueCm: number, unit: MeasurementUnit): number {
  return unit === "in" ? valueCm / CM_PER_INCH : valueCm;
}

export function unitToCm(value: number, unit: MeasurementUnit): number {
  return unit === "in" ? value * CM_PER_INCH : value;
}

/** Valor de un campo en cm, resuelto a su default cuando no hay valor capturado aún. */
export function resolveFieldCm(
  field: string,
  measurements: Record<string, number>,
  unit: MeasurementUnit
): number {
  const raw = measurements[field];
  const config = MEASUREMENT_FIELD_CONFIG[field];
  if (typeof raw === "number" && raw > 0) {
    return unitToCm(raw, unit);
  }
  return config?.default ?? 0;
}
