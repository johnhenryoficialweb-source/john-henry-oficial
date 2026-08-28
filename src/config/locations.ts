/**
 * Metadatos estáticos de las sedes (para tipos, rutas y formato de número).
 * Los datos operativos (dirección, horario, calendario, activo/inactivo)
 * viven en la tabla `locations` de Supabase, no aquí.
 */
export const LOCATION_CODES = ["CO", "PA"] as const;
export type LocationCode = (typeof LOCATION_CODES)[number];

export const LOCATION_NUMBER_LOCALE: Record<LocationCode, string> = {
  CO: "es-CO",
  PA: "es-PA",
};

/** Nombre corto para la agenda, donde no cabe "Ciudad de Panamá" en un chip. */
export const LOCATION_SHORT_LABEL: Record<LocationCode, string> = {
  CO: "Bogotá",
  PA: "Panamá",
};

/**
 * Color de sede en la agenda del CMS.
 *
 * Es señalética operativa interna, como el rojo destructivo y el verde de
 * medida confirmada: no aparece en ninguna superficie pública. Se eligieron un
 * cálido y un frío porque son la pareja que mejor se separa de un vistazo sobre
 * navy; los dos oros de la paleta (#E8D090 y #C4A55A) son indistinguibles en un
 * punto de 8px.
 *
 * El color NUNCA va solo: cada cita lleva también el nombre de la sede o su
 * etiqueta corta. Quien no distinga estos dos tonos tiene que poder trabajar
 * igual.
 */
export const LOCATION_ACCENT: Record<LocationCode, string> = {
  CO: "#E8D090", // oro pálido — el mercado de origen
  PA: "#8FA9C9", // azul acero
};

/**
 * Colombia y Panamá están ambas en UTC−5 todo el año (ninguna aplica horario
 * de verano), así que la agenda consolidada puede usar una sola zona sin
 * desalinear las dos sedes. Si alguna vez se abre una sede con otro offset,
 * esto deja de valer y hay que calcular los límites del día por sede.
 */
export const AGENDA_TIME_ZONE = "America/Bogota";
