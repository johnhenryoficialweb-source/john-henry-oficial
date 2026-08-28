"use client";

import { CheckIcon, PencilIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { getMeasurementFieldLabel } from "@/lib/constants";
import type { GarmentType } from "@/types/database.types";

/**
 * Cuadrícula tipo "ficha técnica" (micro-etiqueta + valor grande) para
 * elegir qué medida tomar, en vez de pastillas genéricas — es la
 * alternativa fácil de tocar a acertarle a un hotspot diminuto sobre el
 * maniquí (uso principal: celular/tablet en el probador), pero pensada
 * para leerse como una ficha de sastrería, no como tags de formulario.
 *
 * `@container` (no un breakpoint de viewport) porque este mismo grid se usa
 * angosto — la tarjeta de resumen por prenda, ~300px — y ancho — la tira
 * bajo el maniquí grande —, y con columnas fijas por viewport el texto de
 * etiquetas largas ("Largo de espalda") se partía palabra por palabra.
 *
 * Tres estados, no dos. "Sugerida" (tiene número, nadie la validó) tiene que
 * distinguirse a simple vista de "confirmada": son visualmente parecidas y
 * significan cosas opuestas — una está tomada y la otra es una conjetura de la
 * estimación por altura.
 */
export function MeasurementFieldChips({
  garmentType,
  fields,
  measurements,
  confirmedFields,
  activeField,
  onSelect,
}: {
  garmentType: GarmentType;
  fields: string[];
  measurements: Record<string, number>;
  confirmedFields: Set<string>;
  activeField: string | null;
  onSelect: (field: string) => void;
}) {
  return (
    <div className="@container">
      <div className="grid grid-cols-2 gap-2 @sm:grid-cols-3 @xl:grid-cols-4">
        {fields.map((field) => {
          const raw = measurements[field];
          const hasValue = typeof raw === "number" && raw > 0;
          const confirmed = confirmedFields.has(field);
          const active = activeField === field;

          return (
            <button
              key={field}
              type="button"
              onClick={() => onSelect(field)}
              className={cn(
                "group flex min-h-[4rem] flex-col items-start gap-1 rounded-lg border px-3 py-2.5 text-left transition-all active:scale-[0.98]",
                active
                  ? "border-primary bg-primary/10 shadow-[0_0_0_1px] shadow-primary/40"
                  : confirmed
                    ? "border-[#6f9c7d]/45 bg-[#6f9c7d]/[0.07] hover:border-[#6f9c7d]/70"
                    : hasValue
                      // Sugerida: borde punteado como "sin medir", porque eso
                      // es lo que es — un valor de partida, no una medida.
                      ? "border-dashed border-border/70 bg-transparent hover:border-primary/40 hover:bg-primary/5"
                      : "border-dashed border-border/70 bg-transparent hover:border-border hover:bg-muted/40",
              )}
            >
              <span className="flex w-full items-start justify-between gap-1.5">
                <span className="text-[10px] leading-tight font-medium tracking-[0.08em] text-muted-foreground uppercase">
                  {getMeasurementFieldLabel(garmentType, field)}
                </span>
                {confirmed ? (
                  <CheckIcon className="size-3 shrink-0 text-[#6f9c7d]" />
                ) : (
                  <PencilIcon
                    className={cn(
                      "size-3 shrink-0 opacity-0 transition-opacity group-hover:opacity-60",
                      active && "opacity-70",
                    )}
                  />
                )}
              </span>
              <span className="flex items-baseline gap-1">
                <span
                  className={cn(
                    "font-heading text-lg leading-none tabular-nums",
                    active
                      ? "text-primary"
                      : confirmed
                        ? "text-foreground"
                        : // El número sugerido va atenuado: se lee, pero no
                          // reclama el peso de un dato tomado.
                          "text-muted-foreground",
                  )}
                >
                  {hasValue ? raw.toFixed(1) : "—"}
                </span>
                {hasValue && <span className="text-[10px] text-muted-foreground">cm</span>}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
