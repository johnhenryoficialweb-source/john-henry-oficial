"use client";

import { Suspense } from "react";
import { Canvas } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import type { MeasurementUnit } from "@/types/database.types";
import { computeMannequinPose } from "./pose";
import { MannequinFigure } from "./mannequin-figure";

/** Constante de módulo: una `new Set()` inline se recrearía en cada render y
 *  rompería la memoización de `completeSegments` río abajo. */
const EMPTY_FIELDS: Set<string> = new Set();

/**
 * Vista de solo lectura del maniquí (sin hotspots ni panel de edición) —
 * la usa la ficha imprimible/enviable de la orden (OrderSummaryDocument)
 * como "silueta de referencia". `preserveDrawingBuffer` queda encendido
 * para poder capturar el canvas con toDataURL() al exportar/enviar.
 */
export function ReadonlyMannequinViewer({
  measurements,
  unit,
  className,
  onCanvasReady,
}: {
  measurements: Record<string, number>;
  unit: MeasurementUnit;
  className?: string;
  onCanvasReady?: (canvas: HTMLCanvasElement) => void;
}) {
  const pose = computeMannequinPose(measurements, unit);

  return (
    <div className={className}>
      <Canvas
        shadows
        camera={{ position: [0, 0.85, 3.6], fov: 32 }}
        dpr={[1, 2]}
        gl={{ antialias: true, alpha: true, preserveDrawingBuffer: true }}
        onCreated={({ gl }) => onCanvasReady?.(gl.domElement)}
      >
        <ambientLight intensity={0.7} />
        <directionalLight position={[2, 3, 2]} intensity={1.2} castShadow />
        <directionalLight position={[-2, 1.5, -1]} intensity={0.4} />
        <Suspense fallback={null}>
          {/*
           * Sin campos y sin capturadas a propósito: el verde de "sección
           * tomada" es señalética interna para el sastre, y esta silueta va
           * dentro de la ficha que se le entrega al cliente. Ahí el maniquí
           * es una referencia de la prenda, no un tablero de progreso.
           */}
          <MannequinFigure pose={pose} activeField={null} fields={[]} confirmedFields={EMPTY_FIELDS} />
        </Suspense>
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.001, 0]} receiveShadow>
          <circleGeometry args={[1.4, 32]} />
          <shadowMaterial opacity={0.18} />
        </mesh>
        <OrbitControls
          enablePan={false}
          autoRotate
          autoRotateSpeed={1.1}
          minDistance={2.6}
          maxDistance={4.5}
          minPolarAngle={Math.PI / 4}
          maxPolarAngle={Math.PI / 1.9}
          target={[0, 0.85, 0]}
        />
      </Canvas>
    </div>
  );
}
