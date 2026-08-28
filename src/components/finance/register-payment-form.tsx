"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { CheckIcon, Loader2Icon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import {
  channelFee,
  channelFeeLabel,
  fallbackMethodOf,
  isFallbackChannel,
  resolveChannels,
  type PaymentChannelOption,
} from "@/lib/finance/labels";
import { formatCurrency } from "@/lib/currency/exchange";
import { parseAmount } from "@/lib/currency/parse";
import type { CurrencyCode } from "@/types/database.types";

/**
 * Registrar un cobro, diciendo por dónde entró.
 *
 * El medio no es un dato administrativo: de él sale la comisión. Por eso el
 * formulario muestra el neto mientras se escribe — cobrar un millón por
 * datáfono y ver que entran 965.000 es información que cambia decisiones, y
 * enterarse a fin de mes es tarde.
 */
export function RegisterPaymentForm({
  channels,
  currency,
  balance,
  onSubmit,
}: {
  channels: PaymentChannelOption[];
  currency: CurrencyCode;
  balance: number;
  onSubmit: (formData: FormData) => Promise<void>;
}) {
  const [isPending, startTransition] = useTransition();
  // Smart default: lo normal es que el cliente salde lo que debe.
  const [amountRaw, setAmountRaw] = useState(balance > 0 ? String(balance) : "");
  /*
   * La fecha arranca en hoy porque el caso normal es cobrar hoy, pero tiene que
   * poder moverse: al digitalizar el histórico, un cobro de hace tres meses
   * estampado con la fecha de digitación mueve la plata de mes y rompe el
   * estudio financiero, que es justamente para lo que se está cargando.
   */
  const today = new Date().toISOString().slice(0, 10);
  const [paidAt, setPaidAt] = useState(today);
  // Sin canales configurados se ofrecen los medios base: la pregunta nunca
  // puede quedarse sin opciones, o el cobro se guarda como efectivo por omisión.
  const payChannels = resolveChannels(channels);
  const usingFallback = channels.length === 0;
  const [channelId, setChannelId] = useState(payChannels[0]?.id ?? "");

  // Un cobro de "1.500.000" no puede leerse como cero: ver parseAmount.
  const amount = parseAmount(amountRaw);
  const channel = payChannels.find((option) => option.id === channelId) ?? null;
  const fee = channel ? channelFee(channel, amount) : 0;
  const isFallbackSelection = Boolean(channelId) && isFallbackChannel(channelId);

  function submit(formData: FormData) {
    startTransition(async () => {
      try {
        await onSubmit(formData);
        setAmountRaw("");
        toast.success(`Pago de ${formatCurrency(amount, currency)} registrado`);
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "No se pudo registrar el pago.");
      }
    });
  }

  return (
    <form action={submit} className="space-y-3">
      <input
        type="hidden"
        name="channelId"
        value={isFallbackSelection ? "" : channelId}
      />
      <input
        type="hidden"
        name="method"
        value={isFallbackSelection ? fallbackMethodOf(channelId) : ""}
      />

      <div className="space-y-1">
        <Label htmlFor="amount">Monto ({currency})</Label>
        <Input
          id="amount"
          name="amount"
          inputMode="decimal"
          value={amountRaw}
          onChange={(event) => setAmountRaw(event.target.value)}
          required
        />
        {balance > 0 && amount !== balance ? (
          <button
            type="button"
            onClick={() => setAmountRaw(String(balance))}
            className="text-xs text-muted-foreground underline underline-offset-4 hover:text-foreground"
          >
            Saldar lo que debe: {formatCurrency(balance, currency)}
          </button>
        ) : null}
      </div>

      <div className="space-y-1.5">
        <Label>Medio de cobro</Label>
        <div className="flex flex-wrap gap-1.5">
          {payChannels.map((option) => (
            <button
              key={option.id}
              type="button"
              onClick={() => setChannelId(option.id)}
              aria-pressed={channelId === option.id}
              className={cn(
                "rounded-full border px-3 py-1 text-xs font-medium transition-colors",
                channelId === option.id
                  ? "border-accent bg-accent text-accent-foreground"
                  : "border-border text-muted-foreground hover:border-accent/40 hover:text-foreground"
              )}
            >
              {option.name}
              {option.feePercent > 0 || option.feeFixed > 0 ? (
                <span className="opacity-70"> · {channelFeeLabel(option)}</span>
              ) : null}
            </button>
          ))}
        </div>
        {usingFallback ? (
          <p className="text-xs text-muted-foreground">
            Sin comisión configurada. Para descontar lo que retiene el datáfono, define su
            porcentaje en Ajustes → Medios de cobro.
          </p>
        ) : null}
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1">
          <Label htmlFor="paidAt">Fecha del pago</Label>
          <Input
            id="paidAt"
            name="paidAt"
            type="date"
            max={today}
            value={paidAt}
            onChange={(event) => setPaidAt(event.target.value)}
            required
          />
          {paidAt !== today ? (
            <button
              type="button"
              onClick={() => setPaidAt(today)}
              className="text-xs text-muted-foreground underline underline-offset-4 hover:text-foreground"
            >
              Volver a hoy
            </button>
          ) : null}
        </div>

        <div className="space-y-1">
          <Label htmlFor="reference">Referencia (opcional)</Label>
          <Input id="reference" name="reference" />
        </div>
      </div>

      {/*
        El desglose de la transacción, no solo el total.

        Cobrar por datáfono no es cobrar: el adquirente se queda con su parte
        antes de que la plata llegue. Verlo mientras se escribe —bruto, cuánto
        se fue, cuánto entra— evita la sorpresa de fin de mes y deja claro lo
        que no es negociable: el saldo del cliente baja por el bruto, no por el
        neto, porque el cliente sí pagó completo.
      */}
      {fee > 0 ? (
        <dl className="space-y-1 rounded-lg bg-muted/40 px-3 py-2 text-xs">
          <div className="flex justify-between gap-3">
            <dt className="text-muted-foreground">Cobrado al cliente</dt>
            <dd className="tabular-nums">{formatCurrency(amount, currency)}</dd>
          </div>
          <div className="flex justify-between gap-3">
            <dt className="text-muted-foreground">
              Se lleva {channel?.name}
              {channel ? <span className="opacity-70"> · {channelFeeLabel(channel)}</span> : null}
            </dt>
            <dd className="tabular-nums text-destructive">− {formatCurrency(fee, currency)}</dd>
          </div>
          <div className="flex justify-between gap-3 border-t pt-1 font-medium">
            <dt>Entra a caja</dt>
            <dd className="tabular-nums">{formatCurrency(amount - fee, currency)}</dd>
          </div>
          <p className="pt-1 text-muted-foreground">
            El saldo del cliente baja {formatCurrency(amount, currency)}: pagó completo, la
            comisión la asume el negocio.
          </p>
        </dl>
      ) : null}

      <Button type="submit" className="w-full" disabled={isPending || amount <= 0}>
        {isPending ? <Loader2Icon className="animate-spin" /> : <CheckIcon />}
        Registrar pago
      </Button>
    </form>
  );
}
