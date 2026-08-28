/** Tamaño de página. Coincide con el tope por defecto de PostgREST. */
const PAGE_SIZE = 1000;

interface PageResult<T> {
  data: T[] | null;
  error: { message: string } | null;
}

/**
 * Lee una tabla completa paginando de forma explícita.
 *
 * PostgREST devuelve como máximo 1000 filas y NO avisa de que cortó: la
 * consulta se ve exitosa y simplemente faltan datos. Ese silencio ya costó caro
 * dos veces en este proyecto — dejó la base con 1000 de 1070 órdenes tras el
 * import, y después el listado de órdenes mostrando "1000 de 1000" cuando había
 * 1070.
 *
 * Regla: cualquier lectura de tabla que pueda pasar de 1000 filas va por acá.
 *
 * ```ts
 * const orders = await fetchAllRows<Row>((from, to) =>
 *   supabase.from("orders").select("id, total").range(from, to)
 * );
 * ```
 */
export async function fetchAllRows<T>(
  page: (from: number, to: number) => PromiseLike<PageResult<T>>
): Promise<T[]> {
  const rows: T[] = [];

  for (let from = 0; ; from += PAGE_SIZE) {
    const { data, error } = await page(from, from + PAGE_SIZE - 1);
    if (error) throw new Error(error.message);

    const batch = data ?? [];
    rows.push(...batch);

    // Una página incompleta significa que ya no hay más.
    if (batch.length < PAGE_SIZE) return rows;
  }
}
