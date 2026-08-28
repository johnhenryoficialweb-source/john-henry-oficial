import Link from "next/link";
import { CreditCardIcon } from "lucide-react";
import { getFinanceReport, getPaymentFees } from "@/lib/finance/queries";
import { formatCurrency } from "@/lib/currency/exchange";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { LocationComparisonChart } from "@/components/cms/location-comparison-chart";
import { ExportCsvButton } from "@/components/shared/export-csv-button";

export default async function FinanceReportPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string; to?: string }>;
}) {
  const { from, to } = await searchParams;
  const [report, fees] = await Promise.all([
    getFinanceReport({ from, to }),
    getPaymentFees({ from, to }),
  ]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-heading text-2xl">Reporte financiero</h1>
          <p className="text-sm text-muted-foreground">Comparativo multi-sede y multi-moneda.</p>
        </div>
        <ExportCsvButton
          rows={report.monthlyByLocation.map((m) => ({ mes: m.month, colombia_usd: m.CO, panama_usd: m.PA }))}
          filename="reporte-financiero.csv"
        />
      </div>

      <form className="flex items-end gap-3">
        <div className="space-y-1">
          <label className="text-xs text-muted-foreground">Desde</label>
          <Input type="date" name="from" defaultValue={from} />
        </div>
        <div className="space-y-1">
          <label className="text-xs text-muted-foreground">Hasta</label>
          <Input type="date" name="to" defaultValue={to} />
        </div>
        <Button type="submit" variant="secondary">
          Filtrar
        </Button>
      </form>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm text-muted-foreground">Total facturado — Colombia</CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-semibold">{formatCurrency(report.totalCop, "COP")}</CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-sm text-muted-foreground">Total facturado — Panamá</CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-semibold">{formatCurrency(report.totalUsdNative, "USD")}</CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-sm text-muted-foreground">Consolidado (USD)</CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-semibold text-accent">
            {formatCurrency(report.consolidatedUsd, "USD")}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-sm text-muted-foreground">Comisiones de cobro</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-semibold text-destructive">
              {formatCurrency(fees.feeUsd, "USD")}
            </p>
            <p className="text-xs text-muted-foreground">
              {fees.feeUsd > 0
                ? `${fees.effectivePercent}% de lo cobrado`
                : "datáfono y pasarelas"}
            </p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Colombia vs. Panamá por mes (USD)</CardTitle>
        </CardHeader>
        <CardContent>
          <LocationComparisonChart data={report.monthlyByLocation} />
        </CardContent>
      </Card>

      {/* Lo que costó cobrar. Es un egreso que nunca pasa por la caja —el
          adquirente lo descuenta antes de consignar— y por eso no aparece en
          "salidas de dinero" por más que sea plata perdida. */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CreditCardIcon className="size-4 text-accent" />
            Comisiones de datáfono y pasarelas
          </CardTitle>
          <CardDescription>
            {fees.feeUsd > 0
              ? `${formatCurrency(fees.feeUsd, "USD")} retenidos sobre ${formatCurrency(fees.collectedUsd, "USD")} cobrados en el periodo — el ${fees.effectivePercent}% de todo lo que entró.`
              : "Ningún cobro del periodo tuvo comisión registrada."}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {fees.unconfiguredChannels.length > 0 && (
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-dashed p-3 text-xs">
              <p className="max-w-prose text-muted-foreground">
                <span className="font-medium text-foreground">
                  {fees.unconfiguredChannels.join(", ")}
                </span>{" "}
                {fees.unconfiguredChannels.length === 1 ? "está" : "están"} en 0%: mientras no tengan
                su porcentaje, este total va a quedarse corto.
              </p>
              <Link
                href="/settings/medios-pago"
                className="shrink-0 underline underline-offset-4 hover:text-accent"
              >
                Configurar
              </Link>
            </div>
          )}

          {fees.byChannel.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              No hay cobros registrados en este periodo.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Medio de cobro</TableHead>
                  <TableHead className="text-right">Cobros</TableHead>
                  <TableHead className="text-right">Cobrado (USD)</TableHead>
                  <TableHead className="text-right">Comisión (USD)</TableHead>
                  <TableHead className="text-right">Peso</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {fees.byChannel.map((row) => (
                  <TableRow key={row.channelName}>
                    <TableCell className="font-medium">
                      {row.channelName}
                      {row.currentPercent ? (
                        <span className="block text-xs text-muted-foreground">
                          {row.currentPercent}% vigente
                        </span>
                      ) : null}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">{row.count}</TableCell>
                    <TableCell className="text-right tabular-nums">
                      {formatCurrency(row.collectedUsd, "USD")}
                    </TableCell>
                    <TableCell
                      className={`text-right tabular-nums ${row.feeUsd > 0 ? "text-destructive" : "text-muted-foreground"}`}
                    >
                      {row.feeUsd > 0 ? `− ${formatCurrency(row.feeUsd, "USD")}` : "—"}
                    </TableCell>
                    <TableCell className="text-right tabular-nums text-muted-foreground">
                      {row.collectedUsd > 0
                        ? `${Math.round((row.feeUsd / row.collectedUsd) * 1000) / 10}%`
                        : "—"}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}

          {fees.byMonth.length > 0 && (
            <div className="flex flex-wrap gap-x-4 gap-y-1 border-t pt-3 text-xs text-muted-foreground">
              {fees.byMonth.map((row) => (
                <span key={row.month}>
                  {row.month}:{" "}
                  <span className="tabular-nums text-foreground">
                    {formatCurrency(row.feeUsd, "USD")}
                  </span>
                </span>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
