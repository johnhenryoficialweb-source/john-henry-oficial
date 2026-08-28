import Link from "next/link";
import { createAdminClient } from "@/lib/supabase/admin";
import { getPublicLocations } from "@/lib/locations/public";
import { Imagotipo } from "@/components/brand/logo";
import { BrandCta } from "@/components/brand/brand-cta";
import { TreatedImage } from "@/components/brand/treated-image";
import { PROCESO, PRODUCTO, SACOS } from "@/lib/brand/imagery";

/**
 * Home. El orden de las secciones sigue la jerarquía de visibilidad de la
 * marca, no la de un e-commerce: el oficio antes que el producto, el
 * ready-to-wear abierto, y el hecho a medida casi en silencio, sin lista de
 * características ni precio, cerrando con una invitación privada.
 */

const DIFERENCIA = [
  {
    n: "01",
    title: "La consulta llega a usted",
    body: "Su oficina, su casa, el lugar que elija. La tienda va donde está el cliente — antes de tomar cualquier medida, eso ya dice cuál es la prioridad.",
  },
  {
    n: "02",
    title: "Cada prenda existe una sola vez",
    body: "No hay tallas. No hay stock. No hay otra persona con exactamente esa prenda, porque no hay otra persona con exactamente ese cuerpo y esa vida.",
  },
  {
    n: "03",
    title: "Una relación que se construye con el tiempo",
    body: "Después de la primera prenda conocemos su cuerpo, cómo se mueve, qué contextos frecuenta. Cada pieza siguiente sabe más de usted que la anterior.",
  },
];

