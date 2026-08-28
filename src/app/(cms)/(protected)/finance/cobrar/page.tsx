import Link from "next/link";
import { getReceivables } from "@/lib/finance/queries";
import { formatCurrency } from "@/lib/currency/exchange";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ExportCsvButton } from "@/components/shared/export-csv-button";
import { EmptyState } from "@/components/shared/empty-state";
import { WalletIcon } from "lucide-react";

export default async function ReceivablesPage() {
  const receivables = await getReceivables();
  const totalOutstanding = receivables.reduce((sum, r) => sum + r.balance, 0);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-heading text-2xl">Cuentas por cobrar</h1>
          <p className="text-sm text-muted-foreground">
            {receivables.length}{" "}
            {receivables.length === 1 ? "orden con saldo pendiente" : "órdenes con saldo pendiente"} ·{" "}
            {formatCurrency(totalOutstanding, "USD")} aprox.
          </p>
        </div>
        <ExportCsvButton
          rows={receivables.map((r) => ({
            orden: r.orderNumber,
            cliente: r.clientName,
            sede: r.locationName,
            total: r.total,
            pagado: r.paid,
            saldo: r.balance,
            moneda: r.currency,
          }))}
          filename="cuentas-por-cobrar.csv"
        />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Saldos por cliente</CardTitle>
        </CardHeader>
        <CardContent>
          {receivables.length === 0 ? (
            <EmptyState
              icon={WalletIcon}
              title="Sin saldos pendientes"
              description="Todas las órdenes activas están al día con sus pagos. Cuando una orden quede con saldo, aparecerá acá con su cliente y su sede."
              action={{ href: "/orders", label: "Ver órdenes" }}
            />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Orden</TableHead>
                  <TableHead>Cliente</TableHead>
                  <TableHead>Sede</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                  <TableHead className="text-right">Pagado</TableHead>
                  <TableHead className="text-right">Saldo</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {receivables.map((r) => (
                  <TableRow key={r.orderId}>
                    <TableCell>
                      <Link href={`/orders/${r.orderId}`} className="font-medium hover:text-accent">
                        {r.orderNumber}
                      </Link>
                    </TableCell>
                    <TableCell>{r.clientName}</TableCell>
                    <TableCell>{r.locationName}</TableCell>
                    <TableCell className="text-right tabular-nums">
                      {formatCurrency(r.total, r.currency as "USD" | "COP")}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {formatCurrency(r.paid, r.currency as "USD" | "COP")}
                    </TableCell>
                    <TableCell className="text-right font-medium tabular-nums">
                      {formatCurrency(r.balance, r.currency as "USD" | "COP")}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
