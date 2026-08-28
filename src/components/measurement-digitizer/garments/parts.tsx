"use client";

import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { DoubleSide, FrontSide, Shape, Vector2, type MeshStandardMaterial } from "three";
import { HIGHLIGHT_COLOR } from "../mannequin-figure";
import type { MannequinPose } from "../pose";

/**
 * Piezas reutilizables con las que se arman las cuatro prendas.
 *
 * Todo es geometría procedural (no hay ningún .glb en el repo y el visor
 * entero es paramétrico): la primitiva base es LatheGeometry, que revoluciona
 * un perfil 2D de puntos (radio, y) alrededor del eje Y. Es exactamente la
 * forma de un cuerpo de prenda que cambia de ancho con pecho → cintura → base.
 */

/** Un punto del perfil: [radio en metros, altura y en metros]. */
export type ProfilePoint = [number, number];

/** Radio mínimo: un radio 0 o negativo degenera la lathe y produce NaN. */
const MIN_R = 0.012;
/** Separación mínima en Y entre puntos consecutivos del perfil. */
const MIN_DY = 0.004;

/**
 * Convierte el perfil a puntos de LatheGeometry saneándolo.
 *
 * Los dos saneos importan de verdad: un valor no finito (NaN) mete NaN en la
 * bounding sphere de la geometría y three.js descarta la malla por frustum
 * culling — es decir, la prenda DESAPARECE sin ningún error en consola. Y un
 * perfil cuya Y no crece de forma monótona produce una lathe auto-intersecada
 * con normales invertidas. Ninguna de las dos cosas debe poder llegar a la GPU
 * por muy raras que sean las medidas que teclee el sastre.
 */
export function buildProfile(points: ProfilePoint[]): Vector2[] {
  const safe: Vector2[] = [];
  let prevY = Number.NEGATIVE_INFINITY;

  for (const [rawR, rawY] of points) {
    const r = Number.isFinite(rawR) ? Math.max(rawR, MIN_R) : MIN_R;
    const baseY = Number.isFinite(rawY) ? rawY : prevY + MIN_DY;
    const y = prevY === Number.NEGATIVE_INFINITY ? baseY : Math.max(baseY, prevY + MIN_DY);
    safe.push(new Vector2(r, y));
    prevY = y;
  }

  return safe;
}

/** Props que reciben las cuatro prendas. */
export interface GarmentProps {
  pose: MannequinPose;
  color: string;
  activeField: string | null;
}

/**
 * Estado visual de una parte de prenda respecto de las medidas que la
 * describen.
 *
 * La tela NO señaliza "medida confirmada": el verde de validado vive solo en
 * los marcadores (las bolas de medida), porque sobre la tela taparía el color
 * real del paño — que es información, no decoración. Lo único que la prenda
 * resalta es la parte que se está ajustando ahora mismo.
 */
export function usePartState(partFields: string[], activeField: string | null) {
  return useMemo(
    () => ({ active: !!activeField && partFields.includes(activeField) }),
    [partFields, activeField]
  );
}

/**
 * Superficie de tela.
 *
 * El color es información: es el paño que el cliente eligió, y tiene que
 * leerse tal cual en todo momento. Por eso `color` nunca se reemplaza ni se
 * tiñe, y lo único que se le suma es el oro pulsante del campo en edición —
 * temporal y localizado. El estado "confirmada" lo dicen los marcadores (ver
 * MeasurementHotspots), no la tela: teñir el saco de verde equivalía a
 * mentirle al sastre sobre el color del paño.
 */
export function GarmentSurface({
  color,
  active,
  roughness = 0.78,
  doubleSided = false,
}: {
  color: string;
  active: boolean;
  roughness?: number;
  /**
   * Solo para piezas realmente abiertas (tubos sin tapa, cáscaras con frente
   * abierto). Por defecto se renderiza una sola cara: con DoubleSide activo,
   * una superficie que además proyecta y recibe sombra se auto-sombrea y
   * aparece un rayado tipo pana sobre la tela.
   */
  doubleSided?: boolean;
}) {
  const ref = useRef<MeshStandardMaterial>(null);

  /*
   * Se escribe la intensidad SIEMPRE, no solo cuando está activa. Si solo se
   * animara el caso activo, al desactivarse el material se quedaría con el
   * último valor del seno — un brillo pegado que no significa nada.
   */
  useFrame(({ clock }) => {
    const material = ref.current;
    if (!material) return;
    material.emissiveIntensity = active ? 0.3 + Math.sin(clock.elapsedTime * 3.2) * 0.14 : 0;
  });

  return (
    <meshStandardMaterial
      ref={ref}
      color={color}
      emissive={active ? HIGHLIGHT_COLOR : "#000000"}
      emissiveIntensity={active ? 0.3 : 0}
      roughness={roughness}
      metalness={0.04}
      side={doubleSided ? DoubleSide : FrontSide}
    />
  );
}