export default async function HomePage() {
  const admin = createAdminClient();
  const [locations, { data: fabrics }] = await Promise.all([
    getPublicLocations(),
    admin
      .from("fabrics")
      .select("id, name, composition, image_url")
      .eq("is_active", true)
      .not("image_url", "is", null)
      .limit(4),
  ]);

  return (
    <>
      {/* ── Hero ─────────────────────────────────────────────────────────── */}
      <section className="relative flex min-h-[92vh] items-end overflow-hidden">
        <TreatedImage
          image={PROCESO.corte}
          width={2400}
          priority
          sizes="100vw"
          scrim="left"
          className="jh-hero-image absolute inset-0"
        />
        {/* Composición a un tercio, no centrada. */}
        <div className="relative mx-auto w-full max-w-6xl px-6 pb-24 lg:px-10">
          <div className="jh-arrive max-w-2xl">
            <Imagotipo size="sm" className="mb-14" />
            <h1 className="font-display text-4xl leading-[1.28] font-light text-[var(--jh-ivory)] md:text-6xl md:leading-[1.2]">
              La sastrería privada para el hombre que ya no tiene nada que demostrar
            </h1>
            <p className="mt-6 font-display text-2xl leading-snug font-light text-[var(--jh-ivory)]/55 italic md:text-3xl">
              — solo quiere que todo esté bien.
            </p>
            <p className="mt-12 font-institutional text-[9px] tracking-[0.38em] text-[var(--jh-gold)]/80 uppercase md:text-[10px]">
              Sastrería Privada · Bogotá · Ciudad de Panamá · Est. 2004
            </p>
            <div className="mt-12">
              <BrandCta href="/citas">Solicitar una conversación privada</BrandCta>
            </div>
          </div>
        </div>
      </section>

      {/* ── El Oficio ────────────────────────────────────────────────────── */}
      <section className="bg-[var(--jh-navy)] py-32">
        <div className="mx-auto grid max-w-6xl grid-cols-1 items-center gap-16 px-6 lg:grid-cols-12 lg:px-10">
          <div className="lg:col-span-5">
            <TreatedImage image={PROCESO.costura} width={1200} sizes="(max-width: 1024px) 100vw, 40vw" className="jh-unveil aspect-[3/4]" />
          </div>
          <div className="lg:col-span-6 lg:col-start-7">
            <p className="font-institutional text-[10px] tracking-[0.42em] text-[var(--jh-gold-mid)] uppercase">
              El Oficio
            </p>
            <h2 className="mt-8 font-display text-3xl leading-[1.35] font-light text-[var(--jh-ivory)] md:text-4xl">
              Décadas haciendo una sola cosa — y haciéndola cada vez mejor.
            </h2>
            <p className="mt-8 font-display text-lg leading-[1.75] font-light text-[var(--jh-ivory)]/60">
              John Henry Peña no eligió un apellido europeo prestado. Eligió el nombre que carga todos los días, el
              que firma cada prenda que sale del taller. Detrás de cada pieza hay décadas de aprender a escuchar un
              cuerpo, a leer una tela, a construir algo que no solo encaje — que desaparezca. Esa es la diferencia
              entre una marca que se esconde detrás de un logo y una que responde con el trabajo.
            </p>
            <div className="mt-12">
              <BrandCta href="/el-oficio" tone="quiet">
                Conocer el oficio
              </BrandCta>
            </div>
          </div>
        </div>
      </section>

      {/* ── La Diferencia ────────────────────────────────────────────────── */}
      <section className="bg-[var(--jh-navy-deep)] py-32">
        <div className="mx-auto max-w-6xl px-6 lg:px-10">
          <p className="font-institutional text-[10px] tracking-[0.42em] text-[var(--jh-gold-mid)] uppercase">
            La Diferencia
          </p>
          <div className="mt-20 space-y-px">
            {DIFERENCIA.map((d) => (
              <article
                key={d.n}
                className="relative grid grid-cols-1 gap-6 py-14 lg:grid-cols-12 lg:gap-12"
              >
                {/* La tiza del sastre: el filete se traza al entrar. Es un
                    elemento y no un border-t porque un borde no se anima —
                    absoluto, para ocupar el mismo sitio que ocupaba el borde
                    sin tocar el ritmo vertical de la sección. */}
                <span
                  aria-hidden
                  className="jh-seam absolute inset-x-0 top-0 block h-px bg-[var(--jh-gold-mid)]/15"
                />
                {/* Numeración tipográfica, no iconos. */}
                <p className="font-institutional text-sm tracking-[0.3em] text-[var(--jh-gold)]/70 lg:col-span-2">
                  {d.n}
                </p>
                <h3 className="font-display text-2xl leading-snug font-light text-[var(--jh-ivory)] lg:col-span-4">
                  {d.title}
                </h3>
                <p className="font-display text-lg leading-[1.75] font-light text-[var(--jh-ivory)]/55 lg:col-span-6">
                  {d.body}
                </p>
              </article>
            ))}
          </div>
        </div>
      </section>

      {/* ── Ready-to-Wear ────────────────────────────────────────────────── */}
      <section className="bg-[var(--jh-navy)] py-32">
        <div className="mx-auto max-w-6xl px-6 lg:px-10">
          <div className="max-w-2xl">
            <p className="font-institutional text-[10px] tracking-[0.42em] text-[var(--jh-gold-mid)] uppercase">
              Ready-to-Wear
            </p>
            <h2 className="mt-8 font-display text-3xl leading-[1.35] font-light text-[var(--jh-ivory)] md:text-4xl">
              Para el hombre que ya sabe quién es. Solo falta que su ropa lo diga también.
            </h2>
          </div>

          <div className="mt-20 grid grid-cols-1 gap-x-8 gap-y-14 sm:grid-cols-3">
            {[
              { img: SACOS.navy, name: "Azul Marino", note: "El color de lanzamiento." },
              { img: SACOS.negro, name: "Negro", note: "El dúo central." },
              { img: SACOS.camel, name: "Camel", note: "El color que dice que esto no es genérico." },
            ].map((s) => (
              <article key={s.name}>
                <TreatedImage image={s.img} width={900} sizes="(max-width: 640px) 100vw, 30vw" className="jh-unveil aspect-[3/4]" />
                <h3 className="mt-6 font-display text-xl font-light text-[var(--jh-ivory)]">{s.name}</h3>
                <p className="mt-2 font-display text-base text-[var(--jh-ivory)]/50">{s.note}</p>
              </article>
            ))}
          </div>

          <p className="mt-20 max-w-xl font-display text-xl leading-relaxed font-light text-[var(--jh-ivory)]/60 italic">
            Sin bolsillos por fuera porque la silueta no necesita interrupciones.
          </p>
          <div className="mt-10">
            <BrandCta href="/ready-to-wear" tone="quiet">
              Ver la línea
            </BrandCta>
          </div>
        </div>
      </section>

      {/* ── Telas ────────────────────────────────────────────────────────── */}
      {fabrics && fabrics.length > 0 && (
        <section className="bg-[var(--jh-navy-deep)] py-32">
          <div className="mx-auto max-w-6xl px-6 lg:px-10">
            <div className="flex flex-wrap items-end justify-between gap-8">
              <div className="max-w-lg">
                <p className="font-institutional text-[10px] tracking-[0.42em] text-[var(--jh-gold-mid)] uppercase">
                  Las Telas
                </p>
                <h2 className="mt-8 font-display text-3xl leading-[1.35] font-light text-[var(--jh-ivory)]">
                  Una tela. Un cuerpo. Una sola oportunidad de hacerlo bien.
                </h2>
              </div>
              <BrandCta href="/ready-to-wear" tone="quiet">
                Ver el catálogo
              </BrandCta>
            </div>
            <div className="mt-16 grid grid-cols-2 gap-px bg-[var(--jh-gold-mid)]/15 sm:grid-cols-4">
              {fabrics.map((f) => (
                <div key={f.id} className="bg-[var(--jh-navy-deep)] p-5">
                  <TreatedImage
                    src={f.image_url!}
                    alt={f.name}
                    treatment="producto"
                    sizes="(max-width: 640px) 50vw, 25vw"
                    className="jh-unveil aspect-square"
                  />
                  <p className="mt-4 font-display text-base text-[var(--jh-ivory)]">{f.name}</p>
                  {f.composition && (
                    <p className="mt-1 font-display text-sm text-[var(--jh-ivory)]/45">{f.composition}</p>
                  )}
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* ── Hecho a Medida ───────────────────────────────────────────────── */}
      {/* Negro profundo. Corta, sin características, sin precios. */}
      <section className="relative overflow-hidden bg-[var(--jh-black)] py-40">
        <div className="mx-auto max-w-3xl px-6 text-center">
          <p className="font-institutional text-[10px] tracking-[0.42em] text-[var(--jh-gold)] uppercase">
            Hecho a Medida
          </p>
          <p className="mt-14 font-display text-2xl leading-[1.6] font-light text-[var(--jh-ivory)]/80 italic md:text-3xl">
            El hecho a medida es una conversación diferente. Cuando esté listo, con gusto la tenemos.
          </p>
          <div className="mt-16 flex justify-center">
            <BrandCta href="/citas">Iniciar la conversación</BrandCta>
          </div>
        </div>
      </section>

      {/* ── Sedes ────────────────────────────────────────────────────────── */}
      <section className="bg-[var(--jh-navy)] py-32">
        <div className="mx-auto max-w-6xl px-6 lg:px-10">
          <p className="font-institutional text-[10px] tracking-[0.42em] text-[var(--jh-gold-mid)] uppercase">
            Sedes
          </p>
          <p className="mt-8 max-w-xl font-display text-2xl leading-snug font-light text-[var(--jh-ivory)] italic">
            El precio refleja el mercado. El estándar nunca cambia.
          </p>

          <div className="mt-20 grid grid-cols-1 gap-px bg-[var(--jh-gold-mid)]/15 sm:grid-cols-2">
            {locations.map((loc) => (
              <Link
                key={loc.code}
                href={loc.code === "CO" ? "/sedes/bogota" : "/sedes/panama"}
                className="group bg-[var(--jh-navy)] p-12 transition-colors duration-500 hover:bg-[var(--jh-navy-raised)]"
              >
                <h3 className="font-display text-3xl font-light text-[var(--jh-ivory)]">
                  {loc.code === "CO" ? "Bogotá" : "Ciudad de Panamá"}
                </h3>
                <p className="mt-2 font-institutional text-[9px] tracking-[0.34em] text-[var(--jh-gold-mid)] uppercase">
                  {loc.country}
                </p>
                {loc.address && (
                  <p className="mt-8 font-display text-lg leading-relaxed text-[var(--jh-ivory)]/55">{loc.address}</p>
                )}
                {loc.phone && <p className="mt-2 font-display text-lg text-[var(--jh-ivory)]/55">{loc.phone}</p>}
                <span
                  aria-hidden
                  className="mt-10 block h-px w-8 bg-[var(--jh-gold-mid)] transition-all duration-500 group-hover:w-16"
                />
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* ── Cierre ───────────────────────────────────────────────────────── */}
      <section className="relative flex min-h-[70vh] items-center overflow-hidden">
        {/* Medio tono a propósito: `solapa` es tan oscura que bajo el velo
            desaparece y la sección se lee como un panel plano. */}
        <TreatedImage image={PRODUCTO.tela} width={2000} sizes="100vw" scrim="left" className="absolute inset-0" />
        <div className="relative mx-auto w-full max-w-6xl px-6 lg:px-10">
          <div className="max-w-xl">
            <p className="font-display text-3xl leading-[1.4] font-light text-[var(--jh-ivory)] md:text-4xl">
              La primera vez que vista JOHN HENRY, va a entender por qué nunca más va a querer vestir de otra manera.
            </p>
            <div className="mt-12">
              <BrandCta href="/citas">Solicitar una conversación privada</BrandCta>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
