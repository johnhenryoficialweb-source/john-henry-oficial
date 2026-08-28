"use client";

import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Canvas } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import type { OrbitControls as OrbitControlsImpl } from "three-stdlib";
import { RotateCcwIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { GarmentType, MeasurementUnit } from "@/types/database.types";
import { HEIGHT_FIELD_CONFIG, MEASUREMENT_FIELD_CONFIG, unitToCm } from "./config";
import { computeMannequinPose } from "./pose";
import { MannequinFigure } from "./mannequin-figure";
import { GarmentShell } from "./garments/garment-shell";
import { DEFAULT_GARMENT_COLOR } from "./garment-colors";
import { GarmentColorPicker } from "./garment-color-picker";
import { MeasurementHotspots } from "./hotspots";
import { MeasurementEditorBar } from "./measurement-editor-bar";
import { HeightPrompt } from "./height-prompt";
import { JhMark } from "@/components/brand/jh-mark";
import { CameraRig, QUICK_VIEW_LABELS, type QuickView } from "./camera-views";

export interface MeasurementMannequinProps {
  garmentType: GarmentType;
  fields: string[];
  unit: MeasurementUnit;
  measurements: Record<string, number>;
  /** Medidas validadas por el sastre. Distintas de "tiene número". */
  confirmedFields: Set<string>;
  onFieldChange: (field: string, valueCm: number) => void;
  onBulkChange: (valuesCm: Record<string, number>) => void;
  onConfirmField: (field: string) => void;
  /** Campo activo (controlado) — permite abrir el panel de edición desde
   * fuera del maniquí, ej. tocando un chip en un resumen externo. */
  activeField: string | null;
  onActiveFieldChange: (field: string | null) => void;
  /** Nombre de la prenda que se está midiendo. El maniquí es el mismo cuerpo
   *  para todas, así que sin esto no hay forma de saber qué se está tomando. */
  garmentLabel?: string;
  /**
   * Altura del cliente, si ya se conoce. Es del CUERPO, no de la prenda: se
   * pregunta una vez por orden y vale para todas. Cuando llega con valor, el
   * prompt no aparece — el padre ya sembró la estimación.
   */
  heightCm: number | null;
  onHeightConfirm: (heightCm: number) => void;
  /** Color de la prenda (hex). Ver garment-colors.ts — es previsualización, no dato de la orden. */
  garmentColor?: string;
  onGarmentColorChange?: (hex: string) => void;
  /** Reinicia todas las medidas de la pieza activa a su estimación por altura, sin ninguna confirmada. */
  onResetMeasurements?: () => void;
  className?: string;
}

const TARGET: [number, number, number] = [0, 0.85, 0];

/**
 * Alto que cabe en el encuadre, en metros.
 *
 * Con la cámara en y=0.85, distancia 3.6 y fov 32°, la ventana visible en Y va
 * de -0.18 a 1.88. En los extremos de los sliders de pantalón la coronilla
 * llega a y≈1.82: seis centímetros de margen, y la figura se mueve 23 cm en
 * vertical según se ajusta inseam/outseam. Es decir, se recorta la cabeza.
 *
 * Se deja un poco por debajo del techo real para que nunca roce el borde.
 */
const MAX_VISIBLE_HEIGHT_M = 1.78;

export function MeasurementMannequin({
  garmentType,
  fields,
  unit,
  measurements,
  confirmedFields,
  onFieldChange,
  onBulkChange,
  onConfirmField,
  activeField,
  onActiveFieldChange,
  garmentLabel,
  heightCm,
  onHeightConfirm,
  garmentColor = DEFAULT_GARMENT_COLOR,
  onGarmentColorChange,
  onResetMeasurements,
  className,
}: MeasurementMannequinProps) {
  const [view, setView] = useState<QuickView>("front");
  const [resetOpen, setResetOpen] = useState(false);
  const controlsRef = useRef<OrbitControlsImpl | null>(null);
  /*
   * Un contexto WebGL se puede perder por causas ajenas a esta pantalla
   * (reset del driver, pestaña dormida). Antes eso dejaba un recuadro negro
   * mudo; ahora se dice qué pasó y se ofrece rehacerlo. `canvasGeneration`
   * fuerza el remontaje del <Canvas> vía key.
   */
  const [contextLost, setContextLost] = useState(false);
  const [canvasGeneration, setCanvasGeneration] = useState(0);
  const [frameloop, setFrameloop] = useState<"always" | "never">("always");
  const lostOverlayTimerRef = useRef<number | null>(null);
  const remountAttemptsRef = useRef(0);

  const remountCanvas = useCallback(() => {
    setCanvasGeneration((g) => g + 1);
  }, []);

  const handleCanvasCreated = useCallback(
    ({ gl }: { gl: { domElement: HTMLCanvasElement } }) => {
      remountAttemptsRef.current = 0;
      if (lostOverlayTimerRef.current != null) {
        window.clearTimeout(lostOverlayTimerRef.current);
        lostOverlayTimerRef.current = null;
      }
      setContextLost(false);

      const canvas = gl.domElement;

      const onLost = (event: Event) => {
        event.preventDefault();
        if (remountAttemptsRef.current < 2) {
          remountAttemptsRef.current += 1;
          remountCanvas();
        }
        if (lostOverlayTimerRef.current != null) {
          window.clearTimeout(lostOverlayTimerRef.current);
        }
        lostOverlayTimerRef.current = window.setTimeout(() => setContextLost(true), 900);
      };

      const onRestored = () => {
        if (lostOverlayTimerRef.current != null) {
          window.clearTimeout(lostOverlayTimerRef.current);
          lostOverlayTimerRef.current = null;
        }
        setContextLost(false);
        remountCanvas();
      };

      canvas.addEventListener("webglcontextlost", onLost);
      canvas.addEventListener("webglcontextrestored", onRestored);
    },
    [remountCanvas]
  );

  // Pausar el loop cuando la pestaña está en segundo plano reduce presión de GPU
  // y evita que el navegador mate el contexto WebGL por inactividad.
  useEffect(() => {
    const syncVisibility = () => {
      if (document.hidden) {
        setFrameloop("never");
        return;
      }
      setFrameloop("always");
      if (contextLost) remountCanvas();
    };

    syncVisibility();
    document.addEventListener("visibilitychange", syncVisibility);
    return () => document.removeEventListener("visibilitychange", syncVisibility);
  }, [contextLost, remountCanvas]);

  /*
   * Derivado, no estado local. Antes esto era un `useState` inicializado con
   * las medidas de la prenda: como cada prenda arranca vacía, cada prenda
   * volvía a preguntar la altura — un dato del cuerpo del cliente que ya se
   * había dado. Ahora lo decide la altura conocida a nivel de orden.
   */
  const showHeightPrompt = heightCm == null && !fields.some((f) => (measurements[f] ?? 0) > 0);

  const pose = useMemo(() => computeMannequinPose(measurements, unit), [measurements, unit]);

  /*
   * Encoge SOLO cuando la figura no cabría. El caso normal renderiza 1:1
   * exactamente como antes, los pies siguen en y=0 (la sombra sigue pegada al
   * suelo) y los extremos se ajustan en vez de recortarse.
   *
   * Se escala el grupo en vez de mover la cámara a propósito: CameraRig fija
   * la posición en un useEffect y su propio comentario advierte que pelearse
   * con OrbitControls cada frame rompe el orbitado manual. Además mover la
   * cámara mientras se arrastra un slider marearía.
   */
  const fitScale = useMemo(
    () => Math.min(1, MAX_VISIBLE_HEIGHT_M / Math.max(pose.heightM, 0.01)),
    [pose.heightM]
  );

  const filledFields = useMemo(
    () => new Set(fields.filter((f) => (measurements[f] ?? 0) > 0)),
    [fields, measurements]
  );

  const confirmedCount = useMemo(
    () => fields.filter((f) => confirmedFields.has(f)).length,
    [fields, confirmedFields]
  );

  const activeConfig = activeField ? MEASUREMENT_FIELD_CONFIG[activeField] : null;
  const activeValueCm =
    activeField && measurements[activeField] > 0
      ? unitToCm(measurements[activeField], unit)
      : (activeConfig?.default ?? 0);

  /*
   * Solo reporta la altura hacia arriba. El padre la guarda para el resto de
   * la orden y siembra la estimación — así la prenda siguiente ya nace con
   * valores y no hay a quién volver a preguntarle.
   */

  return (
    <div className={className}>
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <div className="flex gap-1 rounded-lg bg-muted p-0.5">
          {(Object.keys(QUICK_VIEW_LABELS) as QuickView[]).map((v) => (
            <Button
              key={v}
              type="button"
              size="sm"
              variant={view === v ? "default" : "ghost"}
              onClick={() => setView(v)}
            >
              {QUICK_VIEW_LABELS[v]}
            </Button>
          ))}
        </div>
        {/* Color de la tela. Arranca en el color de la tela elegida y se puede
            cambiar a mano: es previsualización para el sastre y el cliente, no
            un dato que se guarde en la orden. */}
        {garmentType !== "otro" && onGarmentColorChange && (
          <GarmentColorPicker color={garmentColor} onChange={onGarmentColorChange} />
        )}

        {/* Goal gradient: el avance cuenta medidas CONFIRMADAS, no números en
            pantalla. La leyenda explica el verde — un color que haya que
            descifrar no informa, decora. */}
        <div className="flex items-center gap-3">
          <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
            <span aria-hidden className="size-2 rounded-full bg-[#6f9c7d]" />
            Confirmada
          </span>
          <p className="text-xs font-medium">
            <span className="text-foreground">{confirmedCount}</span>
            <span className="text-muted-foreground"> de {fields.length} confirmadas</span>
          </p>
        </div>
      </div>

      <div className="relative h-[min(60vh,560px)] min-h-[360px] w-full overflow-hidden rounded-xl border border-border bg-gradient-to-b from-muted/60 to-muted/20">
        {showHeightPrompt ? (
          <HeightPrompt
            unit={unit}
            onConfirm={onHeightConfirm}
            onSkip={() => onHeightConfirm(HEIGHT_FIELD_CONFIG.default)}
          />
        ) : (
          <>
            <Canvas
              key={canvasGeneration}
              shadows
              frameloop={frameloop}
              camera={{ position: [0, 0.85, 3.6], fov: 32 }}
              dpr={[1, 1.25]}
              gl={{ antialias: true, alpha: true, powerPreference: "default" }}
              onCreated={handleCanvasCreated}
            >
              <ambientLight intensity={0.65} />
              {/*
               * El sesgo del shadow map no es cosmético acá. Sin él, las
               * superficies que miran casi de frente a esta luz —los hombros,
               * la bola de manga, la tapa de los tubos— se sombrean a sí
               * mismas: el mapa de sombras las sitúa por delante y por detrás
               * de sí mismas de un téxel al siguiente, y aparece un moteado
               * sucio justo en la parte alta de la prenda. `normalBias`
               * desplaza el muestreo a lo largo de la normal, que es lo que
               * corrige el caso de superficie casi perpendicular a la luz.
               */}
              <directionalLight
                position={[2, 3, 2]}
                intensity={1.1}
                castShadow
                shadow-mapSize={[1024, 1024]}
                shadow-bias={-0.0005}
                shadow-normalBias={0.035}
              />
              <directionalLight position={[-2, 1.5, -1]} intensity={0.35} />
              <Suspense fallback={null}>
                {/* Un solo grupo para cuerpo, prenda y hotspots: si el ajuste
                    de encuadre no los escalara juntos, los puntos de medida
                    se despegarían de la figura. */}
                <group scale={fitScale}>
                  <MannequinFigure
                    pose={pose}
                    activeField={activeField}
                    fields={fields}
                    confirmedFields={confirmedFields}
                    subdued={garmentType !== "otro"}
                  />
                  <GarmentShell
                    garmentType={garmentType}
                    pose={pose}
                    color={garmentColor}
                    activeField={activeField}
                  />
                  <MeasurementHotspots
                    garmentType={garmentType}
                    fields={fields}
                    pose={pose}
                    activeField={activeField}
                    filledFields={filledFields}
                    confirmedFields={confirmedFields}
                    onSelect={(field) => onActiveFieldChange(activeField === field ? null : field)}
                  />
                </group>
              </Suspense>
              <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.001, 0]} receiveShadow>
                <circleGeometry args={[1.4, 32]} />
                <shadowMaterial opacity={0.18} />
              </mesh>
              <CameraRig view={view} target={TARGET} controlsRef={controlsRef} />
              <OrbitControls
                ref={controlsRef}
                enablePan={false}
                minDistance={2.2}
                maxDistance={5.5}
                minPolarAngle={Math.PI / 4}
                maxPolarAngle={Math.PI / 1.7}
              />
            </Canvas>

            {contextLost && (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-background/90 px-6 text-center backdrop-blur">
                <p className="text-sm font-medium">Se interrumpió la vista 3D</p>
                <p className="max-w-xs text-xs text-muted-foreground">
                  El navegador liberó el contexto gráfico. Tus medidas están intactas.
                </p>
                <Button
                  type="button"
                  size="sm"
                  onClick={() => {
                    remountAttemptsRef.current = 0;
                    setContextLost(false);
                    remountCanvas();
                  }}
                >
                  Recargar vista 3D
                </Button>
              </div>
            )}

            {/* Contexto permanente: qué prenda se está midiendo. El cuerpo se
                ve igual para las cuatro. */}
            {garmentLabel && (
              <p className="pointer-events-none absolute top-3 left-3 font-institutional text-[9px] tracking-[0.32em] text-foreground/50 uppercase">
                Midiendo · {garmentLabel}
              </p>
            )}

            {/* Reinicia MEDIDAS, no la cámara — ver el diálogo de confirmación
                de abajo. Solo tiene sentido si hay a quién preguntarle; sin
                el callback (ej. visor de solo lectura) se vuelve a su
                comportamiento anterior de encuadre. */}
            <Button
              type="button"
              variant="outline"
              size="icon-sm"
              className="absolute top-2 right-2 bg-background/80 backdrop-blur"
              onClick={() => (onResetMeasurements ? setResetOpen(true) : setView("front"))}
              title="Reiniciar medidas"
            >
              <RotateCcwIcon />
            </Button>
            {/* Isotipo como marca de agua discreta — su uso documentado.
                No captura eventos: el maniquí se orbita por encima de él. */}
            <JhMark
              className="pointer-events-none absolute bottom-3 left-3 size-7 text-[var(--jh-gold)]/25"
              title="JOHN HENRY"
            />
          </>
        )}
      </div>

      {/* La lista de medidas para tocar/editar vive una sola vez, en el
          panel lateral (GarmentPanel) — repetirla acá debajo del maniquí
          era el mismo menú dos veces en la misma pantalla. Esta barra se
          queda porque es el único control de EDICIÓN (slider + valor
          escribible), no un selector. */}
      {!showHeightPrompt && (
        <div className="mt-3">
          <MeasurementEditorBar
            garmentType={garmentType}
            field={activeField}
            config={activeConfig}
            valueCm={activeValueCm}
            unit={unit}
            confirmed={!!activeField && confirmedFields.has(activeField)}
            onChange={(valueCm) => activeField && onFieldChange(activeField, valueCm)}
            onConfirm={() => activeField && onConfirmField(activeField)}
            onClose={() => onActiveFieldChange(null)}
          />
        </div>
      )}

      {/* Loss aversion: se dice qué se pierde y cuánto, no solo "¿reiniciar?". */}
      <Dialog open={resetOpen} onOpenChange={setResetOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>¿Reiniciar medidas{garmentLabel ? ` de ${garmentLabel}` : ""}?</DialogTitle>
            <DialogDescription>
              {confirmedCount > 0
                ? `Se borrarán las ${confirmedCount} de ${fields.length} medidas confirmadas de esta pieza. Podrás volver a tomarlas desde el maniquí, pero no hay forma de deshacerlo.`
                : `Se borrarán los valores cargados en esta pieza. Podrás volver a tomarlos desde el maniquí, pero no hay forma de deshacerlo.`}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setResetOpen(false)}>
              Cancelar
            </Button>
            <Button
              type="button"
              variant="destructive"
              onClick={() => {
                onResetMeasurements?.();
                setView("front");
                setResetOpen(false);
              }}
            >
              Reiniciar medidas
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