/**
 * Cáscara revolucionada: el cuerpo de cualquier prenda de torso o de pierna.
 *
 * `openFrontRad > 0` deja un hueco centrado al frente (+Z). En LatheGeometry
 * el ángulo phi=0 cae sobre +Z, así que arrancar en `hueco/2` y recorrer
 * `2π - hueco` deja la abertura justo al frente.
 */
export function LatheShell({
  profile,
  color,
  active,
  openFrontRad = 0,
  segments = 32,
  position = [0, 0, 0],
  doubleSided,
}: {
  profile: ProfilePoint[];
  color: string;
  active: boolean;
  openFrontRad?: number;
  segments?: number;
  position?: [number, number, number];
  doubleSided?: boolean;
}) {
  const points = useMemo(() => buildProfile(profile), [profile]);
  const phiStart = openFrontRad / 2;
  const phiLength = Math.PI * 2 - openFrontRad;

  return (
    <mesh position={position} castShadow receiveShadow>
      <latheGeometry args={[points, segments, phiStart, phiLength]} />
      {/* Con el frente abierto se ve el revés de la tela desde dentro. */}
      <GarmentSurface
        color={color}
        active={active}
        doubleSided={doubleSided ?? openFrontRad > 0}
      />
    </mesh>
  );
}

/** Manga o pernera: tronco de cono entre dos alturas. */
export function TaperedTube({
  x,
  z = 0,
  radiusTop,
  radiusBottom,
  y0,
  y1,
  color,
  active,
}: {
  x: number;
  z?: number;
  radiusTop: number;
  radiusBottom: number;
  y0: number;
  y1: number;
  color: string;
  active: boolean;
}) {
  const height = Math.max(y1 - y0, 0.001);

  return (
    <mesh position={[x, (y0 + y1) / 2, z]} castShadow receiveShadow>
      {/* Tubo CERRADO (con tapas). Abierto habría que pintarlo a dos caras, y
          una superficie a dos caras que además proyecta y recibe sombra se
          auto-sombrea: aparecía un rayado de pana sobre la manga. */}
      <cylinderGeometry
        args={[Math.max(radiusTop, MIN_R), Math.max(radiusBottom, MIN_R), height, 20]}
      />
      <GarmentSurface color={color} active={active} />
    </mesh>
  );
}

/**
 * Canesú de hombro: elipsoide ancho y poco profundo que une el torso con las
 * dos mangas.
 *
 * Hace falta porque el torso es una superficie de revolución — un círculo—, y
 * un hombro real es ancho pero no profundo. Ensanchar el círculo hasta llegar
 * a la manga dejaría un saco con forma de barril. Esta pieza cubre justo el
 * tramo hombro→sisa sin engordar el pecho de frente a espalda.
 */
export function ShoulderYoke({
  width,
  depth,
  y,
  color,
  active,
}: {
  width: number;
  depth: number;
  y: number;
  color: string;
  active: boolean;
}) {
  /*
   * Muy achatado en Y a propósito. Un elipsoide alto levanta una cúpula por
   * encima de la línea de hombro y la prenda pasa a leerse como manga
   * abullonada — hombro de vestido. El hombro de un saco de caballero es
   * prácticamente recto: estructura, no volumen.
   */
  return (
    <mesh
      position={[0, y - 0.032, 0]}
      scale={[Math.max(width, 0.05) / 2, 0.044, Math.max(depth, 0.05) / 2]}
      castShadow
      receiveShadow
    >
      <sphereGeometry args={[1, 28, 16]} />
      <GarmentSurface color={color} active={active} />
    </mesh>
  );
}

