"use client";

import type { GarmentType } from "@/types/database.types";
import type { MannequinPose } from "../pose";
import { SacoGarment } from "./saco";
import { CamisaGarment } from "./camisa";
import { ChalecoGarment } from "./chaleco";
import { PantalonGarment } from "./pantalon";

/**
 * La prenda que se está midiendo, puesta sobre el cuerpo.
 *
 * Antes el visor mostraba el mismo maniquí desnudo para las cuatro prendas:
 * el sastre tomaba la bota de un pantalón mirando un torso. Cada prenda se
 * modela con SUS medidas, así que mover un slider deforma la pieza que ese
 * slider realmente describe.
 *
 * `otro` no tiene un juego de medidas definido (GARMENT_MEASUREMENT_FIELDS lo
 * deja vacío), así que no hay prenda que dibujar y se ve solo el cuerpo.
 */
export function GarmentShell({
  garmentType,
  pose,
  color,
  activeField,
}: {
  garmentType: GarmentType;
  pose: MannequinPose;
  color: string;
  activeField: string | null;
}) {
  const props = { pose, color, activeField };

  switch (garmentType) {
    case "saco":
      return <SacoGarment {...props} />;
    case "camisa":
      return <CamisaGarment {...props} />;
    case "chaleco":
      return <ChalecoGarment {...props} />;
    case "pantalon":
      return <PantalonGarment {...props} />;
    case "otro":
      return null;
  }
}
