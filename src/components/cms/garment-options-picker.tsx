"use client";

import { useMemo } from "react";
import { EraserIcon, SlidersHorizontalIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  GARMENT_SPEC_GROUPS,
  composeSpec,
  countSpecGroups,
  countSpecSelections,
  parseSpec,
  type SpecFlag,
  type SpecGroup,
  type SpecSelection,
} from "@/lib/orders/garment-options";
import { cn } from "@/lib/utils";
import type { GarmentType } from "@/types/database.types";

/**
 * Selector de opciones de confección.
 *
 * No guarda estado propio: lee las opciones marcadas DESDE `spec` y devuelve
 * el `spec` recompuesto. Los chips y el cuadro de texto de abajo son dos
 * vistas de la misma cadena, así que editar a mano actualiza los chips y
 * marcar un chip actualiza el texto — nunca hay dos versiones de la verdad
 * que puedan discrepar.
 */
export function GarmentOptionsPicker({
  garmentType,
  spec,
  onSpecChange,
}: {
  garmentType: GarmentType;
  spec: string;
  onSpecChange: (spec: string) => void;
}) {
  const groups = GARMENT_SPEC_GROUPS[garmentType] ?? [];
  const selection = useMemo(() => parseSpec(garmentType, spec), [garmentType, spec]);

  if (groups.length === 0) return null;

  const marked = countSpecSelections(selection);
  const total = countSpecGroups(garmentType);

  function emit(next: SpecSelection) {
    onSpecChange(composeSpec(garmentType, next));
  }

  function clone(): SpecSelection {
    return {
      picked: new Set(selection.picked),
      flags: { ...selection.flags },
      texts: { ...selection.texts },
      free: [...selection.free],
    };
  }

  function togglePicked(group: SpecGroup, optionId: string) {
    const next = clone();
    const wasPicked = next.picked.has(optionId);
    // En un grupo excluyente elegir uno apaga al anterior sin pedir que lo
    // quiten primero: un saco no puede ser sencillo y cruzado a la vez.
    if (group.mode === "single") {
      for (const option of group.options) next.picked.delete(option.id);
    }
    if (!wasPicked) next.picked.add(optionId);
    emit(next);
  }

  function setFlag(optionId: string, value: SpecFlag) {
    const next = clone();
    // Volver a tocar la respuesta puesta la borra: "sin responder" es un
    // estado legítimo y distinto de NO — no todas las piezas aplican.
    if (next.flags[optionId] === value) delete next.flags[optionId];
    else next.flags[optionId] = value;
    emit(next);
  }

  function setText(optionId: string, value: string) {
    const next = clone();
    // Las comas separan opciones en la especificación: dentro de un código de
    // material partirían el valor en dos segmentos que ya no son ese código.
    const clean = value.replace(/[,;\n]/g, " ");
    if (clean.trim()) next.texts[optionId] = clean;
    else delete next.texts[optionId];
    emit(next);
  }

  /** Quita solo lo que este selector puso; el texto escrito a mano se queda. */
  function clearOptions() {
    emit({ picked: new Set(), flags: {}, texts: {}, free: selection.free });
  }

  return (
    /* @container: la ficha vive dentro de una tarjeta que a su vez cambia de
       ancho con el layout de la orden. Las columnas tienen que responder a ESE
       ancho, no al de la ventana. */
    <div className="@container space-y-3">
      <div className="flex items-center justify-between gap-2">
        <p className="flex items-center gap-1.5 text-[11px] tracking-[0.04em] text-muted-foreground uppercase">
          <SlidersHorizontalIcon className="size-3" />
          Opciones de confección
        </p>
        <div className="flex items-center gap-2">
          <span className="text-[11px] tabular-nums text-muted-foreground">
            {marked > 0 ? `${marked} de ${total} marcadas` : `${total} opciones`}
          </span>
          {marked > 0 && (
            <Button type="button" variant="ghost" size="sm" onClick={clearOptions}>
              <EraserIcon />
              Limpiar
            </Button>
          )}
        </div>
      </div>

      <div className="grid gap-3 @md:grid-cols-2">
        {groups.map((group) => (
          <div
            key={group.id}
            className="space-y-1.5 rounded-lg border border-border bg-background p-2.5"
          >
            <div className="flex items-baseline justify-between gap-2">
              <Label className="text-[11px] tracking-[0.04em] text-muted-foreground uppercase">
                {group.label}
              </Label>
              {group.mode === "single" && (
                <span className="text-[10px] text-muted-foreground/70">una opción</span>
              )}
            </div>

            {group.mode === "text" ? (
              group.options.map((option) => (
                <div key={option.id} className="flex items-center gap-1.5">
                  <span className="shrink-0 text-xs text-muted-foreground">{option.label}</span>
                  <Input
                    value={selection.texts[option.id] ?? ""}
                    onChange={(e) => setText(option.id, e.target.value)}
                    placeholder="Código o referencia"
                    aria-label={`${group.label} — ${option.label}`}
                    className="h-7 text-xs"
                  />
                </div>
              ))
            ) : group.mode === "flags" ? (
              <div className="space-y-1">
                {group.options.map((option) => {
                  const answer = selection.flags[option.id];
                  return (
                    <div key={option.id} className="flex items-center justify-between gap-2">
                      <span
                        className={cn(
                          "text-xs",
                          answer ? "text-foreground" : "text-muted-foreground"
                        )}
                      >
                        {option.label}
                      </span>
                      <div className="flex shrink-0 gap-1">
                        {(["SI", "NO"] as const).map((value) => (
                          <button
                            key={value}
                            type="button"
                            aria-pressed={answer === value}
                            onClick={() => setFlag(option.id, value)}
                            className={cn(
                              "min-w-9 rounded-md border px-1.5 py-0.5 text-[11px] font-medium transition-colors",
                              answer === value
                                ? value === "SI"
                                  ? "border-[#6f9c7d] bg-[#6f9c7d]/10 text-foreground"
                                  : "border-border bg-muted text-foreground"
                                : "border-border/70 text-muted-foreground hover:border-primary/50 hover:text-foreground"
                            )}
                          >
                            {value}
                          </button>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="flex flex-wrap gap-1.5">
                {group.options.map((option) => {
                  const picked = selection.picked.has(option.id);
                  return (
                    <button
                      key={option.id}
                      type="button"
                      aria-pressed={picked}
                      onClick={() => togglePicked(group, option.id)}
                      className={cn(
                        "rounded-full border px-2.5 py-1 text-xs transition-colors",
                        picked
                          ? "border-primary bg-primary/10 text-foreground"
                          : "border-border text-muted-foreground hover:border-primary/50 hover:text-foreground"
                      )}
                    >
                      {option.label}
                    </button>
                  );
                })}
              </div>
            )}

            {group.hint && marked === 0 && (
              <p className="text-[10px] text-muted-foreground/80">{group.hint}</p>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
