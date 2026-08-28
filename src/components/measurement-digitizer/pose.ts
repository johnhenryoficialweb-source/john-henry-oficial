import type { MeasurementUnit } from "@/types/database.types";
import { resolveFieldCm } from "./config";

/**
 * Convierte una geometría paramétrica de maniquí a partir de las medidas
 * capturadas. No es un modelo antropométrico exacto: las proporciones fijas
 * (alturas de torso, cabeza, etc.) son constantes de estilo pensadas para
 * que el maniquí se vea bien y reaccione con claridad a cada medida, no
 * para reproducir un cuerpo real a escala. Los valores numéricos que se
 * guardan en la orden siempre son los capturados por el usuario (cm/in),
 * nunca los derivados de esta geometría.
 */

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

/** cm de circunferencia -> radio en metros. */
const radiusM = (circumferenceCm: number) => circumferenceCm / (2 * Math.PI * 100);
const toM = (cm: number) => cm / 100;

const WAIST_BAND_H = 0.05;
const CHEST_H = 0.32;
const NECK_H = 0.08;
const HEAD_R = 0.1;
const UPPER_ARM_BASE_R = 0.045;
const ELBOW_BASE_R = 0.035;
const SLEEVE_SPLIT = 0.46;
const KNEE_FRACTION = 0.48;
const LEG_X_FACTOR = 0.55;
const HOTSPOT_GAP = 0.025;

export type HotspotKind = "circumference" | "length-front" | "length-back" | "length-point";

export interface HotspotAnchor {
  field: string;
  kind: HotspotKind;
  /** Posición del marcador clickeable, en metros, relativa al origen del maniquí. */
  position: [number, number, number];
}

export interface GuideBar {
  field: string;
  /** Centro de la barra guía. */
  center: [number, number, number];
  /** Longitud total de la barra en metros (= valor de la medida). */
  length: number;
  orientation: "vertical" | "horizontal";
}

/**
 * Medidas de PRENDA (no de cuerpo), en metros. Los segmentos del cuerpo
 * siguen usando sus propios radios: esto es lo que necesita la cáscara de
 * la prenda encima, incluidos los campos que hasta ahora no alimentaban
 * ninguna geometría (hem_circ, arm_circ, back_width, neckline).
 *
 * Todo lo que va en metros lleva sufijo `M`; lo que es radio ya está en
 * metros por definición (`radiusM()`).
 */
export interface GarmentDims {
  /** Radio del pecho de la prenda (cuerpo + holgura). */
  chestRadius: number;
  /** Radio de la cintura de la prenda. */
  waistRadius: number;
  /** Radio de la cadera/base baja. */
  hipRadius: number;
  /** hem_circ — base del saco/camisa. Distinto de `hem` (bota del pantalón). */
  hemRadius: number;
  /** arm_circ — contorno de brazo, manda el grosor de la manga en la sisa. */
  armRadius: number;
  /** cuff — puño. */
  cuffRadius: number;
  /** neck — cuello. */
  neckRadius: number;
  /** Radios de la pernera del pantalón. */
  thighRadius: number;
  kneeRadius: number;
  legHemRadius: number;
  /** back_width — ancho de espalda. */
  backWidthM: number;
  /** neckline — escote (chaleco). */
  necklineM: number;
  /** shoulder_seam — largo de hombro. */
  shoulderSeamM: number;
  /** shoulder_width — hombro a hombro. */
  shoulderWidthM: number;
  /** sleeve_length — largo de manga. */
  sleeveM: number;
  /** Largos de prenda por tipo. */
  backLengthM: number;
  shirtLengthM: number;
  frontLengthM: number;
  vestBackLengthM: number;
  /** Y de referencia donde nace el torso de la prenda (hombro) y el suelo del talle. */
  shoulderY: number;
  waistY: number;
  crotchY: number;
  kneeY: number;
  ankleY: number;
  /** Separación lateral del centro de cada pernera. */
  legX: number;
}

export interface MannequinPose {
  heightM: number;
  /** Dimensiones para vestir la figura. Ver GarmentDims. */
  garment: GarmentDims;
  head: { radius: number; y: number };
  neck: { radius: number; y0: number; y1: number };
  chest: { radiusTop: number; radiusBottom: number; y0: number; y1: number };
  waistBand: { radius: number; y0: number; y1: number };
  pelvis: { radius: number; y0: number; y1: number };
  legs: Array<{
    side: "left" | "right";
    x: number;
    thigh: { radiusTop: number; radiusBottom: number; y0: number; y1: number };
    calf: { radiusTop: number; radiusBottom: number; y0: number; y1: number };
  }>;
  arms: Array<{
    side: "left" | "right";
    x: number;
    shoulderY: number;
    upperArm: { radiusTop: number; radiusBottom: number; y0: number; y1: number };
    forearm: { radiusTop: number; radiusBottom: number; y0: number; y1: number };
  }>;
  shoes: Array<{ x: number; y: number }>;
  guideBars: GuideBar[];
  hotspots: Record<string, HotspotAnchor>;
}

