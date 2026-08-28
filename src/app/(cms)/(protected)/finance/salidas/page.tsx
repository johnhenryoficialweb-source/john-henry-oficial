import Link from "next/link";
import { Suspense } from "react";
import { ArrowDownCircleIcon, PlusIcon, RepeatIcon, SettingsIcon } from "lucide-react";
import { getStaffSession } from "@/lib/auth/roles";
import { resolvePeriod } from "@/lib/finance/period";
import {
  getAssignableLocations,
  getExpenseCategories,
  getExpenses,
  getPendingFixedExpenses,
} from "@/lib/finance/expenses";
import { EXPENSE_KIND_LABELS, PAYMENT_METHOD_LABELS } from "@/lib/finance/labels";
import { formatCurrency } from "@/lib/currency/exchange";
import { Badge } from "@/components/ui/badge";
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
import { EmptyState } from "@/components/shared/empty-state";
import { ExportCsvButton } from "@/components/shared/export-csv-button";
import { PeriodFilter } from "@/components/finance/period-filter";
import { ExpenseFilters } from "@/components/finance/expense-filters";
import { ExpenseDeleteButton } from "@/components/finance/expense-delete-button";
import { GenerateFixedExpensesButton } from "@/components/finance/generate-fixed-expenses-button";
import type { ExpenseKind } from "@/types/database.types";

