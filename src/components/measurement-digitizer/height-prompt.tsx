"use client";

import { useState } from "react";
import { MinusIcon, PlusIcon, RulerIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { HEIGHT_FIELD_CONFIG, cmToUnit, unitToCm } from "./config";
import type { MeasurementUnit } from "@/types/database.types";

/**
 * Se muestra antes del maniquí cuando la prenda todavía no tiene ninguna
 * medida capturada: con solo la altura, el resto del cuerpo se estima
 * proporcionalmente (ver estimateMeasurementsFromHeight en config.ts), así
 * el sastre arranca ajustando en vez de partir de un maniquí genérico.
 */
export function HeightPrompt({
  unit,
  onConfirm,
  onSkip,
}: {
  unit: MeasurementUnit;
  onConfirm: (heightCm: number) => void;
  onSkip: () => void;
}) {
  const [heightCm, setHeightCm] = useState(HEIGHT_FIELD_CONFIG.default);
  const displayValue = cmToUnit(heightCm, unit);
  const displayMin = cmToUnit(HEIGHT_FIELD_CONFIG.min, unit);
  const displayMax = cmToUnit(HEIGHT_FIELD_CONFIG.max, unit);
  const displayStep = cmToUnit(HEIGHT_FIELD_CONFIG.step, unit);

  function setDisplayValue(next: number) {
    const clamped = Math.min(
      HEIGHT_FIELD_CONFIG.max,
      Math.max(HEIGHT_FIELD_CONFIG.min, unitToCm(next, unit))
    );
    setHeightCm(clamped);
  }

  return (
    <div className="flex h-full flex-col items-center justify-center gap-4 p-6 text-center">
      <div className="flex size-11 items-center justify-center rounded-full bg-primary/15 text-primary">
        <RulerIcon className="size-5" />
      </div>
      <div className="space-y-1">
        <p className="font-medium">¿Cuál es la altura del cliente?</p>
        <p className="text-sm text-muted-foreground">
          Con este dato calculamos medidas iniciales razonables para todo el cuerpo — solo
          tendrás que ajustar lo puntual.
        </p>
      </div>

      <div className="flex w-full max-w-56 items-center gap-2">
        <Button
          type="button"
          variant="outline"
          size="icon-lg"
          aria-label="Restar"
          onClick={() => setDisplayValue(displayValue - displayStep)}
        >
          <MinusIcon />
        </Button>
        <p className="min-w-20 text-center text-xl font-semibold tabular-nums">
          {displayValue.toFixed(0)}
          <span className="ml-1 text-sm font-normal text-muted-foreground">{unit}</span>
        </p>
        <Button
          type="button"
          variant="outline"
          size="icon-lg"
          aria-label="Sumar"
          onClick={() => setDisplayValue(displayValue + displayStep)}
        >
          <PlusIcon />
        </Button>
      </div>
      <Slider
        size="touch"
        className="w-full max-w-56"
        min={displayMin}
        max={displayMax}
        step={displayStep}
        band={{
          from: cmToUnit(HEIGHT_FIELD_CONFIG.typicalMin, unit),
          to: cmToUnit(HEIGHT_FIELD_CONFIG.typicalMax, unit),
        }}
        value={displayValue}
        onValueChange={(v) => setDisplayValue(Array.isArray(v) ? v[0] : v)}
      />

      <div className="flex gap-2">
        <Button type="button" variant="ghost" size="sm" onClick={onSkip}>
          Omitir, usar promedio
        </Button>
        <Button type="button" size="sm" onClick={() => onConfirm(heightCm)}>
          Continuar
        </Button>
      </div>
    </div>
  );
}
