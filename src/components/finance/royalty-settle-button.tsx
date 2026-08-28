"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { CheckIcon, Loader2Icon, RotateCcwIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { formatCurrency } from "@/lib/currency/exchange";
import {
  reopenRoyaltyPeriod,
  settleRoyaltyPeriod,
} from "@/app/(cms)/(protected)/finance/actions";
import type { CurrencyCode } from "@/types/database.types";

/**
 * Regla UX #10 (Contrast Effect): antes de marcar el giro se muestra la base
 * completa del cálculo — ventas del mes, porcentaje, monto y equivalente — para
 * que nadie confirme a ciegas un movimiento entre sedes.
 */
export function RoyaltySettleButton({
  periodKey,
  periodLabel,
  baseAmount,
  baseCurrency,
  percent,
  amount,
  amountUsd,
  baseLabel,
  sourceName,
  beneficiaryName,
}: {
  periodKey: string;
  periodLabel: string;
  baseAmount: number;
  baseCurrency: CurrencyCode;
  percent: number;
  amount: number;
  amountUsd: number;
  baseLabel: string;
  sourceName: string;
  beneficiaryName: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [reference, setReference] = useState("");
  const [isPending, startTransition] = useTransition();

  function handleSettle() {
    startTransition(async () => {
      try {
        await settleRoyaltyPeriod(periodKey, reference);
        toast.success(`Regalía de ${periodLabel} marcada como girada`);
        setOpen(false);
        router.refresh();
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "No se pudo liquidar el periodo.");
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={<Button type="button" size="sm" variant="secondary" disabled={amount <= 0} />}
      >
        <CheckIcon />
        Marcar girada
      </DialogTrigger>
      <DialogContent showCloseButton={!isPending}>
        <DialogHeader>
          <DialogTitle>Liquidar regalía de {periodLabel}</DialogTitle>
          <DialogDescription>
            Deja constancia del giro de {sourceName} a {beneficiaryName}.
          </DialogDescription>
        </DialogHeader>

        <dl className="space-y-2 rounded-lg border p-4 text-sm">
          <div className="flex justify-between gap-3">
            <dt className="text-muted-foreground">{baseLabel} del mes</dt>
            <dd className="tabular-nums">{formatCurrency(baseAmount, baseCurrency)}</dd>
          </div>
          <div className="flex justify-between gap-3">
            <dt className="text-muted-foreground">Porcentaje acordado</dt>
            <dd className="tabular-nums">{percent}%</dd>
          </div>
          <div className="flex justify-between gap-3 border-t pt-2 font-medium">
            <dt>Regalía a girar</dt>
            <dd className="tabular-nums text-accent">{formatCurrency(amount, baseCurrency)}</dd>
          </div>
          <div className="flex justify-between gap-3 text-xs text-muted-foreground">
            <dt>Equivalente consolidado</dt>
            <dd className="tabular-nums">{formatCurrency(amountUsd, "USD")}</dd>
          </div>
        </dl>

        <div className="space-y-2">
          <Label htmlFor="royalty-reference">Referencia del giro (opcional)</Label>
          <Input
            id="royalty-reference"
            value={reference}
            onChange={(event) => setReference(event.target.value)}
            placeholder="N.º de transferencia o comprobante"
          />
        </div>

        <p className="text-xs text-muted-foreground">
          El monto queda congelado con la base y la tasa de hoy. Si después cambia el porcentaje
          acordado, este periodo conserva el valor con el que se giró.
        </p>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => setOpen(false)} disabled={isPending}>
            Cancelar
          </Button>
          <Button type="button" onClick={handleSettle} disabled={isPending}>
            {isPending ? (
              <>
                <Loader2Icon className="size-4 animate-spin" />
                Liquidando…
              </>
            ) : (
              "Confirmar giro"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/** Deshace una liquidación mal registrada y devuelve el mes a pendiente. */
export function RoyaltyReopenButton({
  settlementId,
  periodLabel,
}: {
  settlementId: string;
  periodLabel: string;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  function handleClick() {
    startTransition(async () => {
      try {
        await reopenRoyaltyPeriod(settlementId);
        toast.success(`${periodLabel} vuelve a estar pendiente de giro`);
        router.refresh();
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "No se pudo reabrir el periodo.");
      }
    });
  }

  return (
    <Button
      type="button"
      size="sm"
      variant="ghost"
      onClick={handleClick}
      disabled={isPending}
      className="text-muted-foreground"
    >
      {isPending ? <Loader2Icon className="animate-spin" /> : <RotateCcwIcon />}
      Reabrir
    </Button>
  );
}
