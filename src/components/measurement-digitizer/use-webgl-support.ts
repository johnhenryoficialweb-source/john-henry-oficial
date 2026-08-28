"use client";

import { useSyncExternalStore } from "react";

/**
 * Resultado cacheado a nivel de módulo. La detección es una propiedad del
 * dispositivo: no cambia durante la vida de la pestaña, así que sondear más
 * de una vez no aporta información — y sí hace daño (ver abajo).
 */
let cached: boolean | null = null;

/**
 * OJO: esta función es el `getSnapshot` de `useSyncExternalStore`, y React lo
 * invoca EN CADA RENDER del componente que usa el hook.
 *
 * Antes sondeaba de verdad en cada llamada (`createElement("canvas")` +
 * `getContext("webgl")`), es decir asignaba un contexto WebGL nuevo por
 * render. `useWebglSupport()` se consume en OrderItemsBuilder, que
 * re-renderiza en cada tick de slider del maniquí: arrastrar un slider
 * generaba decenas de contextos por segundo. Los navegadores tienen un tope
 * de contextos vivos (~16 en Chrome) y al excederlo expulsan el más viejo —
 * que era justo el del <Canvas> de R3F. Ese era el bug de "el maniquí se
 * desaparece al mover los sliders".
 *
 * Por eso: sondear una sola vez, cachear, y soltar el contexto de sondeo.
 */
function detectWebgl(): boolean {
  // No cachear el caso servidor: ahí no hay nada que detectar todavía y
  // guardar `false` envenenaría la respuesta del cliente tras hidratar.
  if (typeof window === "undefined") return false;
  if (cached !== null) return cached;

  try {
    const canvas = document.createElement("canvas");
    const gl =
      canvas.getContext("webgl2") ??
      canvas.getContext("webgl") ??
      canvas.getContext("experimental-webgl");

    /*
     * Devolver el contexto de sondeo en vez de esperar al GC. Aunque ya solo
     * se cree uno, ese uno ocupa un slot del tope del navegador hasta que se
     * recolecte, y el recolector no da garantías de cuándo. `loseContext()`
     * lo libera de inmediato.
     */
    const loseContext = (gl as WebGLRenderingContext | null)?.getExtension("WEBGL_lose_context") as
      | { loseContext: () => void }
      | null
      | undefined;
    loseContext?.loseContext();

    cached = !!(window.WebGLRenderingContext && gl);
  } catch {
    cached = false;
  }

  return cached;
}

const noopSubscribe = () => () => {};
const getServerSnapshot = () => false;

/**
 * El maniquí 3D (sección 3.4 del spec) exige caer automáticamente al
 * formulario 2D cuando no hay WebGL. `useSyncExternalStore` resuelve esto
 * sin el parpadeo/mismatch de hidratación de un patrón useState+useEffect:
 * el servidor siempre "ve" `false`, y React resincroniza con el valor real
 * del navegador justo después de hidratar.
 */
export function useWebglSupport(): boolean {
  return useSyncExternalStore(noopSubscribe, detectWebgl, getServerSnapshot);
}
