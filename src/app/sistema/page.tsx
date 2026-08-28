import type { Metadata } from "next";
import { Isotipo, Logotipo, Imagotipo } from "@/components/brand/logo";
import { BrandCta } from "@/components/brand/brand-cta";

/**
 * Página interna de validación del sistema base de marca.
 *
 * Vive fuera del grupo `(public)` a propósito: no debe heredar el header ni el
 * footer del sitio, que todavía no están alineados a marca. No se enlaza desde
 * ninguna navegación — es una superficie de revisión, no una página del sitio.
 */
export const metadata: Metadata = {
  title: "Sistema base | JOHN HENRY",
  robots: { index: false, follow: false },
};

const PALETTE = [
  { name: "Azul Marino Profundo", hex: "#0D1F3C", use: "Principal. Domina la presencia visual.", token: "--jh-navy" },
  { name: "Oro Pálido", hex: "#E8D090", use: "El nombre. Siempre sobre fondo oscuro.", token: "--jh-gold" },
  { name: "Oro Medio", hex: "#C4A55A", use: "Acentos, líneas, detalles.", token: "--jh-gold-mid" },
  { name: "Negro Profundo", hex: "#0F0E0C", use: "Nivel más alto. Escaso a propósito.", token: "--jh-black" },
  { name: "Marfil Cálido", hex: "#F5F0E6", use: "Todo lo claro. Nunca blanco.", token: "--jh-ivory" },
  { name: "Bronce", hex: "#7A4E1A", use: "Hot stamping físico. No existe en pantalla.", token: "--jh-bronze" },
];

function SectionLabel({ children, index }: { children: React.ReactNode; index: string }) {
  return (
    <div className="flex items-baseline gap-6">
      <span className="font-institutional text-[var(--jh-gold-mid)]/70 text-xs tracking-[0.3em]">{index}</span>
      <h2 className="font-institutional text-[var(--jh-ivory)]/80 text-[10px] tracking-[0.42em] uppercase">
        {children}
      </h2>
      <span aria-hidden className="h-px flex-1 bg-[var(--jh-gold-mid)]/20" />
    </div>
  );
}

