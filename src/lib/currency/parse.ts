/**
 * Lee un monto escrito por una persona, no por una máquina.
 *
 * `Number("1.500.000")` es `NaN`, y un `NaN || 0` convierte un millón y medio en
 * cero sin decir nada. En Colombia el punto es separador de miles y la coma es
 * el decimal, que es exactamente al revés del formato que entiende JavaScript,
 * así que el error no es un caso raro: es cómo se escribe un precio aquí.
 * Importa sobre todo ahora, cargando a mano el histórico de órdenes y de cobros,
 * donde el número mal leído no se nota hasta que el reporte no cuadra.
 *
 * Reglas:
 * - Si aparecen punto y coma, manda el último que aparezca como decimal.
 * - Si solo hay puntos y son varios, o el último grupo tiene exactamente tres
 *   dígitos, son separadores de miles.
 * - Si solo hay comas, mismo criterio.
 */
export function parseAmount(raw: string | number | null | undefined): number {
  if (typeof raw === "number") return Number.isFinite(raw) ? raw : 0;

  const cleaned = String(raw ?? "")
    .replace(/[^\d.,-]/g, "")
    .trim();

  if (!cleaned) return 0;

  const negative = cleaned.startsWith("-");
  const digits = cleaned.replace(/-/g, "");

  const lastDot = digits.lastIndexOf(".");
  const lastComma = digits.lastIndexOf(",");

  let normalized: string;

  if (lastDot !== -1 && lastComma !== -1) {
    // Ambos presentes: el último es el decimal, el otro es separador de miles.
    const decimalIndex = Math.max(lastDot, lastComma);
    const intPart = digits.slice(0, decimalIndex).replace(/[.,]/g, "");
    const decPart = digits.slice(decimalIndex + 1).replace(/[.,]/g, "");
    normalized = `${intPart}.${decPart}`;
  } else if (lastDot !== -1 || lastComma !== -1) {
    const separator = lastDot !== -1 ? "." : ",";
    const index = lastDot !== -1 ? lastDot : lastComma;
    const occurrences = digits.split(separator).length - 1;
    const tail = digits.slice(index + 1);

    // Varios separadores, o un grupo final de tres dígitos: son miles.
    // "1.500" es mil quinientos, no uno con cinco — el caso normal en COP.
    if (occurrences > 1 || tail.length === 3) {
      normalized = digits.replace(/[.,]/g, "");
    } else {
      normalized = `${digits.slice(0, index).replace(/[.,]/g, "")}.${tail}`;
    }
  } else {
    normalized = digits;
  }

  const value = Number(normalized);
  if (!Number.isFinite(value)) return 0;
  return negative ? -value : value;
}
