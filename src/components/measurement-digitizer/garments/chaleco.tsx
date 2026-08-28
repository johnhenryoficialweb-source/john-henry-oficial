"use client";

import { useMemo } from "react";
import {
  GarmentButton,
  GarmentSurface,
  LatheShell,
  usePartState,
  type GarmentProps,
  type ProfilePoint,
} from "./parts";

const TORSO_FIELDS = ["chest", "waist", "front_length", "vest_back_length", "back_width"];
const NECKLINE_FIELDS = ["neckline"];
const SHOULDER_FIELDS = ["shoulder_width"];

export function ChalecoGarment({ pose, color, activeField }: GarmentProps) {
  const g = pose.garment;

  const torso = usePartState(TORSO_FIELDS, activeField);
  const neckline = usePartState(NECKLINE_FIELDS, activeField);
  const shoulder = usePartState(SHOULDER_FIELDS, activeField);

  /*
   * El chaleco es la única prenda con dos largos distintos: delantero y
   * trasero. La cáscara revolucionada solo puede tener un bajo, así que se
   * revoluciona con el largo TRASERO (el que envuelve) y el delantero se
   * representa con la punta en V del bajo, que es donde el sastre la ve.
   */
  const backHemY = g.shoulderY - g.vestBackLengthM;
  const frontHemY = g.shoulderY - g.frontLengthM;
  const waistLevel = g.waistY + 0.05;

  const profile = useMemo<ProfilePoint[]>(
    () => [
      [g.waistRadius * 0.9, backHemY],
      [g.waistRadius, Math.max(backHemY + 0.03, waistLevel - 0.06)],
      [g.chestRadius * 0.97, g.shoulderY - 0.12],
      [g.chestRadius * 0.8, g.shoulderY],
    ],
    [g.waistRadius, g.chestRadius, g.shoulderY, backHemY, waistLevel]
  );

  const shoulderX = g.shoulderWidthM / 2;
  // El escote marca hasta dónde baja la V del frente.
  const necklineBottomY = g.shoulderY - Math.min(g.necklineM * 0.75, g.frontLengthM * 0.55);

  return (
    <group>
      <LatheShell profile={profile} color={color} active={torso.active} />

      {/* Tirantes de hombro: sin mangas, el chaleco se sostiene acá, y es lo
          que hace que `shoulder_width` tenga algo visible que mover. */}
      {(["left", "right"] as const).map((side) => {
        const x = side === "left" ? -shoulderX * 0.62 : shoulderX * 0.62;
        return (
          <mesh key={side} position={[x, g.shoulderY - 0.02, 0]} castShadow receiveShadow>
            <boxGeometry args={[g.chestRadius * 0.42, 0.06, g.chestRadius * 1.7]} />
            <GarmentSurface color={color} active={shoulder.active} />
          </mesh>
        );
      })}

      {/* La V del escote, dibujada como dos filos que bajan al frente. */}
      {(["left", "right"] as const).map((side) => {
        const mirror = side === "left" ? -1 : 1;
        return (
          <mesh
            key={side}
            position={[mirror * g.chestRadius * 0.22, (g.shoulderY + necklineBottomY) / 2, g.chestRadius * 0.92]}
            rotation={[0, 0, mirror * 0.34]}
            castShadow
          >
            <boxGeometry args={[0.026, Math.max(g.shoulderY - necklineBottomY, 0.02), 0.012]} />
            <GarmentSurface
              color={color}
              active={neckline.active}
              roughness={0.68}
            />
          </mesh>
        );
      })}

      {/* Punta en V del bajo delantero: la diferencia entre largo delantero y
          trasero se ve acá. */}
      <mesh position={[0, frontHemY + 0.03, g.waistRadius * 0.86]} rotation={[0, 0, Math.PI / 4]} castShadow>
        <boxGeometry args={[0.05, 0.05, 0.014]} />
        <GarmentSurface color={color} active={torso.active} />
      </mesh>

      {Array.from({ length: 4 }, (_, i) => (
        <GarmentButton
          key={i}
          position={[0, necklineBottomY - 0.03 - i * 0.07, g.chestRadius * 0.92]}
        />
      ))}
    </group>
  );
}
