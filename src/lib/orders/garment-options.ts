import type { GarmentType } from "@/types/database.types";

/**
 * Catálogo de opciones de confección por prenda — el mismo juego de "pills"
 * que el sastre tenía en el sistema anterior, una por una.
 *
 * Por qué existe este archivo teniendo ya `garment_models`: un modelo es una
 * PLANTILLA ("Clásico dos botones" = cinco decisiones de golpe). Sirve para
 * arrancar, pero de las 462 especificaciones de saco del histórico, 435 son
 * distintas entre sí — el sastre siempre cambia algo. Sembrar plantillas y no
 * dar las opciones sueltas obligaba a reescribir a mano cada desviación, que
 * era exactamente el trabajo que la pantalla venía a evitar.
 *
 * El resultado sigue siendo el texto libre de `spec` (order_items.notes): las
 * opciones se PARSEAN desde ese texto y se COMPONEN de vuelta hacia él. Así
 * las órdenes importadas del sistema viejo, el historial del cliente y la
 * ficha imprimible siguen funcionando sin migración ni columna nueva, y lo
 * que el sastre escriba a mano nunca se pierde: lo que no corresponde a
 * ninguna opción se conserva tal cual al final.
 */

export type SpecGroupMode =
  /** Una sola opción del grupo a la vez (frente, espalda, bota…). */
  | "single"
  /** Varias a la vez (bolsillos, accesorios…). */
  | "multi"
  /** Cada opción se responde SI o NO (pechera, forro, iniciales…). */
  | "flags"
  /** Texto libre con prefijo fijo ("Material Cod: VBC-1234"). */
  | "text";

export interface SpecOption {
  id: string;
  /** Texto EXACTO que se escribe en la especificación. */
  label: string;
}

export interface SpecGroup {
  id: string;
  label: string;
  mode: SpecGroupMode;
  /** En modo `text`, la etiqueta de la opción DEBE terminar en ":": el parser
   *  corta el valor por ahí ("Material Cod: VBC-1234" → "VBC-1234"). */
  options: SpecOption[];
  hint?: string;
}

/**
 * Opciones de saco.
 *
 * Frente y espalda son excluyentes (un saco no puede ser sencillo y cruzado a
 * la vez); bolsillos y solapa no lo son —un saco lleva ribete en el pecho y
 * tapa en los laterales, y la solapa tiene forma Y ancho—, así que ahí se
 * marcan varias.
 */
const SACO_GROUPS: SpecGroup[] = [
  {
    id: "saco_frente",
    label: "Frente",
    mode: "single",
    options: [
      { id: "saco_frente_sencillo_2", label: "Frente Sencillo dos botones" },
      { id: "saco_frente_sencillo_1", label: "Frente Sencillo un boton" },
      { id: "saco_frente_cruzado_4", label: "Frente Cruzado 4 botones" },
    ],
  },
  {
    id: "saco_bolsillo",
    label: "Bolsillos",
    mode: "multi",
    options: [
      { id: "saco_bolsillo_tapa", label: "Bolsillo tapa" },
      { id: "saco_bolsillo_ribete", label: "Bolsillo ribete" },
      { id: "saco_bolsillo_parche", label: "Bolsillo parche" },
    ],
  },
  {
    id: "saco_solapa",
    label: "Solapa",
    mode: "multi",
    options: [
      { id: "saco_solapa_punta", label: "Solapa Clasica en punta" },
      { id: "saco_solapa_8cm", label: "Solapa Clasica 8cm" },
    ],
  },
  {
    id: "saco_espalda",
    label: "Espalda",
    mode: "single",
    options: [
      { id: "saco_espalda_cerrada", label: "Espalda cerrada" },
      { id: "saco_espalda_1", label: "Espalda una abertura" },
      { id: "saco_espalda_2", label: "Espalda dos aberturas" },
    ],
  },
  {
    id: "saco_forro",
    label: "Forro",
    mode: "single",
    options: [
      { id: "saco_forro_tono", label: "Forro al tono" },
      { id: "saco_forro_contraste", label: "Forro Contraste" },
    ],
  },
  {
    id: "saco_contraste",
    label: "Detalles en contraste",
    mode: "flags",
    hint: "Marca SI o NO. Lo que no se responde no se escribe en la ficha.",
    options: [
      { id: "saco_flag_botones", label: "Botones" },
      { id: "saco_flag_tapas", label: "Tapas" },
      { id: "saco_flag_aberturas", label: "Aberturas" },
    ],
  },
  {
    id: "saco_material",
    label: "Material",
    mode: "text",
    options: [{ id: "saco_material_cod", label: "Material Cod:" }],
  },
];

