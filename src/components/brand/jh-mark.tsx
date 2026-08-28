/**
 * JH Espejo — isotipo oficial de JOHN HENRY.
 *
 * Reconstrucción vectorial del monograma. La geometría (eje de simetría,
 * ancho de asta, extensión de los remates, altura del travesaño y posición
 * de los terminales) está medida pixel a pixel sobre `data/New Logo
 * JOHNHENRY.png`, normalizada a un lienzo de 992 × 885 con el eje de
 * simetría en x = 496.
 *
 * El monograma es estrictamente simétrico: se dibuja la J izquierda una sola
 * vez y la derecha es su reflejo exacto sobre el eje central. Cualquier ajuste
 * al trazo se hace sobre `LEFT_J` y se propaga solo al reflejo — nunca se
 * editan los dos lados por separado, porque dejarían de ser espejo.
 */

// Eje de simetría del lienzo normalizado.
const AXIS = 496;

const LEFT_J = [
  // Remate superior. El vuelo es asimétrico a propósito: 123 hacia afuera
  // contra 75 hacia adentro — es el remate exterior de la H, no un serif
  // centrado.
  "M 171 0",
  "L 466 0",
  "L 466 19",
  // Bajada del asta: caída corta y abrupta bajo el remate, luego el
  // acartelado se abre largo hasta encontrar el asta.
  "C 456 20 440 24 428 30",
  "C 415 40 391 78 391 132",
  "L 391 690",
  // Espolón interior: el asta engorda hacia el eje hasta una punta seca.
  // Los dos espolones se quedan a 31px de tocarse sobre el centro.
  "C 391 725 400 745 420 762",
  "C 440 775 458 780 465 784",
  "L 465 797",
  // Corte del espolón: casi vertical. No es una curva suave — es un tajo.
  "C 445 798 408 804 387 810",
  // Barrido del cuenco hasta la punta inferior.
  "C 360 823 330 848 302 865",
  "C 285 872 258 881 234 885",
  "L 202 885",
  // Flanco exterior del gancho, subiendo hacia el terminal.
  "C 180 883 160 877 140 870",
  "C 118 861 100 845 85 830",
  "C 72 812 62 790 57 760",
  "C 55 730 55 680 55 632",
  // Remate del terminal. Su punta es el extremo izquierdo de todo el
  // monograma (x = 0) — de ahí sale el ancho del lienzo.
  "C 52 616 44 596 29 580",
  "C 24 576 12 574 0 574",
  "L 0 554",
  "L 176 554",
  "L 176 574",
  "C 162 575 150 578 145 596",
  "C 141 608 138 618 138 632",
  // Flanco interior del terminal, bajando al fondo del gancho.
  "L 138 750",
  "C 139 775 141 792 143 802",
  "C 146 815 152 828 160 840",
  "C 170 852 186 860 204 864",
  // Subida por el interior del cuenco hasta el asta.
  "C 222 862 232 856 244 845",
  "C 258 832 268 815 274 800",
  "C 282 776 290 740 294 690",
  "L 294 132",
  // Acartelado superior, flanco exterior.
  "C 294 80 268 46 247 39",
  "C 232 33 196 22 171 19",
  "L 171 0",
  "Z",
].join(" ");

type JhMarkProps = {
  className?: string;
  /** Color del símbolo. Por defecto hereda del contexto vía `currentColor`. */
  color?: string;
  /**
   * Etiqueta accesible. Se omite (`aria-hidden`) cuando el símbolo acompaña
   * al nombre en texto — si no, el lector de pantalla lo anunciaría dos veces.
   */
  title?: string;
};

export function JhMark({ className, color = "currentColor", title }: JhMarkProps) {
  return (
    <svg
      viewBox="0 0 992 885"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      role={title ? "img" : undefined}
      aria-hidden={title ? undefined : true}
      aria-label={title}
    >
      {title ? <title>{title}</title> : null}
      <g fill={color}>
        <path id="jh-espejo-j" d={LEFT_J} />
        {/* Travesaño: une las dos astas entre sus flancos interiores. */}
        <rect x="389" y="361" width="212" height="42" />
        <use href="#jh-espejo-j" transform={`translate(${AXIS * 2} 0) scale(-1 1)`} />
      </g>
    </svg>
  );
}
