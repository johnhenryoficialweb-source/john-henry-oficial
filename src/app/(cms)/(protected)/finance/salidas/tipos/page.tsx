import Link from "next/link";
import { ArrowLeftIcon, CheckCircle2Icon, ClockIcon, RepeatIcon } from "lucide-react";
import { requireStaffSession } from "@/lib/auth/roles";
import {
  getAssignableLocations,
  getExpenseCategories,
  getPendingFixedExpenses,
  getRecurringExpenses,
} from "@/lib/finance/expenses";
import {
  EXPENSE_KIND_DESCRIPTIONS,
  EXPENSE_KIND_LABELS,
  PAYMENT_METHOD_LABELS,
} from "@/lib/finance/labels";
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
import {
  ExpenseCategoryForm,
  RecurringExpenseForm,
} from "@/components/finance/recurring-expense-form";
import { ToggleActiveButton } from "@/components/finance/toggle-active-button";
import { GenerateFixedExpensesButton } from "@/components/finance/generate-fixed-expenses-button";
import type { ExpenseKind } from "@/types/database.types";

export default async function ExpenseTypesPage() {
  const session = await requireStaffSession();
  const isAdmin = session.role === "admin";

  const [categories, recurring, locations, fixed] = await Promise.all([
    getExpenseCategories(true),
    getRecurringExpenses(),
    getAssignableLocations(),
    getPendingFixedExpenses(),
  ]);

  const defaultLocationId =
    locations.find((location) => location.id === session.locationId)?.id ?? locations[0]?.id ?? "";

  const activeCategories = categories.filter((category) => category.isActive);
  const byKind = (kind: ExpenseKind) => categories.filter((category) => category.kind === kind);

  const pendingSummary = Object.entries(fixed.totalByCurrency)
    .map(([currency, amount]) => formatCurrency(amount, currency as "USD" | "COP"))
    .join(" + ");

  const monthlyCommitment = recurring
    .filter((template) => template.isActive)
    .reduce<Record<string, number>>((acc, template) => {
      acc[template.currency] = (acc[template.currency] ?? 0) + template.amount;
      return acc;
    }, {});

  return (
    <div className="space-y-8">
      <Link
        href="/finance/salidas"
        className="flex w-fit items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeftIcon className="size-4" />
        Volver a salidas
      </Link>

      <div>
        <h1 className="font-heading text-2xl">Tipos de salida y salidas fijas</h1>
        <p className="text-sm text-muted-foreground">
          El catálogo con el que se clasifica cada egreso, y los compromisos mensuales que el
          sistema registra por ti.
        </p>
      </div>

      {/* Salidas fijas ---------------------------------------------------- */}
      <section className="space-y-4">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="flex items-center gap-2 font-heading text-lg">
              <RepeatIcon className="size-4 text-accent" />
              Salidas fijas
            </h2>
            <p className="text-sm text-muted-foreground">
              Compromiso mensual:{" "}
              {Object.entries(monthlyCommitment)
                .map(([currency, amount]) => formatCurrency(amount, currency as "USD" | "COP"))
                .join(" + ") || "sin salidas fijas declaradas"}
              .
            </p>
          </div>
          {isAdmin && fixed.pending.length > 0 && (
            <GenerateFixedExpensesButton
              count={fixed.pending.length}
              summary={pendingSummary}
              variant="secondary"
            />
          )}
        </div>

        {recurring.length === 0 ? (
          <EmptyState
            icon={RepeatIcon}
            title="Sin salidas fijas declaradas"
            description="Arriendo, nómina, servicios, seguros: decláralos una vez acá y cada mes se registran con un clic en vez de teclearlos de nuevo."
            action={{ href: "#nueva-fija", label: "Declarar la primera" }}
          />
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Descripción</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead>Sede</TableHead>
                <TableHead>Día</TableHead>
                <TableHead>Medio</TableHead>
                <TableHead className="text-right">Monto</TableHead>
                <TableHead>Este mes</TableHead>
                {isAdmin && <TableHead className="w-24" />}
              </TableRow>
            </TableHeader>
            <TableBody>
              {recurring.map((template) => (
                <TableRow key={template.id} className={template.isActive ? "" : "opacity-50"}>
                  <TableCell className="font-medium">
                    {template.description}
                    {template.vendor && (
                      <span className="block text-xs text-muted-foreground">{template.vendor}</span>
                    )}
                  </TableCell>
                  <TableCell className="text-muted-foreground">{template.categoryName}</TableCell>
                  <TableCell className="text-muted-foreground">{template.locationName}</TableCell>
                  <TableCell className="tabular-nums text-muted-foreground">
                    {template.dayOfMonth}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {PAYMENT_METHOD_LABELS[template.method]}
                  </TableCell>
                  <TableCell className="text-right font-medium tabular-nums">
                    {formatCurrency(template.amount, template.currency)}
                  </TableCell>
                  <TableCell>
                    {!template.isActive ? (
                      <Badge variant="outline">Inactiva</Badge>
                    ) : template.postedThisMonth ? (
                      <span className="flex items-center gap-1 text-xs text-accent">
                        <CheckCircle2Icon className="size-3.5" />
                        Registrada
                      </span>
                    ) : (
                      <span className="flex items-center gap-1 text-xs text-muted-foreground">
                        <ClockIcon className="size-3.5" />
                        Pendiente
                      </span>
                    )}
                  </TableCell>
                  {isAdmin && (
                    <TableCell>
                      <ToggleActiveButton
                        entity="recurring"
                        id={template.id}
                        isActive={template.isActive}
                        label={template.description}
                      />
                    </TableCell>
                  )}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}

        {isAdmin && (
          <Card id="nueva-fija">
            <CardHeader>
              <CardTitle>Declarar una salida fija</CardTitle>
              <CardDescription>
                Cada mes aparecerá lista para registrar en un clic, con su fecha y su monto.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <RecurringExpenseForm
                categories={activeCategories}
                locations={locations}
                defaultLocationId={defaultLocationId}
              />
            </CardContent>
          </Card>
        )}
      </section>

      {/* Catálogo de tipos ------------------------------------------------ */}
      <section className="space-y-4">
        <div>
          <h2 className="font-heading text-lg">Catálogo de tipos</h2>
          <p className="text-sm text-muted-foreground">
            Clasificar cada salida es lo que permite separar el costo estructural del gasto puntual
            en el panel.
          </p>
        </div>

        <div className="grid gap-4 lg:grid-cols-2">
          {(["fixed", "sporadic"] as ExpenseKind[]).map((kind) => (
            <Card key={kind}>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Badge variant={kind === "fixed" ? "secondary" : "outline"}>
                    {EXPENSE_KIND_LABELS[kind]}
                  </Badge>
                  {byKind(kind).length} tipos
                </CardTitle>
                <CardDescription>{EXPENSE_KIND_DESCRIPTIONS[kind]}</CardDescription>
              </CardHeader>
              <CardContent>
                <ul className="divide-y divide-border/60">
                  {byKind(kind).map((category) => (
                    <li
                      key={category.id}
                      className={`flex items-center justify-between gap-3 py-2 text-sm ${
                        category.isActive ? "" : "opacity-50"
                      }`}
                    >
                      <div className="min-w-0">
                        <p className="truncate">{category.name}</p>
                        {category.description && (
                          <p className="truncate text-xs text-muted-foreground">
                            {category.description}
                          </p>
                        )}
                      </div>
                      {isAdmin && (
                        <ToggleActiveButton
                          entity="category"
                          id={category.id}
                          isActive={category.isActive}
                          label={category.name}
                        />
                      )}
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          ))}
        </div>

        {isAdmin && (
          <Card>
            <CardHeader>
              <CardTitle>Agregar un tipo propio</CardTitle>
              <CardDescription>
                Solo si ninguno de los {categories.length} existentes describe bien la salida.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ExpenseCategoryForm />
            </CardContent>
          </Card>
        )}
      </section>
    </div>
  );
}
