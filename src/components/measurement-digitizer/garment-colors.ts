/**
 * Colores de la prenda en el visor 3D.
 *
 * Sobre la paleta bloqueada de marca (navy/oro/negro/marfil, globals.css):
 * estos colores caen fuera de ella a propósito, por la misma razón ya
 * documentada para el verde de "sección tomada" y el rojo destructivo — son
 * CONTENIDO operativo interno del CMS (el color real de un paño), no
 * superficie pública de marca. Un saco camel se tiene que ver camel.
 *
 * Además: esto es PREVISUALIZACIÓN. El color elegido acá no se guarda en
 * `order_items`; la tela seleccionada sigue siendo la fuente de verdad de qué
 * se corta.
 */

export interface GarmentSwatch {
  id: string;
  label: string;
  hex: string;
}

/**
 * Paleta de sastrería: los paños que más salen del catálogo. Los hex están
 * alineados a propósito con `fabricColorToHex` de abajo — el mismo azul
 * marino que reconoce el detector de nombre de tela es el que aparece acá
 * como swatch, así elegir a mano o heredar de la tela nunca contradicen.
 *
 * Además de esta lista, el visor ofrece un selector de color libre (ver
 * `GarmentColorPicker`) para cuando el paño real no cae en ninguna de estas.
 */
export const GARMENT_SWATCHES: GarmentSwatch[] = [
  { id: "navy", label: "Azul marino", hex: "#28374f" },
  { id: "azul-medio", label: "Azul medio", hex: "#41597c" },
  { id: "azul-claro", label: "Azul claro", hex: "#7d9bc1" },
  { id: "grafito", label: "Grafito", hex: "#3a3d42" },
  { id: "gris-medio", label: "Gris medio", hex: "#6b7078" },
  { id: "gris-claro", label: "Gris claro", hex: "#8d9199" },
  { id: "negro", label: "Negro", hex: "#232326" },
  { id: "marfil", label: "Blanco marfil", hex: "#e8e2d5" },
  { id: "beige", label: "Beige", hex: "#b8a483" },
  { id: "camel", label: "Camel", hex: "#a1794d" },
  { id: "marron", label: "Marrón", hex: "#5c4433" },
  { id: "oliva", label: "Oliva", hex: "#5a5c40" },
  { id: "verde-botella", label: "Verde botella", hex: "#4a6350" },
  { id: "vino", label: "Vino", hex: "#5e2733" },
];

export const DEFAULT_GARMENT_COLOR = GARMENT_SWATCHES[0].hex;

/**
 * `fabrics.color` es texto libre escrito por el sastre ("Azul marino",
 * "gris oxford", "NEGRO"…), no un hex. Esto lo aproxima a un color de
 * pantalla por palabra clave.
 *
 * Devuelve `null` cuando no reconoce nada — y ese `null` importa: significa
 * "no sé de qué color es esta tela", que no es lo mismo que "es azul marino".
 * Quien llama decide el fallback.
 */
export function fabricColorToHex(colorName: string | null | undefined): string | null {
  if (!colorName) return null;

  // Sin acentos y en minúsculas: "Marrón" y "marron" son la misma tela.
  const normalized = colorName
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();

  if (!normalized) return null;

  /*
   * Orden importante: las entradas más específicas van primero, porque se
   * resuelve por inclusión de subcadena. "azul marino" tiene que ganarle a
   * "azul" a secas, y "gris claro" a "gris".
   */
  const RULES: Array<[RegExp, string]> = [
    [/azul\s*(marino|oscuro|noche)|marino|navy/, "#28374f"],
    [/azul\s*(claro|cielo)|celeste/, "#7d9bc1"],
    [/azul|blue/, "#41597c"],
    [/gris\s*(claro|perla|plata)|plata/, "#8d9199"],
    [/gris\s*(oscuro|marengo)|grafito|carbon|charcoal/, "#3a3d42"],
    [/gris|gray|grey/, "#6b7078"],
    [/negro|black/, "#232326"],
    [/blanco|marfil|crudo|hueso|white|ivory/, "#e8e2d5"],
    [/beige|arena|khaki|caqui/, "#b8a483"],
    [/camel|tabaco|cognac/, "#a1794d"],
    [/marron|cafe|chocolate|brown/, "#5c4433"],
    [/oliva|verde\s*militar|olive/, "#5a5c40"],
    [/verde|green/, "#4a6350"],
    [/vino|burdeos|borgona|granate|bordo/, "#5e2733"],
    [/rojo|red/, "#7a3232"],
    [/morado|violeta|purpura|lila/, "#4d3a5c"],
  ];

  for (const [pattern, hex] of RULES) {
    if (pattern.test(normalized)) return hex;
  }

  return null;
}
