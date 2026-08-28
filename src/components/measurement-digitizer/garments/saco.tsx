"use client";

import { useMemo } from "react";
import {
  Collar,
  GarmentButton,
  Lapel,
  LatheShell,
  ShoulderCap,
  ShoulderYoke,
  TaperedTube,
  usePartState,
  type GarmentProps,
  type ProfilePoint,
} from "./parts";

/*
 * Qué medidas describen cada parte del saco. Constantes de módulo (no arrays
 * inline) para que las referencias sean estables y `usePartState` no
 * recalcule en cada render.
 */
const TORSO_FIELDS = ["chest", "waist", "hem_circ", "back_length", "back_width"];
const SLEEVE_FIELDS = ["sleeve_length", "arm_circ", "cuff"];
const SHOULDER_FIELDS = ["shoulder_width", "shoulder_seam"];

/** Fracción del largo de manga que va del hombro al codo. */
const SLEEVE_SPLIT = 0.46;

export function SacoGarment({ pose, color, activeField }: GarmentProps) {
  const g = pose.garment;

  const torso = usePartState(TORSO_FIELDS, activeField);
  const sleeve = usePartState(SLEEVE_FIELDS, activeField);
  const shoulder = usePartState(SHOULDER_FIELDS, activeField);

  // El largo del saco se mide desde el hombro hacia abajo: por eso el bajo
  // cuelga de `shoulderY`, y subir `back_length` alarga la prenda hacia el
  // suelo en vez de mover la prenda entera.
  const shoulderX = g.shoulderWidthM / 2;

  /*
   * SILUETA DE SACO DE CABALLERO. Las tres reglas de abajo son lo que separa
   * un saco de un vestido, y las tres se habían roto a la vez: el hombro era
   * más angosto que el bajo, la cintura se marcaba como un reloj de arena y la
   * prenda llegaba a medio muslo. Eso es exactamente un vestido en línea A.
   *
   * 1. EL HOMBRO ES EL PUNTO MÁS ANCHO. En un saco lo es siempre; la prenda
   *    cuelga desde ahí. Se toma de `shoulder_width`.
   */
  const shoulderLineRadius = Math.max(g.chestRadius * 1.04, shoulderX - g.armRadius * 0.9);

  /*
   * 2. EL BAJO CAE RECTO, NUNCA MÁS ANCHO QUE EL PECHO. "Base" (hem_circ)
   *    suele venir mayor que el tórax en la ficha, pero es una medida de la
   *    prenda en plano: si se lleva literal al 3D, acampana. Se limita al
   *    pecho y la cintura se suprime solo un poco — un saco entalla, no ciñe.
   */
  const hemRadius = Math.min(g.hemRadius, g.chestRadius);
  const waistRadius = g.waistRadius + (g.chestRadius - g.waistRadius) * 0.62;

  /*
   * 3. LARGO HASTA LA ENTREPIERNA, NO AL MUSLO. "Largo" se mide desde la
   *    costura del cuello (la nuca), no desde la articulación del hombro:
   *    anclarlo en el hombro alargaba la prenda ~8 cm de más y la convertía en
   *    un abrigo. El bajo se limita además a no pasar de la rodilla.
   */
  const napeY = g.shoulderY + 0.055;
  const hemY = Math.max(napeY - g.backLengthM, g.kneeY + 0.05);
  const waistLevel = Math.min(g.waistY + 0.05, hemY + (g.shoulderY - hemY) * 0.62);

  /*
   * 4. EL HOMBRO SE CIERRA HACIA EL CUELLO, NUNCA QUEDA ABIERTO A LO ANCHO
   *    DEL HOMBRO. La lathe no tapa sus extremos: si el último punto del
   *    perfil se queda en `shoulderLineRadius` (el ancho de hombro), el
   *    "agujero" de arriba tiene ESE ancho — un boquete del tamaño del
   *    hombro en vez de un cuello — y se ve el interior sin luz de la
   *    cáscara (un vacío negro) con el cuello del maniquí flotando dentro.
   *    Un punto más que va estrechando el radio hasta el del cuello (el
   *    mismo que usa `Collar`) cierra esa meseta con una pendiente continua
   *    y deja solo el boquete angosto que el cuello necesita.
   */
  const collarBaseRadius = g.neckRadius * 1.2;
  // Punto intermedio del talud hombro→cuello. Con un solo salto de
  // `shoulderLineRadius` a `collarBaseRadius` la lathe genera un cono casi
  // horizontal: una meseta con un pliegue duro en el borde, que desde arriba
  // se lee como una tapa plana en vez de un hombro. Dos tramos lo convierten
  // en una pendiente.
  const shoulderSlopeRadius = shoulderLineRadius * 0.66 + collarBaseRadius * 0.34;

  const profile = useMemo<ProfilePoint[]>(
    () => [
      [hemRadius * 0.99, hemY],
      [hemRadius, hemY + 0.02],
      [waistRadius, waistLevel],
      [g.chestRadius, g.shoulderY - 0.12],
      [shoulderLineRadius, g.shoulderY],
      [shoulderSlopeRadius, g.shoulderY + 0.016],
      [collarBaseRadius, g.shoulderY + 0.038],
    ],
    [
      hemRadius,
      waistRadius,
      g.chestRadius,
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
  const elbowRadius = (g.armRadius + g.cuffRadius) / 2;
  /** Dónde muere el tubo de la manga = centro de la bola de manga. */
  const sleeveTopY = g.shoulderY - g.armRadius * 0.3;

  /*
   * La V de las solapas baja hasta el botón de arriba, que en un saco de dos
   * botones cae en la cintura. Referenciarla al talle y no a un valor fijo
   * mantiene la proporción cuando cambia el largo.
   */
  const lapelTopY = g.shoulderY - 0.015;
  const lapelBottomY = waistLevel + (g.shoulderY - waistLevel) * 0.18;

  return (
    <group>
      <LatheShell profile={profile} color={color} active={torso.active} />

      <ShoulderYoke
        width={g.shoulderWidthM}
        depth={g.chestRadius * 1.9}
        y={g.shoulderY}
        color={color}
        active={shoulder.active}
      />

      {/* Solapas y cuello: es lo que distingue un saco de un tubo de tela. */}
      <Collar
        y={g.shoulderY - 0.01}
        radius={g.neckRadius * 1.18}
        color={color}
        active={shoulder.active}
      />
      {(["left", "right"] as const).map((side) => (
        <Lapel
          key={side}
          side={side}
          topY={lapelTopY}
          bottomY={lapelBottomY}
          width={g.chestRadius * 0.58}
          radius={g.chestRadius}
          color={color}
          active={torso.active}
        />
      ))}

      {(["left", "right"] as const).map((side) => {
        const x = side === "left" ? -shoulderX : shoulderX;
        return (
          <group key={side}>
            {/* Bola de manga. La manga TERMINA en el centro de esta pieza (no
                en la línea de hombro): ahí es donde la cúpula es más ancha y
                se traga el disco plano con que se cierra el tubo. */}
            <ShoulderCap
              x={x}
              y={sleeveTopY}
              radius={g.armRadius * 1.08}
              color={color}
              active={shoulder.active}
            />
            <TaperedTube
              x={x}
              radiusTop={g.armRadius}
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

      {/* Botonadura de dos botones: el primero justo donde cierra la V. */}
      {[0, 1].map((i) => (
        <GarmentButton
          key={i}
          position={[0, lapelBottomY - 0.015 - i * 0.085, waistRadius * 0.99]}
        />
      ))}
    </group>
  );
}
