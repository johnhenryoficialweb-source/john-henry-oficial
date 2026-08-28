import type { Metadata } from "next";
import { createAdminClient } from "@/lib/supabase/admin";
import { BrandCta } from "@/components/brand/brand-cta";
import { TreatedImage } from "@/components/brand/treated-image";
import { SACOS, PRODUCTO } from "@/lib/brand/imagery";

export const metadata: Metadata = {
  title: "Ready-to-Wear | JOHN HENRY",
  description: "Para el hombre que ya sabe quién es. Solo falta que su ropa lo diga también.",
};

/**
 * La cara pública de la marca. Es la única línea que se comunica abiertamente,
 * y el tono es ligeramente más abierto que el resto del sitio — está dirigida a
 * La Autoridad en Construcción.
 *
 * No hay checkout: no existe tienda virtual. Es showcase, y el destino de
 * cualquier interés es una conversación.
 */

const LANZAMIENTO = [
  {
    img: SACOS.navy,
    name: "Azul Marino",
    note: "El color de lanzamiento. El que hace todo lo que se espera de él, sin pedir permiso.",
  },
  {
    img: SACOS.negro,
    name: "Negro",
    note: "El dúo central junto al azul marino. Donde la silueta importa más que el color.",
  },
  {
    img: SACOS.camel,
    name: "Camel",
    note: "El diferenciador de la línea. El color que dice que esto no es genérico.",
  },
];

const DETALLES = [
  { title: "Sin bolsillos por fuera", body: "Porque la silueta no necesita interrupciones." },
  { title: "Un cuello que no cede", body: "Porque usted tampoco cede." },
  { title: "Bolsillos interiores", body: "Lo que necesita, donde nadie más lo pone." },
];

