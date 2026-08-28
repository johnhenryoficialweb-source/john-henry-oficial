import { cn } from "@/lib/utils";
import { JhMark } from "./jh-mark";

/**
 * Sistema de logo JOHN HENRY — tres formas, tres variantes de color.
 *
 * Formas (según contexto de uso, ver manual de marca §3):
 *   - Isotipo   → solo el símbolo. Favicon, loader, bordados, marcas de agua.
 *   - Logotipo  → solo el texto. Navegación, contextos donde el símbolo no
 *                 aporta información.
 *   - Imagotipo → símbolo sobre el texto. Hero, footer, presentaciones.
 *
 * Variantes de color: son las tres únicas combinaciones permitidas. El
 * componente no expone colores libres a propósito — un color fuera de estas
 * tres combinaciones está fuera del sistema de marca.
 */

export type LogoVariant = "navy" | "black" | "ivory";

const VARIANT_STYLES: Record<LogoVariant, { surface: string; ink: string }> = {
  // A — Principal. La mayor parte del sitio.
  navy: { surface: "bg-[var(--jh-navy)]", ink: "text-[var(--jh-gold)]" },
  // B — Nivel más alto. Hecho a medida, footer de cierre. Escaso a propósito.
  black: { surface: "bg-[var(--jh-black)]", ink: "text-[var(--jh-gold)]" },
  // C — Sobre claro. Papelería, secciones en marfil.
  ivory: { surface: "bg-[var(--jh-ivory)]", ink: "text-[var(--jh-navy)]" },
};

/**
 * El nombre se escribe siempre en mayúsculas sostenidas, en Cormorant
 * Garamond Light, con tracking generoso. `tracking-[0.28em]` incluye un
 * `pl` equivalente para compensar el espacio que CSS añade *después* de la
 * última letra, que de otro modo descentra el bloque.
 */
function Wordmark({ size = "md" }: { size?: "sm" | "md" | "lg" }) {
  const scale = {
    sm: "text-lg tracking-[0.24em] pl-[0.24em]",
    md: "text-2xl tracking-[0.28em] pl-[0.28em]",
    lg: "text-4xl tracking-[0.3em] pl-[0.3em]",
  }[size];

  return (
    <span className={cn("block text-center font-display font-light whitespace-nowrap uppercase", scale)}>
      John Henry
    </span>
  );
}

/**
 * Línea institucional. EST. 2004 es el dato confirmado por el equipo; la
 * antigüedad nunca se expresa como cifra de años en copy — ver
 * `docs/` y la regla de voz sobre lenguaje de validación.
 */
function InstitutionalLine({ size = "md" }: { size?: "sm" | "md" | "lg" }) {
  const scale = {
    sm: "text-[7px] tracking-[0.34em] pl-[0.34em]",
    md: "text-[8px] tracking-[0.38em] pl-[0.38em]",
    lg: "text-[10px] tracking-[0.42em] pl-[0.42em]",
  }[size];

  return (
    <span className={cn("block text-center font-institutional whitespace-nowrap uppercase", scale)}>
      Sastrería · Est. 2004
    </span>
  );
}

type LogoProps = {
  variant?: LogoVariant;
  size?: "sm" | "md" | "lg";
  className?: string;
  /** Pinta la superficie de la variante. El logo nunca va sobre fotografía sin fondo sólido. */
  withSurface?: boolean;
};

export function Isotipo({ variant = "navy", size = "md", className, withSurface = false }: LogoProps) {
  const { surface, ink } = VARIANT_STYLES[variant];
  const box = { sm: "size-6", md: "size-10", lg: "size-16" }[size];

  return (
    <span
      className={cn(
        "inline-flex items-center justify-center",
        ink,
        withSurface && cn(surface, "p-[var(--jh-clearspace)]"),
        className,
      )}
    >
      <JhMark className={box} title="JOHN HENRY" />
    </span>
  );
}

export function Logotipo({ variant = "navy", size = "md", className, withSurface = false }: LogoProps) {
  const { surface, ink } = VARIANT_STYLES[variant];

  return (
    <span
      className={cn(
        "inline-flex flex-col items-center gap-3",
        ink,
        withSurface && cn(surface, "p-[var(--jh-clearspace)]"),
        className,
      )}
    >
      <Wordmark size={size} />
      <InstitutionalLine size={size} />
    </span>
  );
}

export function Imagotipo({ variant = "navy", size = "md", className, withSurface = false }: LogoProps) {
  const { surface, ink } = VARIANT_STYLES[variant];
  const box = { sm: "size-8", md: "size-14", lg: "size-20" }[size];
  const gap = { sm: "gap-3", md: "gap-5", lg: "gap-7" }[size];

  return (
    <span
      className={cn(
        "inline-flex flex-col items-center",
        gap,
        ink,
        withSurface && cn(surface, "p-[var(--jh-clearspace)]"),
        className,
      )}
    >
      {/* Sin `title`: el nombre ya va en texto debajo y se anunciaría dos veces. */}
      <JhMark className={box} />
      <span className="flex flex-col items-center gap-3">
        <Wordmark size={size} />
        <InstitutionalLine size={size} />
      </span>
    </span>
  );
}