const PANTALON_GROUPS: SpecGroup[] = [
  {
    id: "pant_prenses",
    label: "Prenses",
    mode: "single",
    options: [
      { id: "pant_prenses_0", label: "Sin Prenses" },
      { id: "pant_prenses_1", label: "Un prense" },
      { id: "pant_prenses_2", label: "Dos prenses" },
    ],
  },
  {
    id: "pant_bolsillo_delantero",
    label: "Bolsillo delantero",
    mode: "single",
    options: [
      { id: "pant_bolsillo_sesgado", label: "Bolsillo Sesgado" },
      { id: "pant_bolsillo_recto", label: "Bolsillo Recto" },
    ],
  },
  {
    id: "pant_pretina",
    label: "Pretina",
    mode: "single",
    options: [
      { id: "pant_pretina_cruzada", label: "Pretina cruzada" },
      { id: "pant_pretina_recta", label: "Pretina recta" },
    ],
  },
  {
    id: "pant_bolsillos_extra",
    label: "Bolsillos adicionales",
    mode: "multi",
    options: [
      { id: "pant_bolsillo_secreto", label: "Bolsillo secreto" },
      { id: "pant_bolsillo_relojero", label: "Bolsillo relojero" },
      { id: "pant_bolsillo_monedero", label: "Bolsillo monedero" },
      { id: "pant_bolsillo_trasero", label: "Bolsillos trasero" },
    ],
  },
  {
    id: "pant_acabado_trasero",
    label: "Acabado del bolsillo trasero",
    mode: "single",
    options: [
      { id: "pant_trasero_tapa", label: "Tapa" },
      { id: "pant_trasero_ribete", label: "Ribete" },
    ],
  },
  {
    id: "pant_bota",
    label: "Bota",
    mode: "single",
    options: [
      { id: "pant_bota_sencilla", label: "Bota sencilla" },
      { id: "pant_bota_doble", label: "Bota doble" },
    ],
  },
  {
    id: "pant_extras",
    label: "Extras",
    mode: "flags",
    hint: "Marca SI o NO. Lo que no se responde no se escribe en la ficha.",
    options: [{ id: "pant_flag_forro", label: "Forro" }],
  },
  {
    id: "pant_material",
    label: "Material",
    mode: "text",
    options: [{ id: "pant_material_cod", label: "Material Cod:" }],
  },
];

/**
 * Opciones de camisa.
 *
 * Ojo con "Cuello", "Puño", "Frente" y "Bolsillo": en el sistema anterior
 * aparecían dos veces, como estilo ("Cuello Dany", "Puño 7rd") y como pieza
 * que se responde SI/NO —normalmente por ir en tela de contraste—. Acá se
 * separan en dos grupos distintos, y el parser distingue por el texto exacto:
 * "Puño 7rd" es un estilo, "Puño SI" es la pieza marcada.
 */
