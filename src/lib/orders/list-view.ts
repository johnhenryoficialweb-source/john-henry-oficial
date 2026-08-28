/**
 * Dónde se recuerda la vista del listado de órdenes.
 *
 * El caso que resuelve: filtrar por un cliente, entrar a una de sus órdenes y
 * volver con la flecha. La flecha apuntaba a `/orders` a secas, así que
 * devolvía el listado completo y había que re-escribir el filtro en cada
 * revisión — el reclamo original. Los filtros ya viven en la URL del listado,
 * pero el detalle de la orden no la conoce: esta llave es cómo se la pasa.
 */
export const ORDERS_QUERY_KEY = "orders:last-query";

/** Ruta al listado conservando los últimos filtros usados. */
export function ordersListHref(): string {
  if (typeof window === "undefined") return "/orders";
  const query = window.sessionStorage.getItem(ORDERS_QUERY_KEY);
  return query ? `/orders?${query}` : "/orders";
}