export default async function ReadyToWearPage() {
  const admin = createAdminClient();
  const { data: fabrics } = await admin
    .from("fabrics")
    .select("id, name, code, color, composition, image_url")
    .eq("is_active", true)
    .order("name");

  return (
    <>
      <section className="bg-[var(--jh-navy)] px-6 pt-40 pb-24 lg:px-10">
        <div className="mx-auto max-w-6xl">
          <p className="font-institutional text-[10px] tracking-[0.42em] text-[var(--jh-gold-mid)] uppercase">
            Ready-to-Wear
          </p>
          <h1 className="mt-8 max-w-3xl font-display text-4xl leading-[1.28] font-light text-[var(--jh-ivory)] md:text-5xl">
            Para el hombre que ya sabe quién es. Solo falta que su ropa lo diga también.
          </h1>
          <p className="mt-10 max-w-xl font-display text-lg leading-[1.75] font-light text-[var(--jh-ivory)]/55">
            La primera línea: un saco de tejido de punto con cremallera como alma estructural. No está pensado para
            una temporada. Está pensado para los próximos diez años de su guardarropa.
          </p>
        </div>
      </section>

      {/* Primera línea de sacos */}
      <section className="bg-[var(--jh-navy)] pb-32">
        <div className="mx-auto max-w-6xl px-6 lg:px-10">
          <div className="grid grid-cols-1 gap-x-8 gap-y-16 sm:grid-cols-3">
            {LANZAMIENTO.map((s) => (
              <article key={s.name}>
                <TreatedImage
                  image={s.img}
                  width={1000}
                  sizes="(max-width: 640px) 100vw, 33vw"
                  className="jh-unveil aspect-[3/4]"
                />
                <h2 className="mt-7 font-display text-2xl font-light text-[var(--jh-ivory)]">{s.name}</h2>
                <p className="mt-3 font-display text-base leading-relaxed text-[var(--jh-ivory)]/50">{s.note}</p>
              </article>
            ))}
          </div>

          {/* Segunda oleada: atenuada, sin fecha visible. */}
          <div className="mt-20 flex flex-wrap items-center gap-8 border-t border-[var(--jh-gold-mid)]/15 pt-10">
            <p className="font-institutional text-[9px] tracking-[0.34em] text-[var(--jh-ivory)]/30 uppercase">
              Gris Carbón · Verde Oliva
            </p>
            <p className="font-display text-base text-[var(--jh-ivory)]/30 italic">En construcción.</p>
          </div>
        </div>
      </section>

      {/* Detalles de construcción */}
      <section className="bg-[var(--jh-navy-deep)] py-32">
        <div className="mx-auto grid max-w-6xl grid-cols-1 items-center gap-16 px-6 lg:grid-cols-12 lg:px-10">
          <div className="lg:col-span-5">
            <TreatedImage
              image={PRODUCTO.tela}
              width={1200}
              sizes="(max-width: 1024px) 100vw, 40vw"
              className="jh-unveil aspect-[4/5]"
            />
          </div>
          <div className="lg:col-span-6 lg:col-start-7">
            <p className="font-institutional text-[10px] tracking-[0.42em] text-[var(--jh-gold-mid)] uppercase">
              La Construcción
            </p>
            <div className="mt-14 space-y-px">
              {DETALLES.map((d) => (
                <div key={d.title} className="border-t border-[var(--jh-gold-mid)]/15 py-8">
                  <h3 className="font-display text-xl font-light text-[var(--jh-ivory)]">{d.title}</h3>
                  <p className="mt-2 font-display text-lg text-[var(--jh-ivory)]/55 italic">{d.body}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Catálogo de telas — contenido real del CMS */}
      <section className="bg-[var(--jh-navy)] py-32">
        <div className="mx-auto max-w-6xl px-6 lg:px-10">
          <p className="font-institutional text-[10px] tracking-[0.42em] text-[var(--jh-gold-mid)] uppercase">
            Las Telas
          </p>
          <h2 className="mt-8 max-w-xl font-display text-3xl leading-[1.35] font-light text-[var(--jh-ivory)]">
            Una tela. Un cuerpo. Una sola oportunidad de hacerlo bien.
          </h2>

          {fabrics && fabrics.length > 0 ? (
            <div className="mt-16 grid grid-cols-2 gap-px bg-[var(--jh-gold-mid)]/15 sm:grid-cols-3 lg:grid-cols-4">
              {fabrics.map((f) => (
                <article key={f.id} className="bg-[var(--jh-navy)] p-6">
                  {f.image_url && (
                    <TreatedImage
                      src={f.image_url}
                      alt={f.name}
                      treatment="producto"
                      sizes="(max-width: 640px) 50vw, 25vw"
                      className="jh-unveil aspect-square"
                    />
                  )}
                  <h3 className="mt-5 font-display text-lg text-[var(--jh-ivory)]">{f.name}</h3>
                  {f.composition && (
                    <p className="mt-1 font-display text-sm text-[var(--jh-ivory)]/45">{f.composition}</p>
                  )}
                  {f.code && (
                    <p className="mt-3 font-institutional text-[8px] tracking-[0.28em] text-[var(--jh-gold-mid)]/70 uppercase">
                      {f.code}
                    </p>
                  )}
                </article>
              ))}
            </div>
          ) : (
            /* Nunca "no hay datos" a secas: se ofrece la salida. */
            <div className="mt-16 border border-[var(--jh-gold-mid)]/20 px-10 py-20 text-center">
              <p className="font-display text-xl font-light text-[var(--jh-ivory)]/70">
                El catálogo se está fotografiando.
              </p>
              <p className="mx-auto mt-4 max-w-md font-display text-base text-[var(--jh-ivory)]/45">
                Las telas existen; el archivo propio todavía no. Mientras tanto, la conversación es el mejor camino
                para verlas.
              </p>
              <div className="mt-10 flex justify-center">
                <BrandCta href="/citas">Ver las telas en persona</BrandCta>
              </div>
            </div>
          )}
        </div>
      </section>

      {/* Cierre: el hecho a medida se menciona, nunca se explica. */}
      <section className="bg-[var(--jh-black)] py-32">
        <div className="mx-auto max-w-3xl px-6 text-center">
          <p className="font-display text-2xl leading-[1.6] font-light text-[var(--jh-ivory)]/80 italic">
            El hecho a medida es una conversación diferente. Cuando esté listo, con gusto la tenemos.
          </p>
          <div className="mt-14 flex justify-center">
            <BrandCta href="/citas">Iniciar la conversación</BrandCta>
          </div>
        </div>
      </section>
    </>
  );
}
