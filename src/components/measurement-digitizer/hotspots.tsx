"use client";

import { useState } from "react";
import { Html } from "@react-three/drei";
import type { ThreeEvent } from "@react-three/fiber";
import { getMeasurementFieldLabel } from "@/lib/constants";
import type { GarmentType } from "@/types/database.types";
import type { MannequinPose } from "./pose";
import { GUIDE_COLOR } from "./mannequin-figure";

const EMPTY_COLOR = "#9a9182";
const FILLED_COLOR = "#f5f1e8";
/**
 * Verde de "medida validada por el sastre". El marcador es el ÚNICO sitio del
 * visor donde aparece: la tela no se tiñe, porque su color es el paño elegido
 * y teñirlo mentiría sobre la prenda. Ver GarmentSurface.
 */
const CONFIRMED_COLOR = "#6f9c7d";

export function MeasurementHotspots({
  garmentType,
  fields,
  pose,
  activeField,
  filledFields,
  confirmedFields,
  onSelect,
}: {
  garmentType: GarmentType;
  fields: string[];
  pose: MannequinPose;
  activeField: string | null;
  /** Tiene número (puede ser la estimación). */
  filledFields: Set<string>;
  /** Validada por el sastre. */
  confirmedFields: Set<string>;
  onSelect: (field: string) => void;
}) {
  return (
    <group>
      {fields.map((field) => {
        const anchor = pose.hotspots[field];
        if (!anchor) return null;
        return (
          <Hotspot
            key={field}
            garmentType={garmentType}
            field={field}
            position={anchor.position}
            active={activeField === field}
            filled={filledFields.has(field)}
            confirmed={confirmedFields.has(field)}
            onSelect={onSelect}
          />
        );
      })}
    </group>
  );
}

function Hotspot({
  garmentType,
  field,
  position,
  active,
  filled,
  confirmed,
  onSelect,
}: {
  garmentType: GarmentType;
  field: string;
  position: [number, number, number];
  active: boolean;
  filled: boolean;
  confirmed: boolean;
  onSelect: (field: string) => void;
}) {
  const [hovered, setHovered] = useState(false);
  const color = active ? GUIDE_COLOR : confirmed ? CONFIRMED_COLOR : filled ? FILLED_COLOR : EMPTY_COLOR;
  const scale = active ? 1.6 : hovered ? 1.3 : 1;

  function handleClick(event: ThreeEvent<MouseEvent>) {
    event.stopPropagation();
    onSelect(field);
  }

  return (
    <group position={position}>
      {/* Blanco de toque más grande que el punto visible: en pantallas
          pequeñas/táctiles un radio de 0.02 es casi imposible de acertar. */}
      <mesh
        onClick={handleClick}
        onPointerOver={(e) => {
          e.stopPropagation();
          setHovered(true);
        }}
        onPointerOut={() => setHovered(false)}
      >
        <sphereGeometry args={[0.05, 12, 12]} />
        <meshBasicMaterial transparent opacity={0} depthWrite={false} />
      </mesh>
      <mesh scale={scale}>
        <sphereGeometry args={[0.026, 16, 16]} />
        <meshStandardMaterial
          color={color}
          emissive={color}
          emissiveIntensity={active ? 0.6 : 0.15}
        />
      </mesh>
      {(hovered || active) && (
        <Html center distanceFactor={2.2} position={[0, 0.05, 0]} zIndexRange={[10, 0]} occlude={false}>
          <div className="pointer-events-none rounded-md bg-foreground px-2 py-0.5 text-[11px] whitespace-nowrap text-background shadow-sm">
            {getMeasurementFieldLabel(garmentType, field)}
          </div>
        </Html>
      )}
    </group>
  );
}
