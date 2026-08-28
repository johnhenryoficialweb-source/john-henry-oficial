import Link from "next/link";
import { getPublicLocations } from "@/lib/locations/public";
import { Imagotipo } from "@/components/brand/logo";
import { siteConfig } from "@/config/site";

/**
 * Footer institucional. Va en negro profundo — es zona de máxima autoridad,
 * uno de los dos únicos lugares del sitio público donde ese color aparece
 * (el otro es Hecho a Medida). Su poder viene de aparecer poco.
 */
export async function SiteFooter() {
  const locations = await getPublicLocations();

  return (
    <footer className="bg-[var(--jh-black)]">
      <div className="mx-auto max-w-6xl px-6 py-24 lg:px-10">
        <div className="flex flex-col items-center gap-8 text-center">
          <Imagotipo variant="black" size="md" />
          <p className="font-display text-xl leading-relaxed font-light text-[var(--jh-ivory)]/70 italic">
            Hecho para su cuerpo. Construido para su vida.
          </p>
        </div>

        <div aria-hidden className="my-16 h-px bg-[var(--jh-gold-mid)]/15" />

        <div className="grid grid-cols-1 gap-14 sm:grid-cols-3">
          {locations.map((loc) => (
            <div key={loc.code}>
              <p className="font-institutional text-[10px] tracking-[0.36em] text-[var(--jh-gold)] uppercase">
                {loc.country}
              </p>
              {loc.address && (
                <p className="mt-4 font-display text-base leading-relaxed text-[var(--jh-ivory)]/60">{loc.address}</p>
              )}
              {loc.phone && (
                <a
                  href={`tel:${loc.phone}`}
                  className="mt-2 inline-block font-display text-base text-[var(--jh-ivory)]/60 transition-colors duration-500 hover:text-[var(--jh-gold)]"
                >
                  {loc.phone}
                </a>
              )}
            </div>
          ))}

          <div className="flex flex-col gap-4">
            <p className="font-institutional text-[10px] tracking-[0.36em] text-[var(--jh-gold)] uppercase">
              Navegación
            </p>
            {[
              { href: "/el-oficio", label: "El Oficio" },
              { href: "/ready-to-wear", label: "Ready-to-Wear" },
              { href: "/citas", label: "Conversación privada" },
            ].map((l) => (
              <Link
                key={l.href}
                href={l.href}
                className="font-display text-base text-[var(--jh-ivory)]/60 transition-colors duration-500 hover:text-[var(--jh-gold)]"
              >
                {l.label}
              </Link>
            ))}
          </div>
        </div>
      </div>

      {/* Única zona donde la sans de apoyo es admisible: línea legal mínima. */}
      <div className="border-t border-[var(--jh-gold-mid)]/12 px-6 py-6">
        <p className="text-center font-sans text-[11px] text-[var(--jh-ivory)]/30">
          © {new Date().getFullYear()} {siteConfig.name} · {siteConfig.founder}
        </p>
      </div>
    </footer>
  );
}
