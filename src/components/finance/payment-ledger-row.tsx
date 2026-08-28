"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { CheckIcon, Loader2Icon, PencilIcon, XIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatCurrency } from "@/lib/currency/exchange";
import type { CurrencyCode } from "@/types/database.types";

export interface PaymentLedgerEntry {
  id: string;
  paidAt: string;
  channelName: string | null;
  amount: number;
  feeAmount: number;
  feePercent: number;
  netAmount: number;
  currency: CurrencyCode;
  reference: string | null;
}

/**
 * Una transacción del historial de cobros, con lo que se llevó el intermediario.
 *
 * El desglose se muestra por transacción y no solo sumado al pie porque la
 * comisión no es una constante del negocio: depende del medio con el que se
 * cobró ese día, y ese porcentaje quedó congelado en el pago. Ver "de estos
 * 100.000 entraron 95.000" al lado del cobro es lo que convierte la comisión en
 * un dato que se puede auditar contra el extracto del banco, en vez de un
 * agregado que hay que creer.
 */
export function PaymentLedgerRow({
  payment,
  canEditDate,
  onUpdateDate,
}: {
  payment: PaymentLedgerEntry;
  canEditDate: boolean;
  onUpdateDate: (formData: FormData) => Promise<void>;
}) {
  const [isEditing, setIsEditing] = useState(false);
  const [isPending, startTransition] = useTransition();

  const dateKey = payment.paidAt.slice(0, 10);
  const today = new Date().toISOString().slice(0, 10);

  function submit(formData: FormData) {
    startTransition(async () => {
      try {
        await onUpdateDate(formData);
        toast.success("Fecha del pago actualizada");
        setIsEditing(false);
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "No se pudo cambiar la fecha.");
      }
    });
  }

  return (
    <div className="border-t py-2 first:border-t-0">
      <div className="flex items-baseline justify-between gap-3">
        <div className="flex min-w-0 items-center gap-1.5">
          {isEditing ? (
            <form action={submit} className="flex items-center gap-1.5">
              <Input
                name="paidAt"
                type="date"
                defaultValue={dateKey}
                max={today}
                required
                className="h-7 w-36 text-xs"
              />
              <Button type="submit" size="icon-sm" variant="ghost" disabled={isPending}>
                {isPending ? (
                  <Loader2Icon className="size-3.5 animate-spin" />
                ) : (
                  <CheckIcon className="size-3.5" />
                )}
              </Button>
              <Button
                type="button"
                size="icon-sm"
                variant="ghost"
                onClick={() => setIsEditing(false)}
                disabled={isPending}
              >
                <XIcon className="size-3.5" />
              </Button>
            </form>
          ) : (
            <>
              <span className="truncate text-sm text-muted-foreground">
                {new Date(payment.paidAt).toLocaleDateString("es-CO")}
                {payment.channelName ? ` · ${payment.channelName}` : ""}
                {payment.reference ? ` · ${payment.reference}` : ""}
              </span>
              {canEditDate ? (
                <button
                  type="button"
                  onClick={() => setIsEditing(true)}
                  aria-label="Cambiar la fecha de este pago"
                  className="text-muted-foreground hover:text-foreground"
                >
                  <PencilIcon className="size-3" />
                </button>
              ) : null}
            </>
          )}
        </div>

        <span className="shrink-0 text-sm tabular-nums">
          {formatCurrency(payment.amount, payment.currency)}
        </span>
      </div>

      {payment.feeAmount > 0 ? (
        <div className="mt-0.5 flex justify-between gap-3 pl-0 text-xs text-muted-foreground">
          <span>
            Se fue en {payment.channelName ?? "la comisión"}
            {payment.feePercent > 0 ? ` (${payment.feePercent}%)` : ""}
          </span>
          <span className="shrink-0 tabular-nums">
            − {formatCurrency(payment.feeAmount, payment.currency)} · entró{" "}
            {formatCurrency(payment.netAmount, payment.currency)}
          </span>
        </div>
      ) : null}
    </div>
  );
}
