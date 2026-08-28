import Link from "next/link";
import { TrophyIcon, UserPlusIcon } from "lucide-react";
import { getAdvisorSales } from "@/lib/finance/advisors";
import { resolvePeriod } from "@/lib/finance/period";
import { formatCurrency } from "@/lib/currency/exchange";
import { PeriodFilter } from "@/components/finance/period-filter";
import { ExportCsvButton } from "@/components/shared/export-csv-button";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { CurrencyCode } from "@/types/database.types";

export const dynamic = "force-dynamic";

/**
 * Competencia sana entre asesores: quién vendió cuánto en el periodo.
 *
 * Vive en Finanzas y no en el Dashboard a propósito. El Dashboard responde
 * "¿cómo va la empresa?" y lo mira cualquiera; esto responde "¿cómo voy yo
 * contra el resto?", que es una lectura de plata y con un efecto distinto —
 * mueve comportamiento. Mezclarlas convierte el resumen de la operación en un
 * tablero de competencia.
 */
export default async function AdvisorSalesPage({
  searchParams,
}: {
  searchParams: Promise<{ periodo?: string; from?: string; to?: string }>;
}) {
  const params = await searchParams;
  const period = resolvePeriod(params);
  const report = await getAdvisorSales({ fromIso: period.fromIso, toIso: period.toIso });

  const ranked = report.rows.filter((row) => row.staffId !== null);
  const unassigned = report.rows.find((row) => row.staffId === null) ?? null;
  const leader = ranked[0] ?? null;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-heading text-2xl">Vendido por asesor</h1>
          <p className="text-sm text-muted-foreground">
            {period.label} · {report.totalOrders} órdenes atendidas
          </p>
        </div>
        <ExportCsvButton
          rows={report.rows.map((row) => ({
            asesor: row.fullName,
            sede: row.locationName ?? "",
            ordenes: row.orderCount,
            vendido_usd: row.soldUsd,
            ordenes_sin_valor: row.unpricedOrders,
          }))}
          filename={`vendido-por-asesor-${period.from}-a-${period.to}.csv`}
        />
      </div>

      <PeriodFilter period={period} />

      {/*
        Regla UX #4: primero el valor, después la tabla. Quién va de primero y
        cuánto lleva el equipo es la respuesta que se viene a buscar.
      */}
      <div className="grid gap-3 sm:grid-cols-3">
        <Card>
          <CardContent className="py-4">
            <p className="text-xs text-muted-foreground">Vendido en el periodo</p>
            <p className="font-heading text-2xl tabular-nums">
              {formatCurrency(report.totalUsd, "USD")}
            </p>
            <p className="text-xs text-muted-foreground">consolidado en USD</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="py-4">
            <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <TrophyIcon className="size-3.5" />
              Va de primero
            </p>
            <p className="font-heading truncate text-2xl">{leader?.fullName ?? "—"}</p>
            <p className="text-xs text-muted-foreground">
              {leader
                ? `${formatCurrency(leader.soldUsd, "USD")} · ${leader.orderCount} órdenes`
                : "Nadie tiene órdenes asignadas todavía"}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="py-4">
            <p className="text-xs text-muted-foreground">Asesores con venta</p>
            <p className="font-heading text-2xl tabular-nums">{ranked.length}</p>
            <p className="text-xs text-muted-foreground">
              {report.unassignedOrders > 0
                ? `${report.unassignedOrders} órdenes sin asesor`
                : "todas las órdenes tienen asesor"}
            </p>
          </CardContent>
        </Card>
      </div>

      {/*
        Regla UX #10: el contexto antes de leer el ranking. Con mil órdenes
        importadas sin precio ni asesor, una tabla sin esta advertencia se lee
        como "el equipo no vendió nada" en vez de "faltan datos por cargar".
      */}
      {(report.unassignedOrders > 0 || report.unpricedOrders > 0) && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-dashed p-4">
          <div className="min-w-0">
            <p className="text-sm font-medium">El ranking todavía no está completo</p>
            <p className="text-xs text-muted-foreground">
              {report.unassignedOrders > 0 && (
                <>
                  {report.unassignedOrders} órdenes del periodo no tienen asesor asignado
                  {report.unpricedOrders > 0 ? " y " : "."}
                </>
              )}
              {report.unpricedOrders > 0 && (
                <>{report.unpricedOrders} no tienen valor cargado, así que suman cero.</>
              )}{" "}
              Ambas cosas se corrigen desde cada orden.
            </p>
          </div>
          <Button variant="outline" render={<Link href="/orders?total_max=0" />}>
            <UserPlusIcon />
            Ver órdenes por completar
          </Button>
        </div>
      )}

      <div className="rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-10">#</TableHead>
              <TableHead>Asesor</TableHead>
              <TableHead>Sede</TableHead>
              <TableHead className="text-right">Órdenes</TableHead>
              <TableHead className="text-right">Vendido</TableHead>
              <TableHead className="text-right">Participación</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {report.rows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="py-8 text-center text-muted-foreground">
                  No hay órdenes en {period.label.toLowerCase()}.
                </TableCell>
              </TableRow>
            ) : (
              report.rows.map((row, index) => {
                const share = report.totalUsd > 0 ? (row.soldUsd / report.totalUsd) * 100 : 0;
                const isUnassigned = row.staffId === null;

                return (
                  <TableRow key={row.staffId ?? "unassigned"} className={isUnassigned ? "opacity-70" : ""}>
                    <TableCell className="tabular-nums text-muted-foreground">
                      {isUnassigned ? "—" : index + 1}
                    </TableCell>
                    <TableCell className="font-medium">
                      {row.fullName}
                      {row.unpricedOrders > 0 ? (
                        <span className="ml-1.5 text-xs font-normal text-muted-foreground">
                          ({row.unpricedOrders} sin valor)
                        </span>
                      ) : null}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {row.locationName ?? "—"}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">{row.orderCount}</TableCell>
                    <TableCell className="text-right tabular-nums">
                      {formatCurrency(row.soldUsd, "USD")}
                      {Object.keys(row.soldByCurrency).length > 0 ? (
                        <span className="block text-xs text-muted-foreground">
                          {Object.entries(row.soldByCurrency)
                            .map(([currency, amount]) =>
                              formatCurrency(amount ?? 0, currency as CurrencyCode)
                            )
                            .join(" · ")}
                        </span>
                      ) : null}
                    </TableCell>
                    <TableCell className="text-right tabular-nums text-muted-foreground">
                      {share.toFixed(1)}%
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>

      {unassigned ? (
        <p className="text-xs text-muted-foreground">
          Las {unassigned.orderCount} órdenes sin asesor no se reparten entre el equipo: se
          muestran aparte para que el total del ranking siga cuadrando con el facturado.
        </p>
      ) : null}
    </div>
  );
}
