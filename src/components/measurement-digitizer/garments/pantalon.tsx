"use client";

import { useMemo } from "react";
import {
  GarmentSurface,
  LatheShell,
  TaperedTube,
  usePartState,
  type GarmentProps,
  type ProfilePoint,
} from "./parts";

const WAIST_FIELDS = ["waist", "hip"];
const LEG_FIELDS = ["thigh", "knee", "hem", "inseam", "outseam"];

export function PantalonGarment({ pose, color, activeField }: GarmentProps) {
  const g = pose.garment;

  const waist = usePartState(WAIST_FIELDS, activeField);
  const leg = usePartState(LEG_FIELDS, activeField);

  /*
   * El talle (de la cintura a la entrepierna) sí es una cáscara revolucionada
   * —envuelve el cuerpo entero—, pero de la entrepierna hacia abajo son dos
   * perneras separadas. Por eso el pantalón se arma en dos piezas y no en una.
   */
  const waistTopY = g.waistY + 0.05;

  const profile = useMemo<ProfilePoint[]>(
    () => [
      [g.hipRadius, g.crotchY],
      [g.hipRadius * 1.02, g.crotchY + (waistTopY - g.crotchY) * 0.45],
      [g.waistRadius, waistTopY],
    ],
    [g.hipRadius, g.waistRadius, g.crotchY, waistTopY]
  );

  return (
    <group>
      <LatheShell profile={profile} color={color} active={waist.active} />

      {/* Pretina: la banda del cinturón remata la cintura. */}
      <mesh position={[0, waistTopY, 0]} castShadow receiveShadow>
        <cylinderGeometry args={[g.waistRadius * 1.03, g.waistRadius * 1.03, 0.035, 28, 1, true]} />
        <GarmentSurface color={color} active={waist.active} roughness={0.7} />
      </mesh>

      {(["left", "right"] as const).map((side) => {
        const x = side === "left" ? -g.legX : g.legX;
        return (
          <group key={side}>
            <TaperedTube
              x={x}
              radiusTop={g.thighRadius}
              radiusBottom={g.kneeRadius}
              y0={g.kneeY}
              y1={g.crotchY + 0.01}
              color={color}
              active={leg.active}
            />
            <TaperedTube
              x={x}
              radiusTop={g.kneeRadius}
              radiusBottom={g.legHemRadius}
              y0={g.ankleY + 0.03}
              y1={g.kneeY}
              color={color}
              active={leg.active}
            />
          </group>
        );
      })}

      {/* Costura delantera: sin ella el talle se lee como una falda. */}
      <mesh position={[0, (g.crotchY + waistTopY) / 2, g.hipRadius * 0.98]} castShadow>
        <boxGeometry args={[0.008, Math.max(waistTopY - g.crotchY, 0.02), 0.006]} />
        <GarmentSurface color={color} active={waist.active} roughness={0.6} />
      </mesh>
    </group>
  );
}
