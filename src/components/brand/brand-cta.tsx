import Link from "next/link";
import { cn } from "@/lib/utils";

/**
 * CTA de referencia del sitio público.
 *
 * La marca no empuja: no hay urgencia, ni contadores, ni verbos de presión.
 * El CTA es una invitación, no un llamado. De ahí las decisiones de forma:
 * sin relleno sólido que compita, una línea de 1px en oro medio como único
 * borde, y una transición larga (500ms) — nada "juguetón", nada con bounce.
 *
 * Regla de una sola acción principal por pantalla: `primary` aparece una vez.
 * Todo lo demás es `quiet`.
 */

type BrandCtaProps = {
  href: string;
  children: React.ReactNode;
  /**
   * `primary` — la única acción destacada de la pantalla.
   * `quiet`   — acciones secundarias; ceden jerarquía visual.
   */
  tone?: "primary" | "quiet";
  className?: string;
};

export function BrandCta({ href, children, tone = "primary", className }: BrandCtaProps) {
  return (
    <Link
      href={href}
      className={cn(
        "group inline-flex items-center gap-4 font-institutional text-[10px] uppercase",
        "tracking-[0.32em] transition-colors duration-500 ease-out",
        tone === "primary"
          ? "border border-[var(--jh-gold-mid)]/50 px-8 py-4 text-[var(--jh-gold)] hover:border-[var(--jh-gold)] hover:bg-[var(--jh-gold)]/[0.06]"
          : "text-[var(--jh-ivory)]/60 hover:text-[var(--jh-gold)]",
        className,
      )}
    >
      <span>{children}</span>
      {/*
       * Regla marcada: nada de iconografía de librería. Es una línea, no una
       * flecha — se extiende al hover en lugar de "apuntar". Decorativa, por
       * eso aria-hidden.
       */}
      <span
        aria-hidden
        className={cn(
          "h-px bg-current transition-all duration-500 ease-out",
          tone === "primary" ? "w-6 group-hover:w-10" : "w-4 group-hover:w-8",
        )}
      />
    </Link>
  );
}