const CAMISA_GROUPS: SpecGroup[] = [
  {
    id: "cam_cuello",
    label: "Cuello",
    mode: "single",
    options: [
      { id: "cam_cuello_dany", label: "Cuello Dany" },
      { id: "cam_cuello_dany_under", label: "Cuello Dany Under" },
      { id: "cam_cuello_tomy_down", label: "Cuello Tomy Down" },
      { id: "cam_cuello_semifrances", label: "Cuello Semifrances" },
      { id: "cam_cuello_frances", label: "Cuello Frances" },
      { id: "cam_cuello_120", label: "Cuello 120°" },
    ],
  },
  {
    id: "cam_puno",
    label: "Puño",
    mode: "single",
    options: [
      { id: "cam_puno_7rd", label: "Puño 7rd" },
      { id: "cam_puno_7rc", label: "Puño 7rc" },
      { id: "cam_puno_7", label: "Puño 7" },
      { id: "cam_puno_8rc_2", label: "Puño 8rc 2 Botones" },
      { id: "cam_puno_8_mancornas", label: "Puño 8 Mancornas" },
    ],
  },
  {
    id: "cam_manga",
    label: "Manga",
    mode: "multi",
    options: [{ id: "cam_manga_corta", label: "Manga Corta" }],
  },
  {
    id: "cam_espalda",
    label: "Espalda",
    mode: "single",
    options: [
      { id: "cam_espalda_lisa", label: "Espalda Lisa" },
      { id: "cam_espalda_prenses", label: "Espalda Prenses" },
      { id: "cam_espalda_tablon", label: "Espalda Tablon" },
    ],
  },
  {
    id: "cam_pespuntes",
    label: "Pespuntes",
    mode: "single",
    options: [
      { id: "cam_pespuntes_3_16", label: "Pespuntes 3/16" },
      { id: "cam_pespuntes_1_16", label: "Pespuntes 1/16" },
    ],
  },
  {
    id: "cam_textura",
    label: "Textura",
    mode: "single",
    options: [
      { id: "cam_textura_rigida", label: "Textura Rigida" },
      { id: "cam_textura_normal", label: "Textura Normal" },
      { id: "cam_textura_media", label: "Textura Media" },
      { id: "cam_textura_suave", label: "Textura Suave" },
    ],
  },
  {
    id: "cam_piezas",
    label: "Piezas y detalles",
    mode: "flags",
    hint: "Marca SI o NO. Lo que no se responde no se escribe en la ficha.",
    options: [
      { id: "cam_flag_pechera", label: "Pechera" },
      { id: "cam_flag_bolsillo", label: "Bolsillo" },
      { id: "cam_flag_iniciales", label: "Iniciales" },
      { id: "cam_flag_cuello", label: "Cuello" },
      { id: "cam_flag_frente", label: "Frente" },
      { id: "cam_flag_puno", label: "Puño" },
      { id: "cam_flag_mancorna", label: "Mancorna" },
    ],
  },
  {
    id: "cam_material",
    label: "Material",
    mode: "text",
    options: [{ id: "cam_material_cod", label: "Material Cod:" }],
  },
];

const CHALECO_GROUPS: SpecGroup[] = [
  {
    id: "chal_accesorios",
    label: "Accesorios",
    mode: "multi",
    options: [
      { id: "chal_corbata", label: "Corbata" },
      { id: "chal_mancornas", label: "Mancornas" },
    ],
  },
  {
    id: "chal_material",
    label: "Material",
    mode: "text",
    options: [{ id: "chal_material_cod", label: "Material Cod:" }],
  },
];

export const GARMENT_SPEC_GROUPS: Record<GarmentType, SpecGroup[]> = {
  saco: SACO_GROUPS,
  pantalon: PANTALON_GROUPS,
  camisa: CAMISA_GROUPS,
  chaleco: CHALECO_GROUPS,
  otro: [],
};

/** Respuesta de una opción SI/NO. */
export type SpecFlag = "SI" | "NO";

/**
 * Lectura estructurada de una especificación.
 *
 * `free` es la parte que ninguna opción explica — lo que el sastre escribió a
 * mano y las especificaciones viejas importadas. Se conserva siempre: el
 * selector de opciones no puede borrar texto que no entiende.
 */
export interface SpecSelection {
  picked: Set<string>;
  flags: Record<string, SpecFlag>;
  texts: Record<string, string>;
  free: string[];
}

