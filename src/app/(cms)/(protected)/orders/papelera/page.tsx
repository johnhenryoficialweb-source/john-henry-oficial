import Link from "next/link";
import { ArrowLeftIcon, Trash2Icon } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { restoreOrder } from "../actions";
import { formatCurrency } from "@/lib/currency/exchange";
import { ORDER_STATUS_LABELS } from "@/lib/constants";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/shared/empty-state";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { CurrencyCode, OrderStatus } from "@/types/database.types";

export const dynamic = "force-dynamic";

interface TrashedOrder {
  id: string;
  order_number: string | null;
  status: OrderStatus;
  currency: CurrencyCode | null;
  total: number;
  deleted_at: string | null;
  clients: unknown;
  locations: unknown;
}

export default async function OrdersTrashPage() {
  const supabase = await createClient();

  const { data: orders } = await supabase
    .from("orders")
    .select(
      "id, order_number, status, currency, total, deleted_at, clients(full_name), locations(name)"
    )
    .not("deleted_at", "is", null)
    .order("deleted_at", { ascending: false })
    .returns<TrashedOrder[]>();

  const rows = orders ?? [];

  return (
    <div className="space-y-6">
      <Link
        href="/orders"
        className="flex w-fit items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeftIcon className="size-4" />
        Volver a órdenes
      </Link>

      <div>
        <h1 className="font-heading text-2xl">Papelera de órdenes</h1>
        <p className="text-sm text-muted-foreground">
          {rows.length === 0
            ? "No hay órdenes en la papelera."
            : `${rows.length} ${rows.length === 1 ? "orden oculta" : "órdenes ocultas"} de los listados y del panel financiero.`}
        </p>
      </div>

      {rows.length === 0 ? (
        <EmptyState
          icon={Trash2Icon}
          title="La papelera está vacía"
          description="Las órdenes que muevas a la papelera aparecen aquí y se pueden restaurar. Sus pagos y su historial no se borran."
          action={{ href: "/orders", label: "Ver órdenes" }}
        />
      ) : (
        <div className="rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Orden</TableHead>
                <TableHead>Cliente</TableHead>
                <TableHead>Sede</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead>En papelera desde</TableHead>
                <TableHead className="text-right">Total</TableHead>
                <TableHead className="text-right">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((order) => {
                const client = order.clients as unknown as { full_name: string } | null;
                const location = order.locations as unknown as { name: string } | null;

                async function handleRestore() {
                  "use server";
                  await restoreOrder(order.id);
                }

                return (
                  <TableRow key={order.id}>
                    <TableCell className="font-medium">{order.order_number ?? "—"}</TableCell>
                    <TableCell>{client?.full_name ?? "—"}</TableCell>
                    <TableCell>{location?.name ?? "—"}</TableCell>
                    <TableCell>
                      <Badge variant="secondary">{ORDER_STATUS_LABELS[order.status]}</Badge>
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {order.deleted_at
                        ? new Date(order.deleted_at).toLocaleDateString("es-CO")
                        : "—"}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {formatCurrency(order.total, order.currency ?? "USD")}
                    </TableCell>
                    <TableCell className="text-right">
                      <form action={handleRestore}>
                        <Button type="submit" variant="outline" size="sm">
                          Restaurar
                        </Button>
                      </form>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
