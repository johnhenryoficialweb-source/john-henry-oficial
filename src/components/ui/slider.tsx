"use client"

import { Slider as SliderPrimitive } from "@base-ui/react/slider"

import { cn } from "@/lib/utils"

type SliderSize = "default" | "touch"

/**
 * `touch` es para los sliders que se arrastran con el dedo en tablet — el
 * caso real de la toma de medidas, que se hace de pie con el cliente delante y
 * no con un mouse. Sube el pulsador de 16px a 28px y engorda la pista: 16px es
 * la mitad del objetivo táctil mínimo, así que agarrarlo era cuestión de
 * suerte y un fallo arrastraba la página en vez del valor.
 *
 * `band` marca en la pista el tramo "habitual" de un valor sin restringirlo:
 * el recorrido sigue llegando a los extremos reales del campo, pero se ve de
 * un vistazo dónde cae lo normal y cuándo se está saliendo de ahí.
 */
function Slider({
  className,
  size = "default",
  band,
  ...props
}: SliderPrimitive.Root.Props<number | readonly number[]> & {
  size?: SliderSize
  band?: { from: number; to: number }
}) {
  const min = typeof props.min === "number" ? props.min : 0
  const max = typeof props.max === "number" ? props.max : 100
  const span = max - min || 1
  const bandStyle = band
    ? {
        left: `${(Math.max(0, (band.from - min) / span) * 100).toFixed(2)}%`,
        width: `${(Math.max(0, Math.min(1, (band.to - min) / span) - Math.max(0, (band.from - min) / span)) * 100).toFixed(2)}%`,
      }
    : undefined

  return (
    <SliderPrimitive.Root
      data-slot="slider"
      className={cn("relative flex w-full touch-none items-center select-none", className)}
      {...props}
    >
      <SliderPrimitive.Control
        className={cn("flex w-full items-center", size === "touch" ? "py-3" : "py-2")}
      >
        {/*
         * La pista NO lleva `overflow-hidden`. Lo llevaba para recortar las
         * puntas del relleno, pero recortaba también el pulsador a la altura
         * de la pista: en vez de un botón redondo se veía una astilla vertical
         * de unos pocos píxeles, imposible de agarrar con el dedo. El relleno
         * se redondea solo (`rounded-full`), que es lo que hacía falta.
         */}
        <SliderPrimitive.Track
          className={cn(
            "relative w-full grow rounded-full bg-muted",
            size === "touch" ? "h-2.5" : "h-1.5"
          )}
        >
          {bandStyle ? (
            <div
              aria-hidden
              className="pointer-events-none absolute inset-y-0 rounded-full bg-primary/25"
              style={bandStyle}
            />
          ) : null}
          <SliderPrimitive.Indicator className="absolute h-full rounded-full bg-primary" />
          <SliderThumbs size={size} {...props} />
        </SliderPrimitive.Track>
      </SliderPrimitive.Control>
    </SliderPrimitive.Root>
  )
}

function SliderThumbs({
  value,
  defaultValue,
  size = "default",
}: {
  value?: number | readonly number[]
  defaultValue?: number | readonly number[]
  size?: SliderSize
}) {
  const resolved = value ?? defaultValue
  const count = Array.isArray(resolved) ? resolved.length : 1
  return (
    <>
      {Array.from({ length: count }).map((_, index) => (
        <SliderPrimitive.Thumb
          key={index}
          index={index}
          className={cn(
            "block shrink-0 rounded-full border-2 border-primary bg-background shadow-sm transition-[color,box-shadow] hover:ring-4 hover:ring-primary/20 focus-visible:ring-4 focus-visible:ring-primary/30 focus-visible:outline-none disabled:pointer-events-none disabled:opacity-50",
            size === "touch" ? "size-7 shadow-md" : "size-4"
          )}
        />
      ))}
    </>
  )
}

export { Slider }
