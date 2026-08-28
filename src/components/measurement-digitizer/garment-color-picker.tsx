"use client";

import { useEffect, useRef, useState } from "react";
import { CheckIcon, ChevronDownIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { GARMENT_SWATCHES, DEFAULT_GARMENT_COLOR } from "./garment-colors";

function isValidHex(value: string): boolean {
  return /^#[0-9a-fA-F]{6}$/.test(value);
}

/**
 * Color de la prenda en el visor 3D.
 *
 * Un solo botón que muestra el color puesto y abre un panel con TODA la paleta
 * a la vista, más el selector libre para el paño que no cae en ninguna.
 *
 * Antes los catorce swatches vivían en la barra superior, en una franja de
 * 132px con scroll horizontal: se veían seis, había que arrastrar una tira
 * diminuta para llegar al resto y en una tablet eso no se puede usar. La franja
 * existía para que la barra no se partiera en tres líneas — el problema real
 * era meter catorce objetivos táctiles en una fila junto a las vistas y el
 * contador. Un disparador de 36px lo resuelve de raíz: ocupa una cuarta parte,
 * la barra no se parte, y los colores se ven todos de una vez al abrirlo.
 */
export function GarmentColorPicker({
  color,
  onChange,
}: {
  color: string;
  onChange: (hex: string) => void;
}) {
  const [open, setOpen] = useState(false);
  /*
   * `null` = "muestra el color real". Solo guarda texto mientras el sastre
   * está escribiendo un hex a mano, que es el único momento en que el campo
   * puede divergir del color puesto (un hex a medio teclear no es un color).
   *
   * Con un `useState(color)` corriente el campo se quedaba clavado en el hex
   * de apertura: al elegir un swatch el color cambiaba y el campo seguía
   * mostrando el anterior, contradiciéndose con el swatch marcado justo
   * encima. Derivarlo evita esa deriva sin un efecto de sincronización.
   */
  const [typedHex, setTypedHex] = useState<string | null>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);

  const selected = GARMENT_SWATCHES.find((s) => s.hex.toLowerCase() === color.toLowerCase());
  const isCustom = !selected;
  const hexInput = typedHex ?? color.toLowerCase();

  function toggleOpen() {
    setTypedHex(null);
    setOpen((v) => !v);
  }

  useEffect(() => {
    if (!open) return;
    function handlePointerDown(event: PointerEvent) {
      if (!wrapperRef.current?.contains(event.target as Node)) setOpen(false);
    }
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [open]);

  function handleHexInput(value: string) {
    setTypedHex(value);
    const withHash = value.startsWith("#") ? value : `#${value}`;
    // Se aplica en cuanto el hex es válido — sin botón de confirmar: escribir
    // los 6 dígitos completos ya es la confirmación.
    if (isValidHex(withHash)) onChange(withHash.toLowerCase());
  }

  return (
    <div ref={wrapperRef} className="relative">
      <button
        type="button"
        aria-label={`Color de la prenda: ${selected?.label ?? "personalizado"}`}
        aria-expanded={open}
        aria-haspopup="dialog"
        onClick={toggleOpen}
        className={cn(
          "flex h-9 items-center gap-1.5 rounded-lg border border-border bg-background px-2 transition-colors outline-none",
          "hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50",
          open && "bg-muted"
        )}
      >
        <span
          aria-hidden
          style={{ backgroundColor: isValidHex(color) ? color : DEFAULT_GARMENT_COLOR }}
          className="size-5 rounded-full border border-border/60 shadow-inner"
        />
        <ChevronDownIcon className="size-3.5 text-muted-foreground" />
      </button>

      {open && (
        <div
          role="dialog"
          aria-label="Color de la prenda"
          className="absolute top-full right-0 z-20 mt-2 w-64 space-y-3 rounded-xl border border-border bg-popover p-3 shadow-lg"
        >
          <div className="space-y-0.5">
            <p className="text-xs font-medium">Color de la prenda</p>
            {/* El nombre del color puesto, escrito. Catorce círculos sin
                etiqueta obligan a adivinar cuál es "camel" y cuál "beige". */}
            <p className="text-[11px] text-muted-foreground">
              {selected?.label ?? `Personalizado · ${color.toLowerCase()}`}
            </p>
          </div>

          {/* Toda la paleta a la vista. Objetivos de 36px: se eligen con el
              dedo, de pie y con el cliente delante. */}
          <div className="grid grid-cols-5 gap-2">
            {GARMENT_SWATCHES.map((swatch) => {
              const active = swatch.hex.toLowerCase() === color.toLowerCase();
              return (
                <button
                  key={swatch.id}
                  type="button"
                  title={swatch.label}
                  aria-label={swatch.label}
                  aria-pressed={active}
                  onClick={() => {
                    setTypedHex(null);
                    onChange(swatch.hex);
                  }}
                  style={{ backgroundColor: swatch.hex }}
                  className={cn(
                    "flex size-9 items-center justify-center rounded-full border border-border/60 transition-transform outline-none",
                    "hover:scale-110 focus-visible:ring-2 focus-visible:ring-ring/60",
                    active && "ring-2 ring-primary ring-offset-2 ring-offset-popover"
                  )}
                >
                  {/* La marca se dibuja en el color del texto que mejor
                      contrasta con el paño: sobre marfil, un check blanco no
                      se ve. */}
                  {active && (
                    <CheckIcon
                      className="size-4"
                      style={{ color: isLightHex(swatch.hex) ? "#1b1b1d" : "#ffffff" }}
                    />
                  )}
                </button>
              );
            })}
          </div>

          <div className="space-y-1.5 border-t border-border pt-3">
            <p className="text-[11px] tracking-[0.04em] text-muted-foreground uppercase">
              Color personalizado
            </p>
            <div className="flex items-center gap-2">
              <input
                type="color"
                value={isValidHex(color) ? color : DEFAULT_GARMENT_COLOR}
                onChange={(e) => {
                  setTypedHex(null);
                  onChange(e.target.value);
                }}
                aria-label="Selector de color"
                className={cn(
                  "size-9 shrink-0 cursor-pointer rounded-lg border bg-transparent p-0",
                  isCustom ? "border-primary" : "border-border/60"
                )}
              />
              <input
                type="text"
                value={hexInput}
                onChange={(e) => handleHexInput(e.target.value)}
                placeholder="#28374f"
                spellCheck={false}
                aria-label="Código hexadecimal"
                className="h-9 w-full min-w-0 rounded-lg border border-input bg-transparent px-2 text-sm tabular-nums outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
              />
            </div>
          </div>

          <p className="text-[11px] text-muted-foreground">
            Solo para previsualizar la prenda — no cambia la tela del pedido.
          </p>
        </div>
      )}
    </div>
  );
}

/** Luminancia percibida, para decidir si la marca de selección va clara u oscura. */
function isLightHex(hex: string): boolean {
  const n = parseInt(hex.slice(1), 16);
  const r = (n >> 16) & 0xff;
  const g = (n >> 8) & 0xff;
  const b = n & 0xff;
  return (0.299 * r + 0.587 * g + 0.114 * b) / 255 > 0.6;
}
