import { CheckCircle2Icon, LandmarkIcon, LockIcon, TrendingUpIcon } from "lucide-react";
import { getStaffSession } from "@/lib/auth/roles";
import { getRoyaltyLedger } from "@/lib/finance/royalties";
import { ROYALTY_BASE_LABELS } from "@/lib/finance/labels";
import { formatCurrency } from "@/lib/currency/exchange";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { EmptyState } from "@/components/shared/empty-state";
import { ExportCsvButton } from "@/components/shared/export-csv-button";
import {
  RoyaltyReopenButton,
  RoyaltySettleButton,
} from "@/components/finance/royalty-settle-button";

export default async function RoyaltiesPage() {
  const session = await getStaffSession();
  const isAdmin = session?.role === "admin";
  const ledger = await getRoyaltyLedger();

  const { config, source, beneficiary } = ledger;

  if (!ledger.configured || !source || !beneficiary) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="font-heading text-2xl">Regalía inter-sede</h1>
          <p className="text-sm text-muted-foreground">
            {config.percent}% de las ventas de {config.sourceLocationCode} para la casa matriz en{" "}
            {config.beneficiaryLocationCode}.
          </p>
        </div>
        <EmptyState
          icon={LandmarkIcon}
          title="Faltan las sedes del acuerdo"
          description={`No se encontró alguna de las sedes con código ${config.sourceLocationCode} o ${config.beneficiaryLocationCode}. Créalas o corrige sus códigos para que la regalía se pueda calcular.`}
          action={{ href: "/settings", label: "Ir a Ajustes" }}
        />
      </div>
    );
  }

  const baseLabel = config.base === "collected" ? "Cobrado" : "Facturado";
  const currentMonth = ledger.periods.find((period) => period.isCurrentMonth);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="font-heading text-2xl">Regalía inter-sede</h1>
          <p className="text-sm text-muted-foreground">
            {source.name} gira {config.percent}% a {beneficiary.name} ·{" "}
            {ROYALTY_BASE_LABELS[config.base].toLowerCase()}.
          </p>
        </div>
        <ExportCsvButton
          rows={ledger.periods.map((period) => ({
            periodo: period.label,
            desde: period.from,
            hasta: period.to,
            base: period.baseAmount,
            moneda: period.baseCurrency,
            porcentaje: config.percent,
            regalia: period.amount,
            regalia_usd: period.amountUsd,
            estado: period.status,
            girada_el: period.paidAt ?? "",
            referencia: period.reference ?? "",
          }))}
          filename="regalias.csv"
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <Card size="sm">
          <CardContent className="space-y-1">
            <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <TrendingUpIcon className="size-3.5" />
              Acumulando este mes
            </p>
            <p className="text-2xl font-semibold tabular-nums text-accent">
              {formatCurrency(currentMonth?.amount ?? 0, source.currency)}
            </p>
            <p className="text-xs text-muted-foreground">
              sobre {formatCurrency(currentMonth?.baseAmount ?? 0, source.currency)} de{" "}
              {baseLabel.toLowerCase()}
            </p>
          </CardContent>
        </Card>

        <Card size="sm">
          <CardContent className="space-y-1">
            <p className="text-xs text-muted-foreground">Pendiente de girar</p>
            <p className="text-2xl font-semibold tabular-nums">
              {formatCurrency(ledger.pendingAmount, source.currency)}
            </p>
            <p className="text-xs text-muted-foreground">
              {ledger.pendingCount} {ledger.pendingCount === 1 ? "mes cerrado" : "meses cerrados"} ·{" "}
              {formatCurrency(ledger.pendingAmountUsd, "USD")}
            </p>
          </CardContent>
        </Card>

        <Card size="sm">
          <CardContent className="space-y-1">
            <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <CheckCircle2Icon className="size-3.5" />
              Girado en el año
            </p>
            <p className="text-2xl font-semibold tabular-nums">
              {formatCurrency(ledger.paidThisYearUsd, "USD")}
            </p>
            <p className="text-xs text-muted-foreground">consolidado en USD</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Liquidación mes a mes</CardTitle>
          <CardDescription>
            El monto se recalcula desde las ventas reales hasta que se gira; al girarlo queda
            congelado con su base y su tasa.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Periodo</TableHead>
                <TableHead className="text-right">{baseLabel}</TableHead>
                <TableHead className="text-right">Regalía {config.percent}%</TableHead>
                <TableHead className="text-right">USD</TableHead>
                <TableHead>Estado</TableHead>
                {isAdmin && <TableHead className="w-36 text-right">Acción</TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {ledger.periods.map((period) => (
                <TableRow key={period.periodKey}>
                  <TableCell className="font-medium">
                    {period.label}
                    <span className="block text-xs font-normal text-muted-foreground">
                      {period.orderCount} {config.base === "collected" ? "pagos" : "órdenes"}
                    </span>
                  </TableCell>
                  <TableCell className="text-right tabular-nums text-muted-foreground">
                    {formatCurrency(period.baseAmount, period.baseCurrency)}
                  </TableCell>
                  <TableCell className="text-right font-medium tabular-nums">
                    {formatCurrency(period.amount, period.baseCurrency)}
                  </TableCell>
                  <TableCell className="text-right tabular-nums text-muted-foreground">
                    {formatCurrency(period.amountUsd, "USD")}
                  </TableCell>
                  <TableCell>
                    {period.status === "paid" ? (
                      <span className="flex flex-col gap-0.5">
                        <Badge variant="secondary" className="w-fit">
                          Girada
                        </Badge>
                        {period.paidAt && (
                          <span className="text-xs text-muted-foreground">
                            {new Date(period.paidAt).toLocaleDateString("es-CO")}
                            {period.reference && ` · ${period.reference}`}
                          </span>
                        )}
                      </span>
                    ) : period.status === "accruing" ? (
                      <Badge variant="outline">En curso</Badge>
                    ) : period.amount > 0 ? (
                      <Badge variant="destructive">Pendiente</Badge>
                    ) : period.orderCount > 0 ? (
                      <span className="text-xs text-muted-foreground">
                        {period.orderCount} {config.base === "collected" ? "pagos" : "órdenes"} sin
                        valor
                      </span>
                    ) : (
                      <span className="text-xs text-muted-foreground">Sin ventas</span>
                    )}
                  </TableCell>
                  {isAdmin && (
                    <TableCell className="text-right">
                      {period.status === "paid" && period.settlementId ? (
                        <RoyaltyReopenButton
                          settlementId={period.settlementId}
                          periodLabel={period.label}
                        />
                      ) : period.status === "pending" && period.amount > 0 ? (
                        <RoyaltySettleButton
                          periodKey={period.periodKey}
                          periodLabel={period.label}
                          baseAmount={period.baseAmount}
                          baseCurrency={period.baseCurrency}
                          percent={config.percent}
                          amount={period.amount}
                          amountUsd={period.amountUsd}
                          baseLabel={baseLabel}
                          sourceName={source.name}
                          beneficiaryName={beneficiary.name}
                        />
                      ) : (
                        <span className="text-xs text-muted-foreground">
                          {period.status === "accruing" ? "Cierra a fin de mes" : "—"}
                        </span>
                      )}
                    </TableCell>
                  )}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* El acuerdo se muestra, no se edita: es un pacto entre sedes, no una
          preferencia de la app. Cambiarlo exige commit y despliegue. */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <LockIcon className="size-4 text-muted-foreground" />
            Acuerdo vigente
          </CardTitle>
          <CardDescription>
            Fijado en código. No se puede modificar desde el sistema.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <dl className="grid gap-4 sm:grid-cols-4">
            <div>
              <dt className="text-xs text-muted-foreground">Porcentaje</dt>
              <dd className="text-2xl font-semibold tabular-nums">{config.percent}%</dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">Sede que gira</dt>
              <dd className="text-sm">{source.name}</dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">Casa matriz</dt>
              <dd className="text-sm">{beneficiary.name}</dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">Base de cálculo</dt>
              <dd className="text-sm">{ROYALTY_BASE_LABELS[config.base]}</dd>
            </div>
          </dl>
        </CardContent>
      </Card>
    </div>
  );
}
