"use client";

import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import type { MeshStandardMaterial } from "three";
import type { MannequinPose } from "./pose";

export const BODY_COLOR = "#cfc3a3";
/**
 * Cuerpo cuando lleva prenda encima: más apagado, para que la tela sea lo que
 * se mira y el cuerpo solo dé referencia anatómica (cabeza, manos, piernas).
 */
export const BODY_COLOR_SUBDUED = "#a89e86";
export const GUIDE_COLOR = "#E8D090";
export const HIGHLIGHT_COLOR = "#f4d35e";
/**
 * Verde de "sección capturada". Vive fuera de la paleta bloqueada igual que el
 * rojo destructivo: es señalética operativa del CMS interno — le dice al sastre
 * qué parte del cuerpo ya está tomada — y no aparece en ninguna superficie
 * pública. Salvia apagado, no un verde de semáforo, para no romper el registro
 * junto al oro.
 */
export const COMPLETE_COLOR = "#6f9c7d";

/**
 * Qué segmento(s) del cuerpo se iluminan cuando el campo está activo (panel
 * abierto o chip seleccionado) — así se ve claramente QUÉ se está ajustando,
 * no solo el número. Los campos que son barra-guía (shoulder_width,
 * back_length, front_length, vest_back_length, shirt_length) se resuelven
 * comparando directamente `bar.field === activeField`, no necesitan entrada
 * aquí.
 */
const FIELD_TO_SEGMENTS: Record<string, string[]> = {
  chest: ["chest"],
  waist: ["waistBand"],
  hip: ["pelvis"],
  neck: ["neck"],
  cuff: ["leftForearm", "rightForearm"],
  thigh: ["leftThigh", "rightThigh"],
  knee: ["leftThigh", "rightThigh", "leftCalf", "rightCalf"],
  hem: ["leftCalf", "rightCalf"],
  sleeve_length: ["leftUpperArm", "rightUpperArm", "leftForearm", "rightForearm"],
  inseam: ["leftThigh", "rightThigh", "leftCalf", "rightCalf"],
  outseam: ["leftThigh", "rightThigh", "leftCalf", "rightCalf"],
  rise: ["pelvis"],
};

function Segment({
  radiusTop,
  radiusBottom,
  y0,
  y1,
  x = 0,
  z = 0,
  color = BODY_COLOR,
  active = false,
  complete = false,
}: {
  radiusTop: number;
  radiusBottom: number;
  y0: number;
  y1: number;
  x?: number;
  z?: number;
  color?: string;
  active?: boolean;
  /** Todas las medidas que describen este segmento ya están tomadas. */
  complete?: boolean;
}) {
  const materialRef = useRef<MeshStandardMaterial>(null);
  const height = Math.max(y1 - y0, 0.001);

  useFrame(({ clock }) => {
    if (!active || !materialRef.current) return;
    materialRef.current.emissiveIntensity = 0.45 + Math.sin(clock.elapsedTime * 3.2) * 0.2;
  });

  // El campo en edición manda sobre el estado capturado: mientras se ajusta hay
  // que ver QUÉ se ajusta, aunque ya tuviera valor.
  const surface = active ? HIGHLIGHT_COLOR : complete ? COMPLETE_COLOR : color;

  return (
    <mesh position={[x, (y0 + y1) / 2, z]} castShadow receiveShadow>
      <cylinderGeometry args={[Math.max(radiusTop, 0.01), Math.max(radiusBottom, 0.01), height, 24]} />
      <meshStandardMaterial
        ref={materialRef}
        color={surface}
        emissive={active ? HIGHLIGHT_COLOR : complete ? COMPLETE_COLOR : "#000000"}
        emissiveIntensity={active ? 0.5 : complete ? 0.18 : 0}
        roughness={0.85}
        metalness={0.05}
      />
    </mesh>
  );
}

