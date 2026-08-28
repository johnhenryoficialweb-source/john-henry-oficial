import type { Metadata } from "next";
import { SedePage } from "@/components/public/sede-page";
import { AMBIENTE } from "@/lib/brand/imagery";

export const metadata: Metadata = {
  title: "Ciudad de Panamá | JOHN HENRY",
  description: "Sastrería privada en Ciudad de Panamá. La consulta llega a usted, con la discreción que el proceso exige.",
};

export default function PanamaPage() {
  return (
    <SedePage
      copy={{
        code: "PA",
        city: "Ciudad de Panamá",
        eyebrow: "Sedes · Panamá",
        headline: "Con acceso a todas las marcas del mundo, eligieron esta. Eso dice algo.",
        body: [
          "Ciudad de Panamá tiene una comunidad diplomática y empresarial que opera entre varios países al mismo tiempo, con acceso real y directo a las casas internacionales y a las sastrerías de Miami o Europa. Aun así, eligen JOHN HENRY. La razón es simple: ninguna marca internacional puede llegar donde usted está.",
          "El proceso se maneja con la discreción que exige el contexto. La consulta es privada, en el lugar que usted elija, con la agenda que su calendario permita — no la nuestra.",
          "El estándar de construcción es idéntico al de Bogotá. No hay una versión para exportación: es la misma casa, el mismo criterio y el mismo autor detrás de cada prenda.",
        ],
        image: AMBIENTE.arquitectura,
      }}
    />
  );
}
