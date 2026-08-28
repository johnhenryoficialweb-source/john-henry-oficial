import type { Metadata } from "next";
import { BrandCta } from "@/components/brand/brand-cta";
import { TreatedImage } from "@/components/brand/treated-image";
import { PROCESO, PRODUCTO } from "@/lib/brand/imagery";

export const metadata: Metadata = {
  title: "El Oficio | JOHN HENRY",
  description: "Décadas haciendo una sola cosa. John Henry Peña, autor de cada prenda que lleva su nombre.",
};

/**
 * Historia extendida. Es la página donde la marca se permite explicar — está
 * escrita para La Autoridad en Construcción, que necesita orientación, sin
 * condescender con La Autoridad Establecida, que ya lo sabe.
 *
 * Nunca lista logros, premios ni cifras de clientes. La historia se cuenta
 * como acumulación de relaciones, no como línea de tiempo de hitos.
 */

const PASOS = [
  {
    n: "01",
    title: "La conversación",
    body: "Antes de cualquier medida. Qué hace, dónde se mueve, qué le ha fallado antes. La prenda empieza acá, no en la tela.",
  },
  {
    n: "02",
    title: "La medida",
    body: "No son números en una tabla. Es una postura, un hombro que cae distinto al otro, una manera de moverse. Eso es lo que se registra.",
  },
  {
    n: "03",
    title: "La tela",
    body: "Se elige después de saber para qué vida es. Una tela que funciona en Bogotá no siempre funciona en Panamá. El criterio decide, no el catálogo.",
  },
  {
    n: "04",
    title: "El corte",
    body: "Tiza sobre lana. Una sola oportunidad de hacerlo bien: la tela cortada no se devuelve. Acá es donde las décadas se notan.",
  },
  {
    n: "05",
    title: "Las pruebas",
    body: "La prenda se ajusta sobre el cuerpo real, no sobre el maniquí. Cuantas veces haga falta hasta que desaparezca.",
  },
  {
    n: "06",
    title: "La entrega",
    body: "A partir de aquí, todo está en nuestras manos. Y la siguiente prenda ya sabe algo más de usted.",
  },
];

export default function ElOficioPage() {
  return (
    <>
      <section className="relative flex min-h-[70vh] items-end overflow-hidden">
        <TreatedImage image={PROCESO.mesa} width={2400} priority sizes="100vw" scrim="bottom" className="absolute inset-0" />
        <div className="relative mx-auto w-full max-w-6xl px-6 pb-24 lg:px-10">
          <p className="font-institutional text-[10px] tracking-[0.42em] text-[var(--jh-gold)] uppercase">
            El Oficio
          </p>
          <h1 className="mt-8 max-w-3xl font-display text-4xl leading-[1.28] font-light text-[var(--jh-ivory)] md:text-5xl">
            Décadas haciendo una sola cosa — y haciéndola cada vez mejor.
          </h1>
        </div>
      </section>

      <section className="bg-[var(--jh-navy)] py-32">
        <div className="mx-auto grid max-w-6xl grid-cols-1 gap-16 px-6 lg:grid-cols-12 lg:px-10">
          <div className="lg:col-span-7">
            <p className="font-display text-2xl leading-[1.6] font-light text-[var(--jh-ivory)]/85">
              La historia de JOHN HENRY no comienza con una visión. Comienza con un oficio.
            </p>
            <div className="mt-10 space-y-8 font-display text-lg leading-[1.8] font-light text-[var(--jh-ivory)]/60">
              <p>
                Décadas de aprender a escuchar un cuerpo, a leer una tela, a construir una prenda que no solo encaje
                sino que desaparezca — porque la mejor prenda es aquella que el hombre olvida que lleva puesta. Eso no
                se aprende en un año. No se aprende en cinco. Se aprende en décadas de conversaciones privadas con
                hombres que llegaron buscando algo que no habían podido encontrar en ningún otro lado.
              </p>
              <p>
                El nombre lo dice todo. John Henry Peña no eligió un nombre de fantasía, ni un apellido histórico
                europeo que sonara a herencia prestada. Eligió su propio nombre — el que carga todos los días, el que
                pone en juego cada vez que entrega una prenda. Cuando una marca lleva el nombre de quien la hace, no
                puede esconderse detrás de un logo. Tiene que responder con el trabajo.
              </p>
              <p>
                La marca nació en Bogotá y cruzó a Ciudad de Panamá — un mercado con una comunidad diplomática y
                empresarial internacional que tiene acceso real a marcas globales, y que eligió JOHN HENRY de todas
                formas. Esa elección dice algo: ninguna marca internacional puede llegar donde usted está, conocerlo
                por nombre, por medidas y por vida, y construir algo que solo puede existir para usted.
              </p>
              <p>
                Esto no es una casa que está aprendiendo. Es una casa con memoria. Con criterio acumulado, errores
                superados, relaciones que llevan años construyéndose. Hay clientes que llegaron construyendo su
                autoridad y hoy ya la tienen — y nunca se fueron, porque nadie más los conoce de la manera en que
                aquí se los conoce. Esa profundidad no se fabrica. Solo se construye con tiempo.
              </p>
            </div>
          </div>
          <div className="lg:col-span-4 lg:col-start-9">
            <TreatedImage
              image={PROCESO.hilo}
              width={1000}
              sizes="(max-width: 1024px) 100vw, 33vw"
              className="jh-unveil aspect-[3/4]"
            />
            <p className="mt-8 font-display text-lg leading-relaxed font-light text-[var(--jh-ivory)]/50 italic">
              No hacemos ropa para todos.
            </p>
          </div>
        </div>
      </section>

      {/* Contenido educativo para Persona 2, sin condescendencia. */}
      <section className="bg-[var(--jh-navy-deep)] py-32">
        <div className="mx-auto max-w-6xl px-6 lg:px-10">
          <p className="font-institutional text-[10px] tracking-[0.42em] text-[var(--jh-gold-mid)] uppercase">
            Cómo se construye una prenda
          </p>
          <div className="mt-20 space-y-px">
            {PASOS.map((p) => (
              <article
                key={p.n}
                className="grid grid-cols-1 gap-4 border-t border-[var(--jh-gold-mid)]/15 py-12 lg:grid-cols-12 lg:gap-12"
              >
                <p className="font-institutional text-sm tracking-[0.3em] text-[var(--jh-gold)]/70 lg:col-span-2">
                  {p.n}
                </p>
                <h2 className="font-display text-2xl font-light text-[var(--jh-ivory)] lg:col-span-4">{p.title}</h2>
                <p className="font-display text-lg leading-[1.75] font-light text-[var(--jh-ivory)]/55 lg:col-span-6">
                  {p.body}
                </p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="relative flex min-h-[60vh] items-center overflow-hidden">
        <TreatedImage image={PRODUCTO.puno} width={2000} sizes="100vw" scrim="left" className="absolute inset-0" />
        <div className="relative mx-auto w-full max-w-6xl px-6 lg:px-10">
          <div className="max-w-xl">
            <p className="font-display text-3xl leading-[1.4] font-light text-[var(--jh-ivory)] italic">
              El guardarropa correcto no se construye de una vez. Se construye con criterio, una pieza a la vez.
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