export default function SistemaPage() {
  return (
    <main className="min-h-screen bg-[var(--jh-navy)] px-8 py-24 md:px-16 lg:px-24">
      <div className="mx-auto max-w-5xl space-y-32">
        <header className="space-y-8">
          <p className="font-institutional text-[var(--jh-gold-mid)]/60 text-[10px] tracking-[0.42em] uppercase">
            Sistema base · Validación de dirección visual
          </p>
          <p className="max-w-2xl font-display text-3xl leading-[1.5] font-light text-[var(--jh-ivory)] md:text-4xl">
            La sastrería privada para el hombre que ya no tiene nada que demostrar
            <span className="text-[var(--jh-ivory)]/50"> — solo quiere que todo esté bien.</span>
          </p>
        </header>

        {/* ---------------------------------------------------------------- */}
        <section className="space-y-12">
          <SectionLabel index="01">Paleta</SectionLabel>
          <div className="grid grid-cols-2 gap-px bg-[var(--jh-gold-mid)]/15 md:grid-cols-3">
            {PALETTE.map((c) => (
              <div key={c.token} className="bg-[var(--jh-navy)] p-6">
                <div
                  className="h-24 w-full border border-[var(--jh-ivory)]/10"
                  style={{ backgroundColor: c.hex }}
                />
                <p className="mt-5 font-display text-lg font-light text-[var(--jh-ivory)]">{c.name}</p>
                <p className="mt-1 font-institutional text-[9px] tracking-[0.24em] text-[var(--jh-gold-mid)]">
                  {c.hex}
                </p>
                <p className="mt-3 font-display text-sm leading-relaxed text-[var(--jh-ivory)]/50">{c.use}</p>
              </div>
            ))}
          </div>
        </section>

        {/* ---------------------------------------------------------------- */}
        <section className="space-y-12">
          <SectionLabel index="02">Tipografía</SectionLabel>
          <div className="space-y-14">
            <div>
              <p className="font-institutional text-[9px] tracking-[0.3em] text-[var(--jh-gold-mid)]/70 uppercase">
                Cormorant Garamond · Light 300
              </p>
              <p className="mt-6 font-display text-5xl leading-tight font-light tracking-[0.2em] text-[var(--jh-ivory)] uppercase">
                John Henry
              </p>
              <p className="mt-6 max-w-2xl font-display text-xl leading-[1.6] font-light text-[var(--jh-ivory)]/70">
                Cada prenda comienza con una conversación. Termina con algo que no existía antes de usted.
              </p>
            </div>
            <div>
              <p className="font-institutional text-[9px] tracking-[0.3em] text-[var(--jh-gold-mid)]/70 uppercase">
                Cinzel · Regular 400
              </p>
              <p className="mt-6 font-institutional text-sm tracking-[0.42em] text-[var(--jh-ivory)] uppercase">
                Sastrería · Est. 2004
              </p>
              <p className="mt-4 font-institutional text-[10px] tracking-[0.36em] text-[var(--jh-ivory)]/60 uppercase">
                Bogotá · Ciudad de Panamá
              </p>
            </div>
          </div>
        </section>

        {/* ---------------------------------------------------------------- */}
        <section className="space-y-12">
          <SectionLabel index="03">Las tres formas del logo</SectionLabel>
          <div className="grid grid-cols-1 gap-px bg-[var(--jh-gold-mid)]/15 md:grid-cols-3">
            {[
              { label: "Isotipo", node: <Isotipo size="lg" />, note: "Favicon, loader, bordado, marca de agua." },
              { label: "Logotipo", node: <Logotipo size="md" />, note: "Navegación. Donde el símbolo no aporta." },
              { label: "Imagotipo", node: <Imagotipo size="md" />, note: "Hero, footer, presentaciones." },
            ].map((f) => (
              <div key={f.label} className="flex flex-col items-center bg-[var(--jh-navy)] px-6 py-16">
                <div className="flex min-h-40 items-center">{f.node}</div>
                <p className="mt-10 font-institutional text-[9px] tracking-[0.4em] text-[var(--jh-gold-mid)] uppercase">
                  {f.label}
                </p>
                <p className="mt-3 text-center font-display text-sm text-[var(--jh-ivory)]/45">{f.note}</p>
              </div>
            ))}
          </div>
        </section>

        {/* ---------------------------------------------------------------- */}
        <section className="space-y-12">
          <SectionLabel index="04">Las tres variantes de color</SectionLabel>
          <div className="grid grid-cols-1 gap-px bg-[var(--jh-gold-mid)]/15 md:grid-cols-3">
            <div className="flex items-center justify-center bg-[var(--jh-navy)] py-20">
              <Imagotipo variant="navy" size="sm" />
            </div>
            <div className="flex items-center justify-center bg-[var(--jh-black)] py-20">
              <Imagotipo variant="black" size="sm" />
            </div>
            <div className="flex items-center justify-center bg-[var(--jh-ivory)] py-20">
              <Imagotipo variant="ivory" size="sm" />
            </div>
          </div>
          <p className="font-display text-sm text-[var(--jh-ivory)]/45">
            A — Principal · B — Nivel más alto, hecho a medida · C — Sobre claro, papelería.
          </p>
        </section>

        {/* ---------------------------------------------------------------- */}
        <section className="space-y-12">
          <SectionLabel index="05">Acción</SectionLabel>
          <div className="flex flex-wrap items-center gap-14">
            <BrandCta href="/citas">Solicitar una conversación privada</BrandCta>
            <BrandCta href="/ready-to-wear" tone="quiet">
              Ver la línea
            </BrandCta>
          </div>
          <p className="max-w-xl font-display text-sm leading-relaxed text-[var(--jh-ivory)]/45">
            Una sola acción principal por pantalla. Sin urgencia, sin contadores, sin verbos de presión.
          </p>
        </section>

        <footer className="border-t border-[var(--jh-gold-mid)]/15 pt-12">
          <p className="font-display text-lg font-light text-[var(--jh-ivory)]/70 italic">
            Hecho para su cuerpo. Construido para su vida.
          </p>
        </footer>
      </div>
    </main>
  );
}
