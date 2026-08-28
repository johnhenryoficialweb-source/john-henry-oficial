import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { ORDER_STATUS_LABELS } from "@/lib/constants";
import { formatCurrency } from "@/lib/currency/exchange";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { EmptyState } from "@/components/shared/empty-state";
import { ArrowLeftIcon, PlusIcon, ScissorsIcon } from "lucide-react";

export default async function ClientOrdersPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: client } = await supabase.from("clients").select("id, full_name").eq("id", id).single();
  if (!client) notFound();

  const { data: orders } = await supabase
    .from("orders")
    .select("id, order_number, status, currency, total, expected_delivery_date, created_at")
    .eq("client_id", id)
    .order("created_at", { ascending: false });

  return (
    <div className="max-w-2xl space-y-6">
      <Link href={`/clients/${id}`} className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeftIcon className="size-4" />
        Volver a {client.full_name}
      </Link>

      <div className="flex items-center justify-between">
        <h1 className="font-heading text-2xl">Órdenes de {client.full_name}</h1>
        <Button render={<Link href={`/orders/nueva?clientId=${id}`} />} size="sm">
          <PlusIcon />
          Nueva orden
        </Button>
      </div>

      {!orders || orders.length === 0 ? (
        <EmptyState
          icon={ScissorsIcon}
          title="Sin órdenes todavía"
          description="Crea la primera orden para este cliente."
          action={{ href: `/orders/nueva?clientId=${id}`, label: "Crear orden" }}
        />
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Orden</TableHead>
              <TableHead>Estado</TableHead>
              <TableHead>Entrega estimada</TableHead>
              <TableHead className="text-right">Total</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {orders.map((order) => (
              <TableRow key={order.id}>
                <TableCell>
                  <Link href={`/orders/${order.id}`} className="font-medium hover:text-accent">
                    {order.order_number}
                  </Link>
                </TableCell>
                <TableCell>
                  <Badge variant="secondary">{ORDER_STATUS_LABELS[order.status]}</Badge>
                </TableCell>
                <TableCell>
                  {order.expected_delivery_date
                    ? new Date(order.expected_delivery_date).toLocaleDateString("es-CO")
                    : "—"}
                </TableCell>
                <TableCell className="text-right">{formatCurrency(order.total, order.currency ?? "USD")}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </div>
  );
}