/** Sin acentos, sin mayúsculas, sin espacios de más: así compara el parser. */
function norm(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Trocea la especificación en segmentos.
 *
 * Se corta por coma, punto y coma y salto de línea — NO por barra: "Pespuntes
 * 3/16" y "Puño 7rc" tienen barras dentro del propio valor y partirlas rompía
 * la opción en dos pedazos que ya no coincidían con nada.
 */
function splitSpec(spec: string): string[] {
  return spec
    .split(/[,;\n]+/)
    .map((s) => s.trim())
    .filter(Boolean);
}

interface OptionIndex {
  byLabel: Map<string, { group: SpecGroup; option: SpecOption }>;
  flagsByLabel: Map<string, { group: SpecGroup; option: SpecOption }>;
  texts: { group: SpecGroup; option: SpecOption; prefix: string }[];
}

function buildIndex(groups: SpecGroup[]): OptionIndex {
  const byLabel = new Map<string, { group: SpecGroup; option: SpecOption }>();
  const flagsByLabel = new Map<string, { group: SpecGroup; option: SpecOption }>();
  const texts: OptionIndex["texts"] = [];

  for (const group of groups) {
    for (const option of group.options) {
      if (group.mode === "text") {
        texts.push({ group, option, prefix: norm(option.label) });
      } else if (group.mode === "flags") {
        flagsByLabel.set(norm(option.label), { group, option });
      } else {
        byLabel.set(norm(option.label), { group, option });
      }
    }
  }

  return { byLabel, flagsByLabel, texts };
}

export function parseSpec(garmentType: GarmentType, spec: string): SpecSelection {
  const groups = GARMENT_SPEC_GROUPS[garmentType] ?? [];
  const index = buildIndex(groups);
  const selection: SpecSelection = { picked: new Set(), flags: {}, texts: {}, free: [] };

  for (const segment of splitSpec(spec)) {
    const flat = norm(segment);

    /*
     * 1. "Material Cod: VBC-1234". El valor se corta por los dos puntos del
     * original y no por la longitud del prefijo normalizado: normalizar
     * colapsa espacios y quita acentos, así que las dos cadenas no miden lo
     * mismo y contar caracteres partía el valor por la mitad.
     */
    const text = index.texts.find((t) => flat.startsWith(t.prefix));
    if (text) {
      const value = segment.slice(segment.indexOf(":") + 1).trim();
      if (value) selection.texts[text.option.id] = value;
      continue;
    }

    // 2. "Pechera SI" / "Pechera NO".
    const answered = /^(.*?)\s+(si|no)$/i.exec(segment);
    if (answered) {
      const flag = index.flagsByLabel.get(norm(answered[1]));
      if (flag) {
        selection.flags[flag.option.id] = answered[2].toUpperCase() === "SI" ? "SI" : "NO";
        continue;
      }
    }

    // 3. Estilo exacto: "Cuello Dany", "Bota sencilla".
    const exact = index.byLabel.get(flat);
    if (exact) {
      selection.picked.add(exact.option.id);
      continue;
    }

    /*
     * 4. La pieza nombrada a secas ("Pechera") cuenta como SI. Es como se
     * escribía en el sistema anterior: nombrar una pieza era pedirla. Al
     * recomponer se escribe explícito ("Pechera SI") para que la ficha del
     * taller no dependa de esa convención.
     */
    const bareFlag = index.flagsByLabel.get(flat);
    if (bareFlag) {
      selection.flags[bareFlag.option.id] = "SI";
      continue;
    }

    selection.free.push(segment);
  }

  return selection;
}

/**
 * Vuelve a texto. El orden lo fija el catálogo —no el orden en que el sastre
 * fue tocando— para que dos sacos iguales se lean iguales en el taller; el
 * texto libre queda al final, que es donde se escriben las excepciones.
 */
export function composeSpec(garmentType: GarmentType, selection: SpecSelection): string {
  const groups = GARMENT_SPEC_GROUPS[garmentType] ?? [];
  const parts: string[] = [];

  for (const group of groups) {
    for (const option of group.options) {
      if (group.mode === "text") {
        const value = (selection.texts[option.id] ?? "").trim();
        if (value) parts.push(`${option.label} ${value}`);
      } else if (group.mode === "flags") {
        const flag = selection.flags[option.id];
        if (flag) parts.push(`${option.label} ${flag}`);
      } else if (selection.picked.has(option.id)) {
        parts.push(option.label);
      }
    }
  }

  return [...parts, ...selection.free].join(", ");
}

/** Cuántas decisiones tomadas — alimenta el contador de avance de la pieza. */
export function countSpecSelections(selection: SpecSelection): number {
  return (
    selection.picked.size +
    Object.keys(selection.flags).length +
    Object.values(selection.texts).filter((v) => v.trim()).length
  );
}

/** Cuántas decisiones tiene esta prenda en total (para "3 de 12"). */
export function countSpecGroups(garmentType: GarmentType): number {
  const groups = GARMENT_SPEC_GROUPS[garmentType] ?? [];
  return groups.reduce(
    (total, group) => total + (group.mode === "single" ? 1 : group.options.length),
    0
  );
}
