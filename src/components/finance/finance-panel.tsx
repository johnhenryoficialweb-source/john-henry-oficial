import Link from "next/link";
import {
  ArrowDownCircleIcon,
  ArrowUpCircleIcon,
  BanknoteIcon,
  ClockIcon,
  CreditCardIcon,
  FileWarningIcon,
  LandmarkIcon,
  ScaleIcon,
  TriangleAlertIcon,
} from "lucide-react";
import { formatCurrency } from "@/lib/currency/exchange";
import { cn } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/shared/empty-state";
import { KpiStrip } from "@/components/finance/kpi-strip";
import { CountryMoneyCard } from "@/components/finance/country-money-card";
import { MoneyFlowChart } from "@/components/finance/money-flow-chart";
import { GenerateFixedExpensesButton } from "@/components/finance/generate-fixed-expenses-button";
import { EXPENSE_KIND_LABELS } from "@/lib/finance/labels";
import type { FinanceOverview } from "@/lib/finance/overview";
import type { Period } from "@/lib/finance/period";

export interface PendingFixedSummary {
  count: number;
  descriptions: string[];
  total: string;
}

/**
 * Cuerpo del panel financiero, separado de su carga de datos.
 *
 * La página lee de Supabase y pasa el resultado; el componente solo compone.
 * Esa separación es la que permite revisar la pantalla con datos de ejemplo
 * —poblada, en ceros, vacía— sin depender de lo que haya hoy en la base.
 */