export function computeMannequinPose(
  measurements: Record<string, number>,
  unit: MeasurementUnit
): MannequinPose {
  const cm = (field: string) => resolveFieldCm(field, measurements, unit);

  const chestR = radiusM(cm("chest"));
  const waistR = radiusM(cm("waist"));
  const hipR = radiusM(cm("hip"));
  const neckR = radiusM(cm("neck"));
  const cuffR = radiusM(cm("cuff"));
  const thighR = radiusM(cm("thigh"));
  const kneeR = radiusM(cm("knee"));
  const hemR = radiusM(cm("hem"));

  const inseamM = toM(cm("inseam"));
  const riseM = toM(cm("rise"));
  const outseamM = toM(cm("outseam"));
  const sleeveM = toM(cm("sleeve_length"));
  const shoulderWidthM = toM(cm("shoulder_width"));

  // Layout vertical de la pierna: el tobillo queda fijo en el piso (y=0) y
  // el resto de la pierna se ajusta con inseam/rise; outseam actúa como un
  // segundo factor que estira levemente el conjunto (cadera más alta/baja),
  // igual que en un ajuste real de sastrería donde las tres medidas se
  // validan entre sí.
  const crotchY0 = inseamM;
  const waistY0 = crotchY0 + riseM;
  const kneeY0 = crotchY0 * KNEE_FRACTION;
  const legStretch = clamp(outseamM / (waistY0 || 1), 0.85, 1.18);

  const ankleY = 0;
  const kneeY = kneeY0 * legStretch;
  const crotchY = crotchY0 * legStretch;
  const waistY = waistY0 * legStretch;

  const legX = hipR * LEG_X_FACTOR;

  const waistBandY0 = waistY;
  const waistBandY1 = waistY + WAIST_BAND_H;
  const chestY0 = waistBandY1;
  const chestY1 = chestY0 + CHEST_H;
  const neckY0 = chestY1;
  const neckY1 = neckY0 + NECK_H;
  const headY = neckY1 + HEAD_R * 0.9;

  const shoulderX = shoulderWidthM / 2;
  const shoulderY = chestY1;
  const upperArmLen = sleeveM * SLEEVE_SPLIT;
  const forearmLen = sleeveM * (1 - SLEEVE_SPLIT);
  const elbowY = shoulderY - upperArmLen;
  const wristY = elbowY - forearmLen;

  const legs: MannequinPose["legs"] = (["left", "right"] as const).map((side) => ({
    side,
    x: side === "left" ? -legX : legX,
    thigh: { radiusTop: thighR, radiusBottom: kneeR, y0: kneeY, y1: crotchY },
    calf: { radiusTop: kneeR, radiusBottom: hemR, y0: ankleY, y1: kneeY },
  }));

  const arms: MannequinPose["arms"] = (["left", "right"] as const).map((side) => ({
    side,
    x: side === "left" ? -shoulderX : shoulderX,
    shoulderY,
    upperArm: { radiusTop: UPPER_ARM_BASE_R, radiusBottom: ELBOW_BASE_R, y0: elbowY, y1: shoulderY },
    forearm: { radiusTop: ELBOW_BASE_R, radiusBottom: cuffR, y0: wristY, y1: elbowY },
  }));

  const backZ = -chestR * 0.95;
  const frontZ = chestR * 0.95;
  const hipSideZ = 0;

  const guideBars: GuideBar[] = [
    {
      field: "shoulder_width",
      center: [0, shoulderY, 0.01],
      length: shoulderWidthM,
      orientation: "horizontal",
    },
    {
      field: "back_length",
      center: [0, neckY0 - toM(cm("back_length")) / 2, backZ],
      length: toM(cm("back_length")),
      orientation: "vertical",
    },
    {
      field: "shirt_length",
      center: [0, neckY0 - toM(cm("shirt_length")) / 2, frontZ],
      length: toM(cm("shirt_length")),
      orientation: "vertical",
    },
    {
      field: "front_length",
      center: [0, chestY1 - toM(cm("front_length")) / 2, frontZ],
      length: toM(cm("front_length")),
      orientation: "vertical",
    },
    {
      field: "vest_back_length",
      center: [0, chestY1 - toM(cm("vest_back_length")) / 2, backZ],
      length: toM(cm("vest_back_length")),
      orientation: "vertical",
    },
  ];

  const hotspots: Record<string, HotspotAnchor> = {
    chest: { field: "chest", kind: "circumference", position: [0, chestY0 + CHEST_H * 0.5, chestR + HOTSPOT_GAP] },
    waist: { field: "waist", kind: "circumference", position: [0, waistBandY0 + WAIST_BAND_H / 2, waistR + HOTSPOT_GAP] },
    hip: { field: "hip", kind: "circumference", position: [0, (crotchY + waistY) / 2, hipR + HOTSPOT_GAP] },
    neck: { field: "neck", kind: "circumference", position: [0, neckY0 + NECK_H / 2, neckR + HOTSPOT_GAP] },
    cuff: { field: "cuff", kind: "circumference", position: [shoulderX, wristY, cuffR + HOTSPOT_GAP] },
    thigh: {
      field: "thigh",
      kind: "circumference",
      position: [legX + thighR + HOTSPOT_GAP, (crotchY + kneeY) / 2, 0],
    },
    knee: { field: "knee", kind: "circumference", position: [legX + kneeR + HOTSPOT_GAP, kneeY, 0] },
    hem: { field: "hem", kind: "circumference", position: [legX + hemR + HOTSPOT_GAP, ankleY + 0.03, 0] },
    shoulder_width: {
      field: "shoulder_width",
      kind: "length-point",
      position: [shoulderX + HOTSPOT_GAP, shoulderY, 0.01],
    },
    sleeve_length: { field: "sleeve_length", kind: "length-point", position: [shoulderX, wristY, cuffR + HOTSPOT_GAP] },
    back_length: { field: "back_length", kind: "length-back", position: [0, neckY0 - toM(cm("back_length")), backZ] },
    front_length: {
      field: "front_length",
      kind: "length-front",
      position: [0, chestY1 - toM(cm("front_length")), frontZ],
    },
    vest_back_length: {
      field: "vest_back_length",
      kind: "length-back",
      position: [0, chestY1 - toM(cm("vest_back_length")), backZ],
    },
    shirt_length: {
      field: "shirt_length",
      kind: "length-front",
      position: [0, neckY0 - toM(cm("shirt_length")), frontZ],
    },
    inseam: { field: "inseam", kind: "length-point", position: [legX * 0.4, ankleY + 0.02, 0] },
    outseam: {
      field: "outseam",
      kind: "length-point",
      position: [legX + thighR + HOTSPOT_GAP, (waistY + crotchY) / 2, hipSideZ],
    },
    rise: { field: "rise", kind: "length-point", position: [hipR + HOTSPOT_GAP, (crotchY + waistY) / 2, 0] },
  };

  /*
   * Holgura de prenda: la tela no se pega al cuerpo. Es un factor de estilo
   * (no antropométrico) para que la cáscara asiente por fuera de los
   * segmentos sin z-fighting y se lea como prenda, no como piel pintada.
   */
  const EASE = 1.06;

  const garment: GarmentDims = {
    chestRadius: chestR * EASE,
    waistRadius: waistR * EASE,
    hipRadius: hipR * EASE,
    hemRadius: radiusM(cm("hem_circ")) * EASE,
    armRadius: radiusM(cm("arm_circ")) * EASE,
    cuffRadius: cuffR * EASE,
    neckRadius: neckR * EASE,
    thighRadius: thighR * EASE,
    kneeRadius: kneeR * EASE,
    legHemRadius: hemR * EASE,
    backWidthM: toM(cm("back_width")),
    necklineM: toM(cm("neckline")),
    shoulderSeamM: toM(cm("shoulder_seam")),
    shoulderWidthM,
    sleeveM,
    backLengthM: toM(cm("back_length")),
    shirtLengthM: toM(cm("shirt_length")),
    frontLengthM: toM(cm("front_length")),
    vestBackLengthM: toM(cm("vest_back_length")),
    shoulderY,
    waistY,
    crotchY,
    kneeY,
    ankleY,
    legX,
  };

  return {
    heightM: headY + HEAD_R,
    garment,
    head: { radius: HEAD_R, y: headY },
    neck: { radius: neckR, y0: neckY0, y1: neckY1 },
    chest: { radiusTop: chestR, radiusBottom: waistR, y0: chestY0, y1: chestY1 },
    waistBand: { radius: waistR, y0: waistBandY0, y1: waistBandY1 },
    pelvis: { radius: hipR, y0: crotchY, y1: waistY },
    legs,
    arms,
    shoes: legs.map((leg) => ({ x: leg.x, y: 0 })),
    guideBars,
    hotspots,
  };
}
