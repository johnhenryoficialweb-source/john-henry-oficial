import Link from "next/link";
import { Suspense } from "react";
import { PlusIcon } from "lucide-react";
import { getStaffSession } from "@/lib/auth/roles";
import { resolvePeriod } from "@/lib/finance/period";
import { getFinanceOverview } from "@/lib/finance/overview";
import { getPendingFixedExpenses } from "@/lib/finance/expenses";
import { formatCurrency } from "@/lib/currency/exchange";
import { Button } from "@/components/ui/button";
import { PeriodFilter } from "@/components/finance/period-filter";
import { FinancePanel } from "@/components/finance/finance-panel";

export default async function FinancePanelPage({
  searchParams,
}: {
  searchParams: Promise<{ periodo?: string; from?: string; to?: string }>;
}) {
  const params = await searchParams;
  const period = resolvePeriod(params);
  const session = await getStaffSession();

  const [overview, fixed] = await Promise.all([
    getFinanceOverview(period),
    getPendingFixedExpenses(),
  ]);

  const periodQuery = `?periodo=${period.preset}${
    period.preset === "personalizado" ? `&from=${period.from}&to=${period.to}` : ""
  }`;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="font-heading text-2xl">Panel financiero</h1>
          <p className="text-sm text-muted-foreground">
            {period.label} · entradas, salidas y regalía por sede.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button render={<Link href="/finance/salidas/nueva" />} size="sm">
            <PlusIcon />
            Registrar salida
          </Button>
        </div>
      </div>

      <Suspense fallback={<div className="h-8" />}>
        <PeriodFilter period={period} />
      </Suspense>

      <FinancePanel
        overview={overview}
        period={period}
        periodQuery={periodQuery}
        isAdmin={session?.role === "admin"}
        pendingFixed={{
          count: fixed.pending.length,
          descriptions: fixed.pending.map((item) => item.description),
          total: Object.entries(fixed.totalByCurrency)
            .map(([currency, amount]) => formatCurrency(amount, currency as "USD" | "COP"))
            .join(" + "),
        }}
      />
    </div>
  );
}
