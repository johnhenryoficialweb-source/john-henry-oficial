import { GARMENT_MEASUREMENT_FIELDS } from "@/lib/constants";
import type { GarmentType } from "@/types/database.types";

/**
 * Especificación de una prenda ya pedida: el texto libre que escribió el
 * sastre ("Frente sencillo, 2 Botones Tapas, Solapa clasica 7cm…").
 */
export interface GarmentSpecRef {
  orderNumber: string | null;
  createdAt: string;
  fabricName: string | null;
  spec: string;
}

export interface MoldMatch {
  clientId: string;
  fullName: string;
  /** Diferencia media en cm sobre los campos comparables. */
  averageDeltaCm: number;
  /** Peor diferencia en un solo campo. */
  maxDeltaCm: number;
  comparedFields: number;
}

/**
 * Campos que definen si dos cuerpos "caben" en la misma prenda.
 *
 * No se comparan todos: los largos (manga, largo de saco) se ajustan cortando,
 * mientras que un tórax o una cintura que no dan no tienen arreglo. Un molde
 * sirve o no sirve por los contornos.
 */
const MOLD_FIELDS: Partial<Record<GarmentType, string[]>> = {
  saco: ["chest", "waist", "hem_circ", "shoulder_width", "back_width"],
  camisa: ["neck", "chest", "waist", "back_width"],
  pantalon: ["waist", "hip", "thigh"],
  chaleco: ["chest", "waist", "back_width"],
};

export function moldFieldsFor(garmentType: GarmentType): string[] {
  const fields = MOLD_FIELDS[garmentType];
  if (fields) return fields;
  return GARMENT_MEASUREMENT_FIELDS[garmentType] ?? [];
}

/**
 * Compara dos juegos de medidas sobre los campos que deciden el calce.
 *
 * Devuelve `null` cuando no hay suficientes campos en común para opinar: decir
 * "coincide" tras comparar una sola medida sería peor que no decir nada, porque
 * el sastre lo leería como un molde válido.
 */
export function compareMeasurements(
  garmentType: GarmentType,
  a: Record<string, number>,
  b: Record<string, number>,
  minFields = 3
): { averageDeltaCm: number; maxDeltaCm: number; comparedFields: number } | null {
  const fields = moldFieldsFor(garmentType);
  const deltas: number[] = [];

  for (const field of fields) {
    const av = a[field];
    const bv = b[field];
    if (typeof av !== "number" || typeof bv !== "number" || av <= 0 || bv <= 0) continue;
    deltas.push(Math.abs(av - bv));
  }

  if (deltas.length < Math.min(minFields, fields.length)) return null;

  return {
    averageDeltaCm: deltas.reduce((s, d) => s + d, 0) / deltas.length,
    maxDeltaCm: Math.max(...deltas),
    comparedFields: deltas.length,
  };
}

/** Tolerancia por defecto: 2 cm de media y nunca más de 4 cm en un solo campo. */
export const MOLD_TOLERANCE = { averageCm: 2, maxCm: 4 };

export function isMoldMatch(
  result: { averageDeltaCm: number; maxDeltaCm: number },
  tolerance = MOLD_TOLERANCE
): boolean {
  return result.averageDeltaCm <= tolerance.averageCm && result.maxDeltaCm <= tolerance.maxCm;
}
