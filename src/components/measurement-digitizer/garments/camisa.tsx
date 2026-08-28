"use client";

import { useMemo } from "react";
import {
  Collar,
  GarmentButton,
  LatheShell,
  ShoulderCap,
  ShoulderYoke,
  TaperedTube,
  usePartState,
  type GarmentProps,
  type ProfilePoint,
} from "./parts";

const TORSO_FIELDS = ["chest", "waist", "hem_circ", "shirt_length", "back_width"];
const SLEEVE_FIELDS = ["sleeve_length", "cuff"];
const COLLAR_FIELDS = ["neck"];

const SLEEVE_SPLIT = 0.46;

/**
 * La camisa va POR DEBAJO del saco en la realidad, así que se dibuja más
 * ceñida al cuerpo que el saco: menos holgura y un bajo que no acampana.
 */
const SHIRT_TRIM = 0.94;

export function CamisaGarment({ pose, color, activeField }: GarmentProps) {
  const g = pose.garment;

  const torso = usePartState(TORSO_FIELDS, activeField);
  const sleeve = usePartState(SLEEVE_FIELDS, activeField);
  const collar = usePartState(COLLAR_FIELDS, activeField);

  const shoulderX = g.shoulderWidthM / 2;
  const sleeveTopR = g.armRadius * SHIRT_TRIM;

  /*
   * Misma silueta masculina que el saco (ver saco.tsx): hombro como punto más
   * ancho, bajo recto que nunca supera el pecho y cintura apenas insinuada.
   * Una camisa cae todavía más recta que un saco, así que se suprime menos.
   */
  const chestR = g.chestRadius * SHIRT_TRIM;
  const shoulderLineRadius = Math.max(chestR * 1.03, shoulderX - sleeveTopR * 0.9);
  const hemRadius = Math.min(g.hemRadius * SHIRT_TRIM, chestR);
  const waistRadius = g.waistRadius * SHIRT_TRIM + (chestR - g.waistRadius * SHIRT_TRIM) * 0.72;

  // La camisa se mete dentro del pantalón: el bajo no baja del talle.
  const napeY = g.shoulderY + 0.055;
  const hemY = Math.max(napeY - g.shirtLengthM, g.crotchY - 0.02);
  const waistLevel = Math.min(g.waistY + 0.05, hemY + (g.shoulderY - hemY) * 0.6);

  // Mismo cierre de hombro→cuello que el saco (ver comentario en saco.tsx):
  // sin este punto la lathe deja un boquete del ancho del hombro en vez de
  // uno del ancho del cuello, y se ve el vacío negro del interior de la
  // cáscara con el cuello del maniquí flotando dentro.
  const collarBaseRadius = g.neckRadius * 1.12;
  const shoulderSlopeRadius = shoulderLineRadius * 0.66 + collarBaseRadius * 0.34;

  const profile = useMemo<ProfilePoint[]>(
    () => [
      [hemRadius, hemY],
      [waistRadius, waistLevel],
      [chestR, g.shoulderY - 0.12],
      [shoulderLineRadius, g.shoulderY],
      [shoulderSlopeRadius, g.shoulderY + 0.014],
      [collarBaseRadius, g.shoulderY + 0.034],
    ],
    [
      hemRadius,
      waistRadius,
      chestR,
      g.shoulderY,
      shoulderLineRadius,
      hemY,
      waistLevel,
      shoulderSlopeRadius,
      collarBaseRadius,
    ]
  );

  const elbowY = g.shoulderY - g.sleeveM * SLEEVE_SPLIT;
  const wristY = g.shoulderY - g.sleeveM;
  const elbowRadius = (sleeveTopR + g.cuffRadius) / 2;
  const sleeveTopY = g.shoulderY - sleeveTopR * 0.3;

  return (
    <group>
      <LatheShell profile={profile} color={color} active={torso.active} />

      <ShoulderYoke
        width={g.shoulderWidthM}
        depth={g.chestRadius * SHIRT_TRIM * 1.85}
        y={g.shoulderY}
        color={color}
        active={torso.active}
      />

      <Collar
        y={g.shoulderY + 0.015}
        radius={g.neckRadius * 1.1}
        color={color}
        active={collar.active}
      />

      {(["left", "right"] as const).map((side) => {
        const x = side === "left" ? -shoulderX : shoulderX;
        return (
          <group key={side}>
            <ShoulderCap
              x={x}
              y={sleeveTopY}
              radius={sleeveTopR * 1.08}
              color={color}
              active={torso.active}
            />
            <TaperedTube
              x={x}
              radiusTop={sleeveTopR}
              radiusBottom={elbowRadius}
              y0={elbowY}
              y1={sleeveTopY}
              color={color}
              active={sleeve.active}
            />
            <TaperedTube
              x={x}
              radiusTop={elbowRadius}
              radiusBottom={g.cuffRadius}
              y0={wristY}
              y1={elbowY}
              color={color}
              active={sleeve.active}
            />
          </group>
        );
      })}

      {/* Tapeta: la botonadura corrida de arriba a abajo es la firma visual
          de una camisa frente a un saco. */}
      {Array.from({ length: 5 }, (_, i) => (
        <GarmentButton
          key={i}
          position={[0, g.shoulderY - 0.1 - i * ((g.shirtLengthM - 0.18) / 4), g.chestRadius * SHIRT_TRIM * 0.99]}
          color="#f0ece2"
        />
      ))}
    </group>
  );
}