export function FinancePanel({
  overview,
  period,
  periodQuery,
  pendingFixed,
  isAdmin,
}: {
  overview: FinanceOverview;
  period: Period;
  periodQuery: string;
  pendingFixed: PendingFixedSummary;
  isAdmin: boolean;
}) {
  const { consolidated, royalty } = overview;
  const hasSeries = overview.monthly.some(
    (row) => row.ingresos > 0 || row.salidas > 0,
  );

  // Una orden sin valor sigue siendo actividad: decir "sin movimientos" con 8
  // órdenes registradas en el periodo haría que la pantalla se lea como rota.
  const hasActivity =
    consolidated.billed > 0 ||
    consolidated.expenses > 0 ||
    consolidated.outstanding > 0 ||
    overview.ordersInPeriod > 0;

  return (
    <>
      {/* Regla UX #12/#2: lo que el sistema puede hacer solo, lo ofrece hecho. */}
      {isAdmin && pendingFixed.count > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-accent/40 bg-accent/5 p-4">
          <div className="flex items-start gap-3">
            <ClockIcon className="mt-0.5 size-4 shrink-0 text-accent" />
            <div>
              <p className="text-sm font-medium">
                {pendingFixed.count}{" "}
                {pendingFixed.count === 1
                  ? "salida fija pendiente"
                  : "salidas fijas pendientes"}{" "}
                de este mes
              </p>
              <p className="text-xs text-muted-foreground">
                {pendingFixed.descriptions.slice(0, 3).join(" · ")}
                {pendingFixed.count > 3 &&
                  ` · y ${pendingFixed.count - 3} más`}{" "}
                — total {pendingFixed.total}.
              </p>
            </div>
          </div>
          <GenerateFixedExpensesButton
            count={pendingFixed.count}
            summary={pendingFixed.total}
          />
        </div>
      )}

      {/* La causa más probable de un panel en ceros no es que no haya pasado
          nada, sino que las órdenes existan sin valor. Decirlo evita que la
          pantalla se lea como un error del sistema. */}
      {overview.ordersWithoutValue > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-dashed p-4">
          <div className="flex items-start gap-3">
            <FileWarningIcon className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
            <div>
              <p className="text-sm font-medium">
                {overview.ordersWithoutValue === overview.ordersInPeriod
                  ? `Las ${overview.ordersInPeriod} órdenes de este periodo no tienen valor registrado`
                  : `${overview.ordersWithoutValue} de ${overview.ordersInPeriod} órdenes sin valor registrado`}
              </p>
              <p className="max-w-prose text-xs text-muted-foreground">
                El histórico importado llegó sin precios, así que esas órdenes
                no suman al facturado ni causan regalía. Las órdenes nuevas sí
                registran su total; para el histórico hay que cargarlo desde
                cada orden.
              </p>
            </div>
          </div>
          <Button render={<Link href="/orders" />} size="sm" variant="outline">
            Ver órdenes
          </Button>
        </div>
      )}

      {!overview.hasAnyBaseCost && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-dashed p-4">
          <div className="flex items-start gap-3">
            <TriangleAlertIcon className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
            <div>
              <p className="text-sm font-medium">
                Aún no hay costos base cargados
              </p>
              <p className="max-w-prose text-xs text-muted-foreground">
                Sin costo por pieza, el margen que ves es igual a la
                facturación. Cárgalos una vez y cada orden nueva lo congela
                automáticamente.
              </p>
            </div>
          </div>
          <Button
            render={<Link href="/finance/costos" />}
            size="sm"
            variant="secondary"
          >
            Cargar costos base
          </Button>
        </div>
      )}

      {!hasActivity ? (
        <EmptyState
          icon={BanknoteIcon}
          title={`Ni una orden ni una salida en ${period.label.toLowerCase()}`}
          description="Este periodo está limpio: no hay órdenes creadas, pagos recibidos ni gastos registrados. Cambia el periodo arriba para revisar otro mes, o registra la primera salida de dinero."
          action={{
            href: "/finance/salidas/nueva",
            label: "Registrar salida de dinero",
          }}
        />
      ) : (
        <>
          <KpiStrip
            items={[
              {
                label: "Entradas (facturado)",
                value: formatCurrency(consolidated.billed, "USD"),
                hint: "consolidado en USD",
                icon: ArrowUpCircleIcon,
              },
              {
                label: "Salidas de dinero",
                value: formatCurrency(consolidated.expenses, "USD"),
                hint: `${formatCurrency(consolidated.expensesFixed, "USD")} fijas`,
                icon: ArrowDownCircleIcon,
                tone: "out",
                href: `/finance/salidas${periodQuery}`,
              },
              {
                label: "Comisiones de cobro",
                value: formatCurrency(consolidated.fees, "USD"),
                hint:
                  consolidated.fees > 0
                    ? `${((consolidated.fees / Math.max(consolidated.collected, 1)) * 100).toFixed(1)}% de lo cobrado`
                    : "datáfono y pasarelas",
                icon: CreditCardIcon,
                tone: "out",
                href: `/finance/payments${periodQuery}`,
              },
              {
                label: "Margen bruto",
                value: formatCurrency(consolidated.grossMargin, "USD"),
                hint: `costo de piezas ${formatCurrency(consolidated.cogs, "USD")}`,
                icon: ScaleIcon,
                href: `/finance/costos${periodQuery}`,
              },
              {
                label: `Regalía ${royalty.percent}%`,
                value: formatCurrency(consolidated.royalty, "USD"),
                hint: `${royalty.sourceLocationCode} → ${royalty.beneficiaryLocationCode}`,
                icon: LandmarkIcon,
                href: "/finance/royalties",
              },
              {
                label: "Resultado neto",
                value: formatCurrency(consolidated.net, "USD"),
                hint: `por cobrar ${formatCurrency(consolidated.outstanding, "USD")}`,
                icon: BanknoteIcon,
                tone: "accent",
              },
            ]}
          />

          <div className="grid gap-4 lg:grid-cols-2">
            {overview.locations.map((location) => (
              <CountryMoneyCard
                key={location.locationId}
                finance={location}
                periodQuery={periodQuery}
              />
            ))}
          </div>

          {overview.channelFees.length > 0 && (
            <Card>
              <CardHeader className="flex flex-row items-start justify-between gap-3">
                <div>
                  <CardTitle>Por dónde entró la plata</CardTitle>
                  <p className="text-xs text-muted-foreground">
                    {consolidated.fees > 0
                      ? `${formatCurrency(consolidated.fees, "USD")} se quedaron en comisiones de datáfono y pasarelas.`
                      : "Ningún medio de cobro tiene comisión configurada todavía."}
                  </p>
                </div>
                <Link
                  href="/settings/medios-pago"
                  className="shrink-0 text-xs text-muted-foreground hover:text-accent"
                >
                  Configurar comisiones
                </Link>
              </CardHeader>
              <CardContent>
                <ul className="divide-y divide-border/60">
                  {overview.channelFees.map((row) => (
                    <li
                      key={row.channelName}
                      className="flex flex-wrap items-baseline justify-between gap-x-3 py-1.5 text-sm"
                    >
                      <span className="flex min-w-0 items-baseline gap-2">
                        <span className="truncate">{row.channelName}</span>
                        <span className="shrink-0 text-xs text-muted-foreground">
                          {row.count} {row.count === 1 ? "cobro" : "cobros"}
                        </span>
                      </span>
                      <span className="flex shrink-0 items-baseline gap-3 tabular-nums">
                        <span>{formatCurrency(row.collectedUsd, "USD")}</span>
                        <span
                          className={cn(
                            "w-24 text-right text-xs",
                            row.feeUsd > 0 ? "text-destructive" : "text-muted-foreground",
                          )}
                        >
                          {row.feeUsd > 0
                            ? `− ${formatCurrency(row.feeUsd, "USD")}`
                            : "sin comisión"}
                        </span>
                      </span>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          )}

          {/* Con la serie vacía y sin salidas, esta fila serían dos cajas
              explicando lo que los avisos de arriba ya dijeron. */}
          {(hasSeries || overview.expenseBreakdown.length > 0) && (
            <div className="grid gap-4 lg:grid-cols-3">
              <Card className="lg:col-span-2">
                <CardHeader>
                  <CardTitle>
                    Entradas contra salidas — últimos 12 meses (USD)
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {hasSeries ? (
                    <MoneyFlowChart data={overview.monthly} />
                  ) : (
                    <p className="py-16 text-center text-sm text-muted-foreground">
                      Todavía no hay serie que dibujar: ningún mes del último
                      año registra entradas ni salidas con valor.
                    </p>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between">
                  <CardTitle>Salidas por tipo</CardTitle>
                  <Link
                    href={`/finance/salidas${periodQuery}`}
                    className="text-xs text-muted-foreground hover:text-accent"
                  >
                    Ver todas
                  </Link>
                </CardHeader>
                <CardContent className="space-y-4">
                  {overview.expenseBreakdown.length === 0 ? (
                    <p className="py-8 text-center text-sm text-muted-foreground">
                      Sin salidas registradas en {period.label.toLowerCase()}.
                    </p>
                  ) : (
                    <ul className="space-y-1.5">
                      {overview.expenseBreakdown.slice(0, 8).map((row) => (
                        <li
                          key={row.categoryName}
                          className="flex items-baseline justify-between gap-2 text-sm"
                        >
                          <span className="flex min-w-0 items-center gap-2">
                            <Badge
                              variant={
                                row.kind === "fixed" ? "secondary" : "outline"
                              }
                              className="shrink-0"
                            >
                              {EXPENSE_KIND_LABELS[row.kind]}
                            </Badge>
                            <span className="truncate">{row.categoryName}</span>
                          </span>
                          <span className="shrink-0 tabular-nums">
                            {formatCurrency(row.amountUsd, "USD")}
                          </span>
                        </li>
                      ))}
                    </ul>
                  )}
                </CardContent>
              </Card>
            </div>
          )}
        </>
      )}
    </>
  );
}
