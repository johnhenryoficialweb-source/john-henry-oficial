"use client";

import { useState } from "react";
import { AlertTriangleIcon, CheckIcon, MinusIcon, PlusIcon, RulerIcon, XIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { getMeasurementFieldLabel } from "@/lib/constants";
import { cn } from "@/lib/utils";
import type { MeasurementFieldConfig } from "./config";
import {
  CAPTURE_MAX_CM,
  CAPTURE_MIN_CM,
  clampToCaptureRange,
  cmToUnit,
  isOutsideTypicalRange,
  unitToCm,
} from "./config";
import type { GarmentType, MeasurementUnit } from "@/types/database.types";

/**
 * Editor de la medida activa, en un espacio FIJO debajo del maniquí — no
 * un panel flotante anclado sobre el cuerpo 3D (eso tapaba justo la zona
 * que se estaba ajustando). El maniquí queda siempre visible completo, y
 * este bloque siempre ocupa el mismo alto (con o sin campo activo) para
 * que el layout no salte al abrir/cerrar.
 *
 * Confirmar es un acto separado de ajustar: el valor que llega puede venir de
 * la estimación por altura, y esa estimación no es una medida — es un punto de
 * partida. Mientras no se confirme, la prenda no está tomada por más que el
 * número se vea razonable.
 */
export function MeasurementEditorBar({
  garmentType,
  field,
  config,
  valueCm,
  unit,
  confirmed,
  onChange,
  onConfirm,
  onClose,
}: {
  garmentType: GarmentType;
  field: string | null;
  config: MeasurementFieldConfig | null;
  valueCm: number;
  unit: MeasurementUnit;
  confirmed: boolean;
  onChange: (valueCm: number) => void;
  onConfirm: () => void;
  onClose: () => void;
}) {
  const [typedValue, setTypedValue] = useState<string | null>(null);

  if (!field || !config) {
    return (
      <div className="flex h-[8.5rem] items-center justify-center gap-2 rounded-xl border border-dashed border-border bg-muted/20 px-4 text-center text-sm text-muted-foreground">
        <RulerIcon className="size-4 shrink-0" />
        Toca un punto del maniquí o una medida para tomarla
      </div>
    );
  }

  const displayValue = cmToUnit(valueCm, unit);
  const displayMin = cmToUnit(CAPTURE_MIN_CM, unit);
  const displayMax = cmToUnit(CAPTURE_MAX_CM, unit);
  const displayStep = cmToUnit(config.step, unit);
  const outsideTypical = isOutsideTypicalRange(field, valueCm);

  function setDisplayValue(next: number) {
    onChange(clampToCaptureRange(unitToCm(next, unit)));
  }

  function commitTypedValue() {
    const parsed = typedValue !== null ? Number(typedValue) : NaN;
    if (!Number.isNaN(parsed)) setDisplayValue(parsed);
    setTypedValue(null);
  }

  return (
    /*
     * Tres filas, alto fijo. El slider tiene una fila ENTERA para él: mientras
     * compartía línea con el botón de confirmar le quedaban ~270px de los
     * ~350px de la columna, y con ese recorrido cada píxel valía casi medio
     * centímetro — arrastrarlo con el dedo era imposible de afinar. Ahora
     * recorre todo el ancho, y el ajuste fino sigue estando en los pasos ± y
     * en el campo escribible.
     */
    <div
      className={cn(
        "flex h-[8.5rem] flex-col justify-center gap-2 rounded-xl border bg-card px-3 py-2",
        confirmed ? "border-[#6f9c7d]/50" : "border-primary/40",
      )}
    >
      <div className="flex items-start gap-2">
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium text-primary">
            {getMeasurementFieldLabel(garmentType, field)}
          </p>
          {/* El estado se dice, no se deduce del color. */}
          {/*
           * El rango habitual informa, no manda: una medida fuera de banda es
           * legítima (clientes de tallas grandes existen), así que se avisa
           * en la misma línea del estado y se sigue pudiendo confirmar.
           */}
          {outsideTypical ? (
            <p className="flex items-center gap-1 text-[10px] text-amber-500">
              <AlertTriangleIcon className="size-3 shrink-0" />
              Fuera del rango habitual ({cmToUnit(config.typicalMin, unit).toFixed(0)}–
              {cmToUnit(config.typicalMax, unit).toFixed(0)} {unit})
            </p>
          ) : (
            <p className={cn("text-[10px]", confirmed ? "text-[#6f9c7d]" : "text-muted-foreground")}>
              {confirmed ? "Confirmada" : "Sugerida"}
            </p>
          )}
        </div>
        {/* Cerrar se queda pequeño a propósito — pulsarlo por error cuesta
            más que volver a abrir la medida. */}
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          aria-label="Cerrar"
          className="-mt-0.5 shrink-0"
          onClick={onClose}
        >
          <XIcon />
        </Button>
      </div>

      <div className="flex items-center gap-2">
        {/*
         * Los pasos ± y el pulsador del slider son los controles que se usan
         * con el dedo, de pie y con el cliente delante: van a tamaño táctil
         * (36px) aunque el resto de la plataforma use iconos compactos.
         */}
        <Button
          type="button"
          variant="outline"
          size="icon-lg"
          aria-label="Restar"
          onClick={() => setDisplayValue(displayValue - displayStep)}
        >
          <MinusIcon />
        </Button>
        <label className="flex shrink-0 items-baseline justify-center gap-1">
          <span className="sr-only">Valor exacto</span>
          {/* Escribible: el ± y el slider ajustan, pero un valor tomado con
              cinta métrica se sabe exacto y no debería obligar a acercarlo
              a fuerza de pasos. */}
          <input
            type="number"
            inputMode="decimal"
            min={displayMin}
            max={displayMax}
            step={displayStep}
            value={typedValue ?? displayValue.toFixed(1)}
            onFocus={() => setTypedValue(displayValue.toFixed(1))}
            onChange={(e) => setTypedValue(e.target.value)}
            onBlur={commitTypedValue}
            onKeyDown={(e) => {
              if (e.key === "Enter") (e.target as HTMLInputElement).blur();
            }}
            className="h-9 w-14 shrink-0 rounded-md border-none bg-transparent text-center text-base font-semibold tabular-nums outline-none focus-visible:ring-1 focus-visible:ring-ring/50 [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
          />
          <span className="text-xs font-normal text-muted-foreground">{unit}</span>
        </label>
        <Button
          type="button"
          variant="outline"
          size="icon-lg"
          aria-label="Sumar"
          onClick={() => setDisplayValue(displayValue + displayStep)}
        >
          <PlusIcon />
        </Button>
        {/*
         * Acción principal de esta barra. Sigue disponible ya confirmada
         * porque tras reajustar el valor hay que poder volver a validarlo,
         * pero baja de jerarquía para no invitar a pulsarla dos veces.
         */}
        <Button
          type="button"
          size="lg"
          variant={confirmed ? "outline" : "default"}
          className="ml-auto shrink-0"
          onClick={onConfirm}
        >
          <CheckIcon />
          {confirmed ? "Confirmada" : "Confirmar"}
        </Button>
      </div>

      {/*
       * El recorrido cubre todo el rango de captura (0–200 cm) y la banda
       * sombreada marca lo habitual del campo. Antes el slider TERMINABA en
       * el rango habitual y un cliente de medidas grandes simplemente no
       * cabía; ahora el límite es visual y el sastre decide.
       */}
      <Slider
        size="touch"
        min={displayMin}
        max={displayMax}
        step={displayStep}
        band={{ from: cmToUnit(config.typicalMin, unit), to: cmToUnit(config.typicalMax, unit) }}
        value={displayValue}
        onValueChange={(v) => setDisplayValue(Array.isArray(v) ? v[0] : v)}
      />
    </div>
  );
}
