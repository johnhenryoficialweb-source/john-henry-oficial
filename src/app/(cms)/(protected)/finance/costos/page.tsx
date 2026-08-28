import { Suspense } from "react";
import { LayersIcon, TriangleAlertIcon } from "lucide-react";
import { getStaffSession } from "@/lib/auth/roles";
import { resolvePeriod } from "@/lib/finance/period";
import { getBaseCosts, getCostScopeOptions, getPieceMargins } from "@/lib/finance/costs";
import { formatCurrency } from "@/lib/currency/exchange";
import { GARMENT_TYPE_LABELS } from "@/lib/constants";
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
import { PeriodFilter } from "@/components/finance/period-filter";
import { BaseCostForm } from "@/components/finance/base-cost-form";
import { BaseCostDeleteButton } from "@/components/finance/base-cost-delete-button";

export default async function BaseCostsPage({
  searchParams,
}: {
  searchParams: Promise<{ periodo?: string; from?: string; to?: string }>;
}) {
  const params = await searchParams;
  const period = resolvePeriod(params);
  const session = await getStaffSession();
  const isAdmin = session?.role === "admin";

  const [costs, margins, scope] = await Promise.all([
    getBaseCosts(),
    getPieceMargins(period),
    getCostScopeOptions(),
  ]);

  const totalRevenue = margins.reduce((sum, row) => sum + row.revenueUsd, 0);
  const totalCost = margins.reduce((sum, row) => sum + row.costUsd, 0);
  const totalMargin = totalRevenue - totalCost;
  const marginPercent = totalRevenue > 0 ? Math.round((totalMargin / totalRevenue) * 1000) / 10 : null;
  const unitsWithoutCost = margins.reduce((sum, row) => sum + row.unitsWithoutCost, 0);
  const unitsWithoutPrice = margins.reduce((sum, row) => sum + row.unitsWithoutPrice, 0);
  const unitsSold = margins.reduce((sum, row) => sum + row.unitsSold, 0);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-heading text-2xl">Costos base por pieza</h1>
        <p className="text-sm text-muted-foreground">
          Lo que cuesta producir cada prenda. Se congela en la orden al crearla, así que subir la
          tarifa no reescribe el margen del pasado.
        </p>
      </div>

      <Suspense fallback={<div className="h-8" />}>
        <PeriodFilter period={period} />
      </Suspense>

      {/* Regla UX #4: el valor primero — el margen del periodo antes del formulario. */}
      <div className="grid gap-4 sm:grid-cols-3">
        <Card size="sm">
          <CardContent className="space-y-1">
            <p className="text-xs text-muted-foreground">Vendido en el periodo (USD)</p>
            <p className="text-2xl font-semibold tabular-nums">{formatCurrency(totalRevenue, "USD")}</p>
            <p className="text-xs text-muted-foreground">{unitsSold} piezas</p>
          </CardContent>
        </Card>
        <Card size="sm">
          <CardContent className="space-y-1">
            <p className="text-xs text-muted-foreground">Costo base de producción</p>
            <p className="text-2xl font-semibold tabular-nums text-destructive">
              {formatCurrency(totalCost, "USD")}
            </p>
          </CardContent>
        </Card>
        <Card size="sm">
          <CardContent className="space-y-1">
            <p className="text-xs text-muted-foreground">Margen bruto</p>
            <p className="text-2xl font-semibold tabular-nums text-accent">
              {formatCurrency(totalMargin, "USD")}
            </p>
            <p className="text-xs text-muted-foreground">
              {marginPercent === null ? "sin ventas" : `${marginPercent}% del precio de venta`}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Dos huecos distintos con dos consecuencias distintas: sin precio no
          hay margen que medir; sin costo el margen que se muestra está inflado.
          Confundirlos haría que el usuario persiga el problema equivocado. */}
      {(unitsWithoutPrice > 0 || unitsWithoutCost > 0) && (
        <div className="flex items-start gap-3 rounded-lg border border-dashed p-4">
          <TriangleAlertIcon className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
          <div className="space-y-1.5 text-sm text-muted-foreground">
            {unitsWithoutPrice > 0 && (
              <p className="max-w-prose">
                <span className="text-foreground">
                  {unitsWithoutPrice === unitsSold
                    ? `Las ${unitsSold} piezas`
                    : `${unitsWithoutPrice} de ${unitsSold} piezas`}
                </span>{" "}
                del periodo no tienen precio de venta registrado — el histórico importado llegó sin
                valores. Mientras siga así no hay margen que medir, por mucho costo base que cargues.
              </p>
            )}
            {unitsWithoutCost > 0 && unitsWithoutPrice < unitsSold && (
              <p className="max-w-prose">
                <span className="text-foreground">
                  {unitsWithoutCost} de {unitsSold} piezas
                </span>{" "}
                se registraron sin costo base, así que el margen de arriba está inflado en esa
                proporción. Carga el costo del tipo de prenda y las órdenes nuevas ya lo tomarán
                solas.
              </p>
            )}
          </div>
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Margen por tipo de prenda</CardTitle>
          <CardDescription>{period.label}, consolidado en USD.</CardDescription>
        </CardHeader>
        <CardContent>
          {margins.length === 0 ? (
            <EmptyState
              icon={LayersIcon}
              title="Sin piezas vendidas en este periodo"
              description="Cambia el periodo para ver otro mes, o carga los costos base abajo para que las órdenes nuevas midan su margen desde el primer día."
              action={{ href: "/orders/nueva", label: "Crear una orden" }}
            />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Prenda</TableHead>
                  <TableHead className="text-right">Piezas</TableHead>
                  <TableHead className="text-right">Vendido</TableHead>
                  <TableHead className="text-right">Costo</TableHead>
                  <TableHead className="text-right">Margen</TableHead>
                  <TableHead className="text-right">%</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {margins.map((row) => (
                  <TableRow key={row.garmentType}>
                    <TableCell className="font-medium">
                      {GARMENT_TYPE_LABELS[row.garmentType]}
                      {row.unitsWithoutPrice > 0 ? (
                        <Badge variant="outline" className="ml-2">
                          {row.unitsWithoutPrice} sin precio
                        </Badge>
                      ) : row.unitsWithoutCost > 0 ? (
                        <Badge variant="outline" className="ml-2">
                          {row.unitsWithoutCost} sin costo
                        </Badge>
                      ) : null}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">{row.unitsSold}</TableCell>
                    <TableCell className="text-right tabular-nums">
                      {formatCurrency(row.revenueUsd, "USD")}
                    </TableCell>
                    <TableCell className="text-right tabular-nums text-destructive">
                      {formatCurrency(row.costUsd, "USD")}
                    </TableCell>
                    <TableCell className="text-right font-medium tabular-nums">
                      {formatCurrency(row.marginUsd, "USD")}
                    </TableCell>
                    <TableCell className="text-right tabular-nums text-muted-foreground">
                      {row.marginPercent === null ? "—" : `${row.marginPercent}%`}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Costos cargados</CardTitle>
          <CardDescription>
            Del alcance más específico al más general: modelo + sede gana sobre modelo, que gana
            sobre tipo + sede, que gana sobre el costo general.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {costs.length === 0 ? (
            <EmptyState
              icon={LayersIcon}
              title="Sin costos base cargados"
              description="Empieza por el costo general de cada tipo de prenda; después afina por modelo o por sede solo donde la diferencia importe."
              action={{ href: "#cargar-costo", label: "Cargar el primero" }}
            />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Prenda</TableHead>
                  <TableHead>Alcance</TableHead>
                  <TableHead className="text-right">Tela</TableHead>
                  <TableHead className="text-right">Mano de obra</TableHead>
                  <TableHead className="text-right">Indirectos</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                  {isAdmin && <TableHead className="w-10" />}
                </TableRow>
              </TableHeader>
              <TableBody>
                {costs.map((cost) => (
                  <TableRow key={cost.id} className={cost.isActive ? "" : "opacity-50"}>
                    <TableCell className="font-medium">
                      {GARMENT_TYPE_LABELS[cost.garmentType]}
                    </TableCell>
                    <TableCell className="text-muted-foreground">{cost.scopeLabel}</TableCell>
                    <TableCell className="text-right tabular-nums">
                      {formatCurrency(cost.fabricCost, cost.currency)}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {formatCurrency(cost.laborCost, cost.currency)}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {formatCurrency(cost.overheadCost, cost.currency)}
                    </TableCell>
                    <TableCell className="text-right font-medium tabular-nums">
                      {formatCurrency(cost.totalCost, cost.currency)}
                    </TableCell>
                    {isAdmin && (
                      <TableCell>
                        <BaseCostDeleteButton
                          costId={cost.id}
                          scopeLabel={`${GARMENT_TYPE_LABELS[cost.garmentType]} · ${cost.scopeLabel}`}
                          amountLabel={formatCurrency(cost.totalCost, cost.currency)}
                        />
                      </TableCell>
                    )}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {isAdmin && (
        <Card id="cargar-costo">
          <CardHeader>
            <CardTitle>Cargar o actualizar un costo base</CardTitle>
            <CardDescription>
              Aplica a las piezas que se registren de aquí en adelante.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <BaseCostForm
              models={scope.models}
              locations={scope.locations}
              existing={costs.map((cost) => ({
                garmentType: cost.garmentType,
                garmentModelId: cost.garmentModelId,
                locationId: cost.locationId,
                currency: cost.currency,
                fabricCost: cost.fabricCost,
                laborCost: cost.laborCost,
                overheadCost: cost.overheadCost,
              }))}
            />
          </CardContent>
        </Card>
      )}
    </div>
  );
}
