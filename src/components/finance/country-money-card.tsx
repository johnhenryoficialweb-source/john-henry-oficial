import Link from "next/link";
import { ArrowDownRightIcon, ArrowUpRightIcon, MinusIcon } from "lucide-react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatCurrency } from "@/lib/currency/exchange";
import { cn } from "@/lib/utils";
import type { LocationFinance } from "@/lib/finance/overview";

function Line({
  label,
  value,
  hint,
  tone = "neutral",
  href,
}: {
  label: string;
  value: string;
  hint?: string;
  tone?: "neutral" | "out" | "muted";
  href?: string;
}) {
  const content = (
    <>
      <span className="flex min-w-0 items-baseline gap-1.5">
        <span className={cn("truncate", tone === "muted" ? "text-muted-foreground" : "")}>{label}</span>
        {hint && <span className="shrink-0 text-xs text-muted-foreground">{hint}</span>}
      </span>
      <span
        className={cn(
          "shrink-0 font-medium tabular-nums",
          tone === "out" && "text-destructive",
          tone === "muted" && "text-muted-foreground",
        )}
      >
        {value}
      </span>
    </>
  );

  if (href) {
    return (
      <Link
        href={href}
        className="flex items-baseline justify-between gap-3 rounded-sm py-1 text-sm transition-colors hover:text-accent"
      >
        {content}
      </Link>
    );
  }

  return <div className="flex items-baseline justify-between gap-3 py-1 text-sm">{content}</div>;
}

/**
 * Contador de dinero de una sede. Se lee de arriba abajo como un estado de
 * resultados corto: qué entró, qué costó producirlo, qué salió, qué se giró
 * por regalía y qué queda.
 */
export function CountryMoneyCard({
  finance,
  periodQuery,
}: {
  finance: LocationFinance;
  periodQuery: string;
}) {
  const { currency } = finance;
  const money = (value: number) => formatCurrency(value, currency);
  const isPositive = finance.net >= 0;

  // Una sede sin nada que reportar no necesita siete filas en cero: eso es
  // ruido con forma de informe. Se dice en una línea y se sigue.
  const isDormant =
    finance.orderCount === 0 &&
    finance.expenseCount === 0 &&
    finance.billed === 0 &&
    finance.outstanding === 0;

  if (isDormant) {
    return (
      <Card className="self-start">
        <CardContent className="flex flex-wrap items-baseline justify-between gap-2">
          <p className="flex items-baseline gap-2">
            <span className="font-institutional text-xs tracking-[0.18em] text-muted-foreground">
              {finance.code}
            </span>
            <span className="font-heading text-base">{finance.name}</span>
          </p>
          <p className="text-sm text-muted-foreground">Sin movimiento en el periodo</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="overflow-visible">
      <CardHeader className="gap-2">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="flex items-baseline gap-2 font-heading text-base">
              <span className="shrink-0 font-institutional text-xs tracking-[0.18em] text-muted-foreground">
                {finance.code}
              </span>
              <span className="truncate">{finance.name}</span>
            </p>
            <p className="text-xs text-muted-foreground">
              {finance.country} · {finance.orderCount}{" "}
              {finance.orderCount === 1 ? "orden" : "órdenes"} en el periodo
            </p>
          </div>
          <Badge variant="outline" className="shrink-0 font-mono">
            {currency}
          </Badge>
        </div>

        <div className="flex items-baseline gap-2 pt-1">
          <span
            className={cn(
              "text-3xl font-semibold tabular-nums",
              isPositive ? "text-accent" : "text-destructive",
            )}
          >
            {money(finance.net)}
          </span>
          <span className="flex items-center gap-0.5 text-xs text-muted-foreground">
            {finance.net === 0 ? (
              <MinusIcon className="size-3" />
            ) : isPositive ? (
              <ArrowUpRightIcon className="size-3 text-accent" />
            ) : (
              <ArrowDownRightIcon className="size-3 text-destructive" />
            )}
            resultado neto
          </span>
        </div>
      </CardHeader>

      <CardContent className="divide-y divide-border/60">
        <div className="pb-1">
          <Line label="Facturado" value={money(finance.billed)} />
          <Line
            label="Cobrado"
            value={money(finance.collected)}
            href={`/finance/payments${periodQuery}`}
          />
          {finance.fees > 0 && (
            <Line
              label="Comisiones de cobro"
              value={`− ${money(finance.fees)}`}
              hint={`${finance.feeCount} ${finance.feeCount === 1 ? "cobro" : "cobros"}`}
              tone="out"
              href={`/finance/payments${periodQuery}`}
            />
          )}
          <Line
            label="Por cobrar"
            value={money(finance.outstanding)}
            hint="acumulado"
            tone="muted"
            href={`/finance/cobrar${periodQuery}`}
          />
        </div>

        <div className="py-1">
          <Line
            label="Costo base de piezas"
            value={`− ${money(finance.cogs)}`}
            tone="out"
            href={`/finance/costos${periodQuery}`}
          />
          <Line
            label="Salidas de dinero"
            value={`− ${money(finance.expenses)}`}
            hint={`${finance.expenseCount} mov.`}
            tone="out"
            href={`/finance/salidas${periodQuery}&sede=${finance.locationId}`}
          />
          <div className="flex items-baseline justify-between gap-3 pl-3 text-xs text-muted-foreground">
            <span>Fijas · Esporádicas</span>
            <span className="tabular-nums">
              {money(finance.expensesFixed)} · {money(finance.expensesSporadic)}
            </span>
          </div>
        </div>

        {(finance.isRoyaltySource || finance.isRoyaltyBeneficiary) && (
          <div className="py-1">
            {finance.isRoyaltySource && (
              <Line
                label="Regalía a casa matriz"
                value={`− ${money(finance.royaltyOut)}`}
                tone="out"
                href="/finance/royalties"
              />
            )}
            {finance.isRoyaltyBeneficiary && (
              <Line
                label="Regalía recibida"
                value={`+ ${money(finance.royaltyIn)}`}
                href="/finance/royalties"
              />
            )}
          </div>
        )}

        <div className="flex items-baseline justify-between gap-3 pt-2 text-xs text-muted-foreground">
          <span>Equivalente consolidado</span>
          <span className="tabular-nums">{formatCurrency(finance.usd.net, "USD")} USD</span>
        </div>
      </CardContent>
    </Card>
  );
}
