/**
 * Fotografía de relleno curada.
 *
 * La marca todavía no tiene archivo fotográfico propio alineado — es su
 * prioridad visual más urgente. Mientras tanto, estas imágenes de Unsplash
 * sostienen el sitio. Se eligen con el criterio que exige el manual: encuadre
 * cerrado sobre construcción, un solo punto focal, fondo neutro o material
 * natural, nunca blanco clínico, nunca rostro protagonista, nunca sonrisa a
 * cámara.
 *
 * Cada ID fue verificado visualmente antes de entrar acá. No se inventan: un
 * ID de Unsplash es arbitrario y uno inventado devuelve una foto cualquiera —
 * lo que trae imágenes fuera de marca sin que el build falle.
 *
 * Advertencia sobre `data/catalogo-panama.html`: sus imágenes NO sirven como
 * referencia. De sus diez IDs, nueve incumplen el estándar (tienda genérica,
 * jeans, prenda de mujer, camiseta con texto, flat-lay sobre blanco). El único
 * reutilizable es el torso de traje oscuro que aparece abajo como
 * `AMBIENTE.oficina`.
 *
 * Todas pasan por el mismo tratamiento (ver `TreatedImage`) para que
 * fotografía de autores distintos se lea como un solo sistema. Cuando exista el
 * archivo propio, se reemplazan estas URLs y nada más cambia.
 */

export type Treatment = "proceso" | "producto" | "ambiente";

type BrandImage = {
  id: string;
  alt: string;
  treatment: Treatment;
};

/** Manos trabajando, hilo, aguja, máquina. El contenido más poderoso de la
 *  marca — domina el hero y El Oficio. */
export const PROCESO = {
  /** Macro de aguja e hilo sobre tela oscura. Casi negra: es la única que
   *  aguanta texto encima sin pelear con él. Por eso es el hero. */
  corte: {
    id: "photo-1497997092403-f091fcf5b6c4",
    alt: "Aguja e hilo sobre tela oscura, en detalle extremo",
    treatment: "proceso",
  },
  costura: {
    id: "photo-1606501126768-b78d4569d3f9",
    alt: "Manos guiando la tela bajo la aguja",
    treatment: "proceso",
  },
  mesa: {
    id: "photo-1626274890657-e28d5b65b04b",
    alt: "Máquina de coser antigua sobre mesa de madera",
    treatment: "proceso",
  },
  hilo: {
    id: "photo-1560796952-f1c9b838544c",
    alt: "Aguja y prensatelas en detalle, alto contraste",
    treatment: "proceso",
  },
} as const satisfies Record<string, BrandImage>;

/** Encuadre cerrado sobre un solo elemento de construcción. */
export const PRODUCTO = {
  solapa: {
    id: "photo-1667283831564-d0d8e7aa3450",
    alt: "Solapa de saco azul marino con pañuelo de bolsillo",
    treatment: "producto",
  },
  puno: {
    id: "photo-1540292212250-e817c4b2dd2e",
    alt: "Botones de puño sobre manga azul marino",
    treatment: "producto",
  },
  /** Textura de lana bajo luz rasante. Medio tono: es la que aguanta texto
   *  encima sin desaparecer bajo el velo. */
  tela: {
    id: "photo-1636716018960-eb737dccb185",
    alt: "Textura de lana gris bajo luz rasante",
    treatment: "producto",
  },
  ojal: {
    id: "photo-1603796847238-5253216c8811",
    alt: "Ojal y botón en detalle, sobre lana gris",
    treatment: "producto",
  },
} as const satisfies Record<string, BrandImage>;

/** Hombre en contexto real. Nunca posando, el rostro nunca es el protagonista. */
export const AMBIENTE = {
  oficina: {
    id: "photo-1507679799987-c73779587ccf",
    alt: "Hombre de traje azul marino abotonando el saco, sin rostro visible",
    treatment: "ambiente",
  },
  arquitectura: {
    id: "photo-1603394151492-5e9b974b090b",
    alt: "Detalle de traje azul marino, reloj y cinturón, en contexto",
    treatment: "ambiente",
  },
} as const satisfies Record<string, BrandImage>;

/**
 * Primera línea de sacos de tejido de punto — un tono por color de
 * lanzamiento. Son placeholders de sastrería, no el producto real: el saco de
 * punto con cremallera todavía no está fotografiado. Reemplazar en cuanto
 * exista la toma propia.
 */
export const SACOS = {
  navy: {
    id: "photo-1611937663641-5cef5189d71b",
    alt: "Saco azul marino en detalle",
    treatment: "producto",
  },
  negro: {
    id: "photo-1693743472699-a0264203ac56",
    alt: "Saco negro, manos abotonando",
    treatment: "producto",
  },
  camel: {
    id: "photo-1523211737006-e54a3c7299ab",
    alt: "Saco en camel, detalle de solapa",
    treatment: "producto",
  },
} as const satisfies Record<string, BrandImage>;

/**
 * Construye la URL de Unsplash. `q=85` y ancho explícito: la fotografía de
 * textura pierde su razón de ser si se comprime de más.
 */
export function unsplash(id: string, width = 1600) {
  return `https://images.unsplash.com/${id}?w=${width}&q=85&auto=format&fit=crop`;
}
