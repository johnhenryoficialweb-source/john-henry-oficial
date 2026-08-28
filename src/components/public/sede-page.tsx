import { getPublicLocations } from "@/lib/locations/public";
import { BrandCta } from "@/components/brand/brand-cta";
import { TreatedImage } from "@/components/brand/treated-image";
import { AMBIENTE } from "@/lib/brand/imagery";
import type { LocationCode } from "@/config/locations";

/**
 * Plantilla de sede. Bogotá y Panamá comparten estructura porque el estándar
 * es idéntico en los dos mercados — lo único que cambia es el matiz del copy.
 * Panamá carga el componente diplomático/internacional y la discreción del
 * proceso; Bogotá carga el origen.
 *
 * Los datos operativos (dirección, teléfono, horario) vienen de Supabase: son
 * editables desde el CMS y no se hardcodean acá.
 */

type SedeCopy = {
  code: LocationCode;
  city: string;
  eyebrow: string;
  headline: string;
  body: string[];
  image: (typeof AMBIENTE)[keyof typeof AMBIENTE];
};

export async function SedePage({ copy }: { copy: SedeCopy }) {
  const locations = await getPublicLocations();
  const loc = locations.find((l) => l.code === copy.code);

  return (
    <>
      <section className="relative flex min-h-[65vh] items-end overflow-hidden">
        <TreatedImage image={copy.image} width={2400} priority sizes="100vw" scrim="bottom" className="absolute inset-0" />
        <div className="relative mx-auto w-full max-w-6xl px-6 pb-24 lg:px-10">
          <p className="font-institutional text-[10px] tracking-[0.42em] text-[var(--jh-gold)] uppercase">
            {copy.eyebrow}
          </p>
          <h1 className="mt-8 font-display text-5xl leading-[1.2] font-light text-[var(--jh-ivory)] md:text-6xl">
            {copy.city}
          </h1>
        </div>
      </section>

      <section className="bg-[var(--jh-navy)] py-32">
        <div className="mx-auto grid max-w-6xl grid-cols-1 gap-16 px-6 lg:grid-cols-12 lg:px-10">
          <div className="lg:col-span-7">
            <p className="font-display text-2xl leading-[1.6] font-light text-[var(--jh-ivory)]/85">
              {copy.headline}
            </p>
            <div className="mt-10 space-y-8 font-display text-lg leading-[1.8] font-light text-[var(--jh-ivory)]/60">
              {copy.body.map((p) => (
                <p key={p.slice(0, 24)}>{p}</p>
              ))}
            </div>
          </div>

          {/* Contexto permanente: dónde está, qué está viendo, cómo llegar. */}
          <aside className="lg:col-span-4 lg:col-start-9">
            <div className="border-t border-[var(--jh-gold-mid)]/25 pt-8">
              <p className="font-institutional text-[9px] tracking-[0.34em] text-[var(--jh-gold)] uppercase">
                La sede
              </p>
              {loc ? (
                <div className="mt-6 space-y-4 font-display text-lg leading-relaxed text-[var(--jh-ivory)]/60">
                  {loc.address && <p>{loc.address}</p>}
                  {loc.phone && (
                    <a
                      href={`tel:${loc.phone}`}
                      className="block transition-colors duration-500 hover:text-[var(--jh-gold)]"
                    >
                      {loc.phone}
                    </a>
                  )}
                  <p className="text-[var(--jh-ivory)]/40">{loc.country}</p>
                </div>
              ) : (
                <p className="mt-6 font-display text-lg text-[var(--jh-ivory)]/45">
                  Los datos de esta sede se coordinan en la conversación.
                </p>
              )}
            </div>

            <p className="mt-12 font-display text-lg leading-relaxed font-light text-[var(--jh-ivory)]/50 italic">
              El precio refleja el mercado. El estándar nunca cambia.
            </p>

            <div className="mt-12">
              <BrandCta href="/citas">Solicitar una conversación</BrandCta>
            </div>
          </aside>
        </div>
      </section>
    </>
  );
}
