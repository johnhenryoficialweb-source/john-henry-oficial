import type { Metadata } from "next";
import { SedePage } from "@/components/public/sede-page";
import { AMBIENTE } from "@/lib/brand/imagery";

export const metadata: Metadata = {
  title: "Bogotá | JOHN HENRY",
  description: "Sastrería privada en Bogotá. La consulta llega a usted.",
};

export default function BogotaPage() {
  return (
    <SedePage
      copy={{
        code: "CO",
        city: "Bogotá",
        eyebrow: "Sedes · Colombia",
        headline: "Acá empezó todo. Y acá se sigue haciendo igual.",
        body: [
          "JOHN HENRY nació en Bogotá — en una cultura de negocio donde la imagen importa y donde el hombre que llega a cierto nivel sabe que su guardarropa es parte de su capital. No es un dato de origen; es el carácter de la casa.",
          "La consulta llega donde usted esté: su oficina, su casa, el lugar que elija. No hay vitrina abierta al público, y eso es deliberado. Lo que hay es una relación — alguien que lo conoce por nombre, por medidas y por vida.",
          "En Bogotá compite todo: las sastrerías locales y las tiendas de las marcas internacionales. La diferencia no está en la etiqueta. Está en el corte, en la construcción, y en quién responde cuando algo no queda exactamente bien.",
        ],
        image: AMBIENTE.oficina,
      }}
    />
  );
}