/** Botón. Detalle pequeño pero es lo que termina de leer "prenda" y no "tubo". */
export function GarmentButton({ position, color = "#1b1b1d" }: { position: [number, number, number]; color?: string }) {
  return (
    <mesh position={position} rotation={[Math.PI / 2, 0, 0]} castShadow>
      <cylinderGeometry args={[0.011, 0.011, 0.005, 12]} />
      <meshStandardMaterial color={color} roughness={0.45} metalness={0.15} />
    </mesh>
  );
}

/**
 * Solapa: triángulo extruido que baja desde el cuello hacia el centro del
 * pecho. Se instancia dos veces en espejo para formar la V del saco.
 */
export function Lapel({
  side,
  topY,
  bottomY,
  width,
  radius,
  color,
  active,
}: {
  side: "left" | "right";
  topY: number;
  bottomY: number;
  width: number;
  radius: number;
  color: string;
  active: boolean;
}) {
  const mirror = side === "left" ? -1 : 1;

  /*
   * El espejado se hace EN LA FORMA (negando la x de cada punto), no con
   * scale={[-1,1,1]}. Una escala negativa invierte el sentido de giro de los
   * triángulos: las normales quedan mirando hacia dentro y la solapa se
   * renderiza oscura y desigual respecto de la del otro lado.
   */
  const shape = useMemo(() => {
    const height = Math.max(topY - bottomY, 0.02);
    const w = Math.max(width, 0.02) * mirror;
    const s = new Shape();
    s.moveTo(0, 0);
    s.lineTo(w, height * 0.12);
    s.lineTo(w * 0.62, -height * 0.55);
    s.lineTo(0, -height);
    s.closePath();
    return s;
  }, [topY, bottomY, width, mirror]);

  return (
    <mesh position={[0, topY, radius * 0.9]} rotation={[0, mirror * -0.32, 0]} castShadow>
      <extrudeGeometry args={[shape, { depth: 0.008, bevelEnabled: false, curveSegments: 2 }]} />
      <GarmentSurface color={color} active={active} roughness={0.68} doubleSided />
    </mesh>
  );
}

/**
 * Cuello: tirilla que rodea la nuca y se abre al frente.
 *
 * Se hace con una lathe y no con un toro porque el toro arranca su arco en +X
 * y dejaba la abertura mirando de lado — se veía un anillo roto flotando
 * alrededor del cuello. Con `openFrontRad` la abertura queda centrada al
 * frente por construcción, que es donde la abre un cuello de verdad.
 */
export function Collar({
  y,
  radius,
  color,
  active,
  openFrontRad = Math.PI * 0.62,
}: {
  y: number;
  radius: number;
  color: string;
  active: boolean;
  openFrontRad?: number;
}) {
  const r = Math.max(radius, MIN_R);
  const profile = useMemo<ProfilePoint[]>(
    () => [
      [r, y],
      [r * 1.06, y + 0.035],
      [r * 1.04, y + 0.05],
    ],
    [r, y]
  );

  return (
    <LatheShell
      profile={profile}
      color={color}
      active={active}
      openFrontRad={openFrontRad}
      doubleSided
    />
  );
}

/**
 * Bola de manga: cierra la unión torso/manga por arriba.
 *
 * `radius` es el radio HORIZONTAL y tiene que ser mayor que el de la manga que
 * tapa, no menor. Antes era `armRadius * 0.96` centrado medio radio por debajo
 * de la línea de hombro: a esa altura la esfera solo medía ~0.64 del radio de
 * la manga, así que nunca llegaba a cubrirla y quedaba a la vista el disco
 * plano con que `cylinderGeometry` tapa el tubo — dos tapas oscuras flotando
 * sobre los hombros. Quien la instancia debe terminar la manga a la ALTURA DEL
 * CENTRO de esta pieza, que es donde es más ancha y la envuelve entera.
 *
 * El aplastamiento vertical va aparte del radio justo para poder taparla sin
 * abullonarla: un hombro de saco es estructura, no volumen.
 */
export function ShoulderCap({
  x,
  y,
  radius,
  color,
  active,
  flatten = 0.58,
}: {
  x: number;
  y: number;
  radius: number;
  color: string;
  active: boolean;
  /** Escala en Y. 1 = esfera; por debajo, cúpula achatada. */
  flatten?: number;
}) {
  return (
    <mesh position={[x, y, 0]} scale={[1, flatten, 1]} castShadow receiveShadow>
      <sphereGeometry args={[Math.max(radius, MIN_R), 20, 14]} />
      <GarmentSurface color={color} active={active} />
    </mesh>
  );
}