export default async function ExpensesPage({
  searchParams,
}: {
  searchParams: Promise<{
    periodo?: string;
    from?: string;
    to?: string;
    sede?: string;
    tipo?: string;
    categoria?: string;
  }>;
}) {
  const params = await searchParams;
  const period = resolvePeriod(params);
  const session = await getStaffSession();
  const isAdmin = session?.role === "admin";

  const kind = params.tipo === "fixed" || params.tipo === "sporadic" ? (params.tipo as ExpenseKind) : undefined;

  const [expenses, categories, locations, fixed] = await Promise.all([
    getExpenses({
      period,
      locationId: params.sede,
      categoryId: params.categoria,
      kind,
    }),
    getExpenseCategories(),
    getAssignableLocations(),
    getPendingFixedExpenses(),
  ]);

  const totalUsd = expenses.reduce((sum, row) => sum + row.amountUsd, 0);
  const fixedTotalUsd = expenses
    .filter((row) => row.kind === "fixed")
    .reduce((sum, row) => sum + row.amountUsd, 0);

  const totalsByCurrency = expenses.reduce<Record<string, number>>((acc, row) => {
    acc[row.currency] = (acc[row.currency] ?? 0) + row.amount;
    return acc;
  }, {});

  const pendingSummary = Object.entries(fixed.totalByCurrency)
    .map(([currency, amount]) => formatCurrency(amount, currency as "USD" | "COP"))
    .join(" + ");

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="font-heading text-2xl">Salidas de dinero</h1>
          <p className="text-sm text-muted-foreground">
            {period.label} · {expenses.length}{" "}
            {expenses.length === 1 ? "movimiento" : "movimientos"} ·{" "}
            {Object.entries(totalsByCurrency)
              .map(([currency, amount]) => formatCurrency(amount, currency as "USD" | "COP"))
              .join(" + ") || formatCurrency(0, "USD")}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button render={<Link href="/finance/salidas/tipos" />} size="sm" variant="outline">
            <SettingsIcon />
            Tipos y fijas
          </Button>
          <Button render={<Link href="/finance/salidas/nueva" />} size="sm">
            <PlusIcon />
            Registrar salida
          </Button>
        </div>
      </div>

      <Suspense fallback={<div className="h-8" />}>
        <PeriodFilter period={period} />
      </Suspense>

      {isAdmin && fixed.pending.length > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-accent/40 bg-accent/5 p-4">
          <div className="flex items-start gap-3">
            <RepeatIcon className="mt-0.5 size-4 shrink-0 text-accent" />
            <div>
              <p className="text-sm font-medium">
                Faltan {fixed.pending.length}{" "}
                {fixed.pending.length === 1 ? "salida fija" : "salidas fijas"} de este mes
              </p>
              <p className="text-xs text-muted-foreground">
                Se registrarán por {pendingSummary} con la fecha de pago de cada una.
              </p>
            </div>
          </div>
          <GenerateFixedExpensesButton count={fixed.pending.length} summary={pendingSummary} />
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-3">
        <Card size="sm">
          <CardContent className="space-y-1">
            <p className="text-xs text-muted-foreground">Total del periodo (USD)</p>
            <p className="text-2xl font-semibold tabular-nums text-destructive">
              {formatCurrency(totalUsd, "USD")}
            </p>
          </CardContent>
        </Card>
        <Card size="sm">
          <CardContent className="space-y-1">
            <p className="text-xs text-muted-foreground">Fijas</p>
            <p className="text-2xl font-semibold tabular-nums">{formatCurrency(fixedTotalUsd, "USD")}</p>
          </CardContent>
        </Card>
        <Card size="sm">
          <CardContent className="space-y-1">
            <p className="text-xs text-muted-foreground">Esporádicas</p>
            <p className="text-2xl font-semibold tabular-nums">
              {formatCurrency(totalUsd - fixedTotalUsd, "USD")}
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <Suspense fallback={<div className="h-8" />}>
          <ExpenseFilters
            categories={categories}
            locations={locations}
            active={{ sede: params.sede, tipo: params.tipo, categoria: params.categoria }}
          />
        </Suspense>
        <ExportCsvButton
          rows={expenses.map((row) => ({
            fecha: row.date,
            descripcion: row.description,
            tipo: EXPENSE_KIND_LABELS[row.kind],
            categoria: row.categoryName,
            sede: row.locationName,
            monto: row.amount,
            moneda: row.currency,
            monto_usd: row.amountUsd,
            medio: PAYMENT_METHOD_LABELS[row.method],
            proveedor: row.vendor ?? "",
            referencia: row.reference ?? "",
          }))}
          filename={`salidas-${period.from}-${period.to}.csv`}
        />
      </div>

      {expenses.length === 0 ? (
        <EmptyState
          icon={ArrowDownCircleIcon}
          title="Sin salidas en este periodo"
          description="Registra arriendos, nómina, compra de telas o cualquier gasto para que el resultado por sede refleje el dinero real. Las que se repiten cada mes se declaran una vez y el sistema las genera solo."
          action={{ href: "/finance/salidas/nueva", label: "Registrar la primera salida" }}
        />
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Fecha</TableHead>
              <TableHead>Descripción</TableHead>
              <TableHead>Tipo</TableHead>
              <TableHead>Sede</TableHead>
              <TableHead>Medio</TableHead>
              <TableHead className="text-right">Monto</TableHead>
              {isAdmin && <TableHead className="w-10" />}
            </TableRow>
          </TableHeader>
          <TableBody>
            {expenses.map((row) => (
              <TableRow key={row.id}>
                <TableCell className="whitespace-nowrap text-muted-foreground">
                  {new Date(`${row.date}T12:00:00`).toLocaleDateString("es-CO", {
                    day: "2-digit",
                    month: "short",
                  })}
                </TableCell>
                <TableCell>
                  <span className="font-medium">{row.description}</span>
                  {row.vendor && (
                    <span className="block text-xs text-muted-foreground">{row.vendor}</span>
                  )}
                </TableCell>
                <TableCell>
                  <span className="flex items-center gap-1.5">
                    <Badge variant={row.kind === "fixed" ? "secondary" : "outline"}>
                      {EXPENSE_KIND_LABELS[row.kind]}
                    </Badge>
                    <span className="text-muted-foreground">{row.categoryName}</span>
                    {row.isGenerated && (
                      <RepeatIcon className="size-3 text-muted-foreground" aria-label="Generada automáticamente" />
                    )}
                  </span>
                </TableCell>
                <TableCell className="text-muted-foreground">{row.locationName}</TableCell>
                <TableCell className="text-muted-foreground">
                  {PAYMENT_METHOD_LABELS[row.method]}
                </TableCell>
                <TableCell className="text-right font-medium tabular-nums">
                  {formatCurrency(row.amount, row.currency)}
                  {row.currency !== "USD" && (
                    <span className="block text-xs font-normal text-muted-foreground">
                      ≈ {formatCurrency(row.amountUsd, "USD")}
                    </span>
                  )}
                </TableCell>
                {isAdmin && (
                  <TableCell>
                    <ExpenseDeleteButton
                      expenseId={row.id}
                      description={row.description}
                      amountLabel={formatCurrency(row.amount, row.currency)}
                      isGenerated={row.isGenerated}
                    />
                  </TableCell>
                )}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </div>
  );
}
