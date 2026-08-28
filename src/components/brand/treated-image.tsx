import Image from "next/image";
import { cn } from "@/lib/utils";
import { unsplash, type Treatment } from "@/lib/brand/imagery";

/**
 * Tratamiento visual unificado de fotografía.
 *
 * Este componente es la razón de que fotografía de autores distintos se lea
 * como un solo sistema: desatura parcialmente y tiñe los bordes hacia navy /
 * negro profundo, de forma que ninguna imagen traiga su propio registro
 * cromático al sitio.
 *
 * Los tres grados existen porque las tres familias de foto cargan pesos
 * distintos: el proceso es el contenido más fuerte de la marca y se deja
 * respirar; el ambiente se hunde más porque la prenda, no el rostro, es el
 * protagonista.
 */

const TREATMENT: Record<Treatment, { filter: string; veil: string }> = {
  // Manos, tela, tiza. El más legible — es lo que la marca quiere que se vea.
  proceso: { filter: "grayscale-[0.2] contrast-[1.04]", veil: "from-[var(--jh-navy-deep)]/70 via-transparent to-[var(--jh-navy-deep)]/40" },
  // Detalle de construcción. La textura manda; el color casi no importa.
  producto: { filter: "grayscale-[0.3] contrast-[1.06]", veil: "from-[var(--jh-navy-deep)]/50 via-transparent to-[var(--jh-navy-deep)]/30" },
  // Contexto. El más hundido: el rostro no es el punto.
  ambiente: { filter: "grayscale-[0.35] contrast-[1.02]", veil: "from-[var(--jh-navy-deep)]/80 via-[var(--jh-navy-deep)]/20 to-[var(--jh-black)]/60" },
};

type TreatedImageProps = {
  /** Imagen curada de relleno (Unsplash). Excluyente con `src`. */
  image?: { id: string; alt: string; treatment: Treatment };
  /**
   * Imagen real subida desde el CMS (telas, galería). Recibe exactamente el
   * mismo tratamiento que las de relleno: es lo que hace que el catálogo no se
   * despegue visualmente del resto del sitio cuando entre contenido real.
   */
  src?: string;
  alt?: string;
  treatment?: Treatment;
  /** Ancho solicitado a Unsplash. Ignorado cuando se usa `src`. */
  width?: number;
  className?: string;
  /** Marcar solo en la imagen del hero — evita que compita por la red. */
  priority?: boolean;
  sizes?: string;
  /**
   * Velo adicional para imágenes que llevan texto encima. El tratamiento base
   * unifica el color pero no garantiza contraste: sin esto, un titular sobre
   * foto es ilegible. `left` para composiciones a un tercio, `bottom` para
   * titulares al pie.
   */
  scrim?: "left" | "bottom";
};

/**
 * El scrim protege el texto sin apagar la foto. Va fuerte donde arranca el
 * texto y se suelta rápido: si cubre toda la imagen, la sección se lee como un
 * panel de color plano y la fotografía deja de aportar.
 */
const SCRIM = {
  left: "bg-gradient-to-r from-[var(--jh-navy-deep)]/92 from-10% via-[var(--jh-navy-deep)]/45 via-45% to-transparent",
  bottom: "bg-gradient-to-t from-[var(--jh-navy-deep)]/92 from-5% via-[var(--jh-navy-deep)]/40 via-40% to-transparent",
} as const;

export function TreatedImage({
  image,
  src,
  alt,
  treatment,
  width = 1600,
  className,
  priority = false,
  sizes = "100vw",
  scrim,
}: TreatedImageProps) {
  const resolvedTreatment = image?.treatment ?? treatment ?? "producto";
  const resolvedSrc = image ? unsplash(image.id, width) : src;
  const resolvedAlt = image?.alt ?? alt ?? "";
  const { filter, veil } = TREATMENT[resolvedTreatment];

  if (!resolvedSrc) return null;

  return (
    <div className={cn("relative overflow-hidden bg-[var(--jh-navy-deep)]", className)}>
      <Image
        src={resolvedSrc}
        alt={resolvedAlt}
        fill
        sizes={sizes}
        priority={priority}
        // Las imágenes del CMS viven en R2 y no están en `remotePatterns`;
        // se sirven sin pasar por el optimizador.
        unoptimized={!image}
        className={cn("object-cover", filter)}
      />
      {/* Velo: hunde los bordes en la paleta para que la foto no traiga su
          propio fondo. Decorativo. */}
      <div aria-hidden className={cn("absolute inset-0 bg-gradient-to-b", veil)} />
      {scrim && <div aria-hidden className={cn("absolute inset-0", SCRIM[scrim])} />}
    </div>
  );
}
