"use client";

import { useEffect } from "react";
import { useThree } from "@react-three/fiber";
import type { OrbitControls as OrbitControlsImpl } from "three-stdlib";

export type QuickView = "front" | "back" | "profile";

export const QUICK_VIEW_LABELS: Record<QuickView, string> = {
  front: "Frontal",
  back: "Espalda",
  profile: "Perfil",
};

// Distancia calculada para que quepa el maniquí completo (~1.7-1.9m de
// alto según las medidas extremas) con margen, dado el fov=32° del Canvas:
// distancia*tan(16°)*2 debe superar la altura total. Ver measurement-mannequin.tsx.
const VIEW_POSITIONS: Record<QuickView, [number, number, number]> = {
  front: [0, 0.85, 3.6],
  back: [0, 0.85, -3.6],
  profile: [3.6, 0.85, 0],
};

/**
 * Posiciona la cámara y el target de OrbitControls en el preset elegido.
 * Es un corte directo (no una animación por frame): animar con useFrame
 * mientras OrbitControls también actualiza su propio estado esférico cada
 * frame termina en una pelea entre ambos (el usuario no puede orbitar
 * manualmente después). Un corte instantáneo en un `useEffect` evita esa
 * clase de bug por completo y deja el arrastre libre en cuanto se suelta.
 */
export function CameraRig({
  view,
  target,
  controlsRef,
}: {
  view: QuickView;
  target: [number, number, number];
  controlsRef: React.RefObject<OrbitControlsImpl | null>;
}) {
  const { camera } = useThree();

  useEffect(() => {
    camera.position.set(...VIEW_POSITIONS[view]);
    const controls = controlsRef.current;
    if (controls) {
      controls.target.set(...target);
      controls.update();
    } else {
      camera.lookAt(...target);
    }
  }, [view, target, camera, controlsRef]);

  return null;
}
