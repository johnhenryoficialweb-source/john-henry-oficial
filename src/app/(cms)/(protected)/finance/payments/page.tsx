import Link from "next/link";
import { getPaymentsLedger } from "@/lib/finance/queries";
import { formatCurrency } from "@/lib/currency/exchange";
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
import { ReceiptIcon } from "lucide-react";

const METHOD_LABELS: Record<string, string> = {
  cash: "Efectivo",
  card: "Tarjeta",
  transfer: "Transferencia",
  other: "Otro",
};

export default async function PaymentsLedgerPage() {
  const payments = await getPaymentsLedger();
  /*
   * Solo se cuenta cuántos cobros tuvieron comisión, no se suman: el listado
   * mezcla COP y USD y un total en bruto sería una cifra falsa. El total
   * consolidado vive en el reporte, que sí convierte con la tasa congelada.
   */
  const withFee = payments.filter((p) => p.fee > 0).length;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-heading text-2xl">Historial de pagos</h1>
          <p className="text-sm text-muted-foreground">
            Últimos {payments.length} pagos registrados
            {withFee > 0
              ? ` · ${withFee} con comisión de datáfono o pasarela`
              : ""}
            .
          </p>
        </div>
        <ExportCsvButton
          rows={payments.map((p) => ({
            fecha: p.paidAt,
            orden: p.orderNumber,
            cliente: p.clientName,
            sede: p.locationName,
            monto: p.amount,
            moneda: p.currency,
            medio: p.channelName ?? METHOD_LABELS[p.method] ?? p.method,
            comision: p.fee,
            neto: p.net,
          }))}
          filename="historial-pagos.csv"
        />
      </div>

      {payments.length === 0 ? (
        <EmptyState icon={ReceiptIcon} title="Sin pagos registrados" description="Los pagos aparecerán aquí a medida que se registren desde cada orden." />
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Fecha</TableHead>
              <TableHead>Orden</TableHead>
              <TableHead>Cliente</TableHead>
              <TableHead>Sede</TableHead>
              <TableHead>Medio</TableHead>
              <TableHead className="text-right">Monto</TableHead>
              <TableHead className="text-right">Comisión</TableHead>
              <TableHead className="text-right">Neto</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {payments.map((p) => (
              <TableRow key={p.id}>
                <TableCell>{new Date(p.paidAt).toLocaleDateString("es-CO")}</TableCell>
                <TableCell>
                  <Link href={`/orders/${p.orderId}`} className="hover:text-accent">
                    {p.orderNumber}
                  </Link>
                </TableCell>
                <TableCell>{p.clientName}</TableCell>
                <TableCell>{p.locationName}</TableCell>
                <TableCell>{p.channelName ?? METHOD_LABELS[p.method] ?? p.method}</TableCell>
                <TableCell className="text-right tabular-nums">
                  {formatCurrency(p.amount, p.currency as "USD" | "COP")}
                </TableCell>
                <TableCell
                  className={`text-right tabular-nums ${p.fee > 0 ? "text-destructive" : "text-muted-foreground"}`}
                >
                  {p.fee > 0 ? `− ${formatCurrency(p.fee, p.currency as "USD" | "COP")}` : "—"}
                </TableCell>
                <TableCell className="text-right font-medium tabular-nums">
                  {formatCurrency(p.net, p.currency as "USD" | "COP")}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </div>
  );
}
