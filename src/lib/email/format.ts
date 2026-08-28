/**
 * Formato de fechas para el módulo de correos.
 *
 * "hace 3 horas" responde la pregunta que se hace quien entra a /correos
 * —¿esto está vivo?— mejor que "12/08/2026 14:32", que obliga a restar
 * mentalmente. Pasado el día se muestra la fecha, porque a esa distancia
 * "hace 9 días" ya no ubica a nadie.
 */
export function relativeTime(iso: string | null | undefined): string {
  if (!iso) return "nunca";

  const date = new Date(iso);
  const diffMs = Date.now() - date.getTime();
  const minutes = Math.round(diffMs / 60_000);

  if (minutes < 1) return "hace un momento";
  if (minutes < 60) return `hace ${minutes} min`;

  const hours = Math.round(minutes / 60);
  if (hours < 24) return `hace ${hours} ${hours === 1 ? "hora" : "horas"}`;

  const days = Math.round(hours / 24);
  if (days === 1) return "ayer";
  if (days < 7) return `hace ${days} días`;

  return date.toLocaleDateString("es-CO", { day: "numeric", month: "short", year: "numeric" });
}

export function exactTime(iso: string): string {
  return new Date(iso).toLocaleString("es-CO", {
    day: "numeric",
    month: "short",
    hour: "numeric",
    minute: "2-digit",
  });
}
