import { Suspense } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { fetchAllRows } from "@/lib/supabase/fetch-all";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/shared/empty-state";
import { OrdersTable } from "@/components/cms/orders-table";
import { PlusIcon, ScissorsIcon, Trash2Icon } from "lucide-react";
import type { CurrencyCode, OrderStatus } from "@/types/database.types";

interface OrderRow {
  id: string;
  order_number: string | null;
  status: OrderStatus;
  currency: CurrencyCode | null;
  total: number;
  expected_delivery_date: string | null;
  created_at: string;
  client_id: string;
  clients: unknown;
  locations: unknown;
}

export default async function OrdersPage() {
  const supabase = await createClient();
  // Paginado: son más de 1000 órdenes y PostgREST corta ahí en silencio.
  const orders = await fetchAllRows<OrderRow>((from, to) =>
    supabase
      .from("orders")
      .select(
        "id, order_number, status, currency, total, expected_delivery_date, created_at, client_id, clients(full_name), locations(name)"
      )
      .is("deleted_at", null)
      .order("created_at", { ascending: false })
      .range(from, to)
  );

  /*
   * Lo cobrado por orden se calcula aparte: PostgREST no agrupa, y el diálogo de
   * papelera necesita decir cuánta plata deja de contar la orden — que es la
   * mitad del impacto y la que no se puede leer del total.
   */
  const paidByOrder = new Map<string, number>();
  const { data: payments } = await supabase.from("payments").select("order_id, amount");
  for (const payment of payments ?? []) {
    paidByOrder.set(payment.order_id, (paidByOrder.get(payment.order_id) ?? 0) + payment.amount);
  }

  const rows =
    orders?.map((order) => {
      const client = order.clients as unknown as { full_name: string } | null;
      const location = order.locations as unknown as { name: string } | null;
      return {
        id: order.id,
        order_number: order.order_number,
        client_id: order.client_id,
        client_name: client?.full_name ?? null,
        location_name: location?.name ?? null,
        status: order.status,
        expected_delivery_date: order.expected_delivery_date,
        created_at: order.created_at,
        total: order.total,
        paid_total: paidByOrder.get(order.id) ?? 0,
        currency: order.currency,
      };
    }) ?? [];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-heading text-2xl">Órdenes</h1>
          <p className="text-sm text-muted-foreground">{rows.length} órdenes registradas.</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" render={<Link href="/orders/papelera" />}>
            <Trash2Icon />
            Papelera
          </Button>
          <Button render={<Link href="/orders/nueva" />}>
            <PlusIcon />
            Nueva orden
          </Button>
        </div>
      </div>

      {rows.length === 0 ? (
        <EmptyState
          icon={ScissorsIcon}
          title="Aún no hay órdenes"
          description="Crea la primera orden seleccionando un cliente y sus prendas a medida."
          action={{ href: "/orders/nueva", label: "Crear primera orden" }}
        />
      ) : (
        // La tabla lee los filtros de la URL (useSearchParams), y eso obliga a
        // un límite de Suspense para que el build no marque bailout a CSR.
        <Suspense fallback={<p className="text-sm text-muted-foreground">Cargando órdenes…</p>}>
          <OrdersTable orders={rows} />
        </Suspense>
      )}
    </div>
  );
}