function GuideBarMesh({
  center,
  length,
  orientation,
  active,
  complete,
}: {
  center: [number, number, number];
  length: number;
  orientation: "vertical" | "horizontal";
  active: boolean;
  complete: boolean;
}) {
  const materialRef = useRef<MeshStandardMaterial>(null);
  const rotation: [number, number, number] = orientation === "horizontal" ? [0, 0, Math.PI / 2] : [0, 0, 0];

  useFrame(({ clock }) => {
    if (!active || !materialRef.current) return;
    materialRef.current.emissiveIntensity = 0.65 + Math.sin(clock.elapsedTime * 3.2) * 0.25;
  });

  const surface = active ? HIGHLIGHT_COLOR : complete ? COMPLETE_COLOR : GUIDE_COLOR;

  return (
    <group position={center} rotation={rotation}>
      <mesh>
        <cylinderGeometry args={[active ? 0.012 : 0.006, active ? 0.012 : 0.006, Math.max(length, 0.001), 8]} />
        <meshStandardMaterial
          ref={materialRef}
          color={surface}
          emissive={surface}
          emissiveIntensity={active ? 0.65 : 0.35}
        />
      </mesh>
    </group>
  );
}

/**
 * Cuerpo paramétrico del maniquí: no es un asset GLB cargado, es geometría
 * generada en cada render a partir de `pose` (ver pose.ts). Esto evita
 * depender de un archivo binario externo que no existía en el repo y hace
 * que cada segmento ("hueso") escale en vivo con la medida correspondiente.
 */
/**
 * Cuánto se mete el cuerpo hacia dentro cuando lleva prenda encima. Sin este
 * margen la piel y la tela comparten superficie y pelean por el mismo pixel
 * (z-fighting): se ve un moteado que parpadea al orbitar.
 */
const BODY_INSET = 0.93;

export function MannequinFigure({
  pose,
  activeField,
  fields,
  confirmedFields,
  subdued = false,
}: {
  pose: MannequinPose;
  activeField: string | null;
  /** Campos que pide esta prenda. Un segmento solo puede completarse respecto
   *  de las medidas que realmente se le están pidiendo al sastre. */
  fields: string[];
  /**
   * Medidas CONFIRMADAS por el sastre — no las que simplemente tienen un
   * número. El maniquí arranca con una estimación por altura: si el verde
   * dependiera de "hay valor", diría que el cuerpo ya está medido cuando
   * nadie lo ha tocado. El verde solo puede significar "esto lo validó una
   * persona".
   */
  confirmedFields: Set<string>;
  /**
   * El cuerpo lleva una prenda encima. Entonces se apaga y se mete hacia
   * dentro, y cede el resaltado (oro/verde) a la prenda: la señal tiene que
   * estar donde el sastre está mirando, y con prenda puesta el torso desnudo
   * no se ve. Ver GarmentShell.
   */
  subdued?: boolean;
}) {
  const shoeColor = "#2a2722";
  const activeSegments = new Set(
    activeField && !subdued ? (FIELD_TO_SEGMENTS[activeField] ?? []) : []
  );
  const bodyColor = subdued ? BODY_COLOR_SUBDUED : BODY_COLOR;
  /** Radio de cuerpo, encogido cuando hay tela encima. */
  const r = (value: number) => (subdued ? value * BODY_INSET : value);

  /*
   * Un segmento va a verde solo cuando TODAS las medidas que lo describen están
   * tomadas — no con la primera. El muslo lo describen thigh, knee, inseam y
   * outseam: pintarlo de verde con solo `thigh` diría "esta sección terminó"
   * cuando falta la mitad, que es justo lo contrario de lo que el color promete.
   */
  const completeSegments = useMemo(() => {
    // Con prenda encima el verde lo lleva la tela, no la piel de debajo.
    if (subdued) return new Set<string>();
    const relevant = new Map<string, string[]>();
    for (const field of fields) {
      for (const seg of FIELD_TO_SEGMENTS[field] ?? []) {
        relevant.set(seg, [...(relevant.get(seg) ?? []), field]);
      }
    }
    const done = new Set<string>();
    for (const [seg, segFields] of relevant) {
      if (segFields.every((f) => confirmedFields.has(f))) done.add(seg);
    }
    return done;
  }, [fields, confirmedFields, subdued]);

  return (
    <group>
      {pose.legs.map((leg) => (
        <group key={leg.side}>
          <Segment
            x={leg.x}
            color={bodyColor}
            radiusTop={r(leg.thigh.radiusTop)}
            radiusBottom={r(leg.thigh.radiusBottom)}
            y0={leg.thigh.y0}
            y1={leg.thigh.y1}
            active={activeSegments.has(`${leg.side}Thigh`)}
            complete={completeSegments.has(`${leg.side}Thigh`)}
          />
          <Segment
            x={leg.x}
            color={bodyColor}
            radiusTop={r(leg.calf.radiusTop)}
            radiusBottom={r(leg.calf.radiusBottom)}
            y0={leg.calf.y0}
            y1={leg.calf.y1}
            active={activeSegments.has(`${leg.side}Calf`)}
            complete={completeSegments.has(`${leg.side}Calf`)}
          />
        </group>
      ))}
      {pose.shoes.map((shoe, i) => (
        <mesh key={i} position={[shoe.x, 0.02, 0.02]} castShadow>
          <boxGeometry args={[0.09, 0.04, 0.16]} />
          <meshStandardMaterial color={shoeColor} roughness={0.6} />
        </mesh>
      ))}
      <Segment
        color={bodyColor}
        radiusTop={r(pose.pelvis.radius)}
        radiusBottom={r(pose.pelvis.radius)}
        y0={pose.pelvis.y0}
        y1={pose.pelvis.y1}
        active={activeSegments.has("pelvis")}
        complete={completeSegments.has("pelvis")}
      />
      <Segment
        radiusTop={r(pose.waistBand.radius)}
        radiusBottom={r(pose.waistBand.radius)}
        y0={pose.waistBand.y0}
        y1={pose.waistBand.y1}
        color={subdued ? bodyColor : GUIDE_COLOR}
        active={activeSegments.has("waistBand")}
        complete={completeSegments.has("waistBand")}
      />
      <Segment
        color={bodyColor}
        radiusTop={r(pose.chest.radiusTop)}
        radiusBottom={r(pose.chest.radiusBottom)}
        y0={pose.chest.y0}
        y1={pose.chest.y1}
        active={activeSegments.has("chest")}
        complete={completeSegments.has("chest")}
      />
      <Segment
        color={bodyColor}
        radiusTop={r(pose.neck.radius)}
        radiusBottom={r(pose.neck.radius)}
        y0={pose.neck.y0}
        y1={pose.neck.y1}
        active={activeSegments.has("neck")}
        complete={completeSegments.has("neck")}
      />
      <mesh position={[0, pose.head.y, 0]} castShadow>
        <sphereGeometry args={[pose.head.radius, 24, 24]} />
        <meshStandardMaterial color={bodyColor} roughness={0.9} />
      </mesh>
      {pose.arms.map((arm) => (
        <group key={arm.side}>
          <Segment
            x={arm.x}
            color={bodyColor}
            radiusTop={r(arm.upperArm.radiusTop)}
            radiusBottom={r(arm.upperArm.radiusBottom)}
            y0={arm.upperArm.y0}
            y1={arm.upperArm.y1}
            active={activeSegments.has(`${arm.side}UpperArm`)}
            complete={completeSegments.has(`${arm.side}UpperArm`)}
          />
          <Segment
            x={arm.x}
            color={bodyColor}
            radiusTop={r(arm.forearm.radiusTop)}
            radiusBottom={r(arm.forearm.radiusBottom)}
            y0={arm.forearm.y0}
            y1={arm.forearm.y1}
            active={activeSegments.has(`${arm.side}Forearm`)}
            complete={completeSegments.has(`${arm.side}Forearm`)}
          />
        </group>
      ))}
      {/* Las barras guía marcan largos sobre el cuerpo desnudo. Con prenda
          puesta quedarían enterradas bajo la tela: el largo ya se ve en el
          bajo de la propia prenda. */}
      {!subdued &&
        pose.guideBars.map((bar) => (
          <GuideBarMesh
            key={bar.field}
            center={bar.center}
            length={bar.length}
            orientation={bar.orientation}
            active={bar.field === activeField}
            complete={confirmedFields.has(bar.field)}
          />
        ))}
    </group>
  );
}
