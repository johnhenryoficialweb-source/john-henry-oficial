"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { CheckIcon, Loader2Icon, PlusIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { PAYMENT_METHOD_LABELS, type PaymentChannelOption } from "@/lib/finance/labels";
import { formatCurrency } from "@/lib/currency/exchange";
import {
  createPaymentChannel,
  togglePaymentChannel,
  updatePaymentChannelFee,
} from "@/app/(cms)/(protected)/settings/actions";
import type { CurrencyCode, PaymentMethod } from "@/types/database.types";

const METHODS: PaymentMethod[] = ["card", "other", "transfer", "cash"];

/** Cobro de ejemplo con el que se muestra el efecto de la comisión. */
const SAMPLE_BY_CURRENCY: Record<CurrencyCode, number> = {
  COP: 1_000_000,
  USD: 500,
};

export interface ChannelLocationOption {
  id: string;
  name: string;
  currency: CurrencyCode;
}

/**
 * Configuración de la comisión de cada medio de cobro.
 *
 * La fila muestra, mientras se escribe, cuánto se quedaría el intermediario en
 * un cobro típico: un "3,5" abstracto no dice nada, "de $1.000.000 te llegan
 * $965.000" sí. Guardar solo se ofrece cuando algo cambió.
 */
export function PaymentChannelEditor({
  channels,
  locations,
  sampleCurrency = "COP",
}: {
  channels: PaymentChannelOption[];
  locations: ChannelLocationOption[];
  sampleCurrency?: CurrencyCode;
}) {
  return (
    <div className="space-y-3">
      {channels.map((channel) => (
        <ChannelRow
          key={channel.id}
          channel={channel}
          locationName={
            locations.find((location) => location.id === channel.locationId)?.name ?? null
          }
          sampleCurrency={sampleCurrency}
        />
      ))}
      <NewChannelForm locations={locations} />
    </div>
  );
}

function ChannelRow({
  channel,
  locationName,
  sampleCurrency,
}: {
  channel: PaymentChannelOption;
  locationName: string | null;
  sampleCurrency: CurrencyCode;
}) {
  const [isPending, startTransition] = useTransition();
  const [percent, setPercent] = useState(String(channel.feePercent));
  const [fixed, setFixed] = useState(String(channel.feeFixed));

  const parsedPercent = Number(percent.replace(",", ".")) || 0;
  const parsedFixed = Number(fixed.replace(",", ".")) || 0;
  const dirty =
    parsedPercent !== channel.feePercent || parsedFixed !== channel.feeFixed;

  const sample = SAMPLE_BY_CURRENCY[sampleCurrency];
  const fee = Math.min((sample * parsedPercent) / 100 + parsedFixed, sample);

  function save(formData: FormData) {
    startTransition(async () => {
      try {
        await updatePaymentChannelFee(formData);
        toast.success(`${channel.name}: comisión actualizada`);
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "No se pudo guardar.");
      }
    });
  }

  function toggle() {
    startTransition(async () => {
      await togglePaymentChannel(channel.id, !channel.isActive);
      toast.success(channel.isActive ? `${channel.name} desactivado` : `${channel.name} activado`);
    });
  }

  return (
    <form
      action={save}
      className={cn(
        "rounded-lg border border-border p-3",
        !channel.isActive && "opacity-60"
      )}
    >
      <input type="hidden" name="id" value={channel.id} />

      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="flex flex-wrap items-center gap-2 text-sm font-medium">
            {channel.name}
            <Badge variant="outline">{PAYMENT_METHOD_LABELS[channel.method]}</Badge>
            {locationName ? <Badge variant="secondary">{locationName}</Badge> : null}
            {!channel.isActive ? <Badge variant="outline">Inactivo</Badge> : null}
          </p>
          {channel.notes ? (
            <p className="mt-0.5 text-xs text-muted-foreground">{channel.notes}</p>
          ) : null}
        </div>

        <button
          type="button"
          onClick={toggle}
          disabled={isPending}
          className="text-xs text-muted-foreground underline underline-offset-4 hover:text-foreground"
        >
          {channel.isActive ? "Desactivar" : "Activar"}
        </button>
      </div>

      <div className="mt-3 flex flex-wrap items-end gap-3">
        <div className="w-24 space-y-1">
          <Label htmlFor={`percent-${channel.id}`}>Comisión %</Label>
          <Input
            id={`percent-${channel.id}`}
            name="feePercent"
            inputMode="decimal"
            value={percent}
            onChange={(event) => setPercent(event.target.value)}
          />
        </div>
        <div className="w-28 space-y-1">
          <Label htmlFor={`fixed-${channel.id}`}>Fijo por cobro</Label>
          <Input
            id={`fixed-${channel.id}`}
            name="feeFixed"
            inputMode="decimal"
            value={fixed}
            onChange={(event) => setFixed(event.target.value)}
          />
        </div>

        <p className="flex-1 text-xs text-muted-foreground">
          {fee > 0 ? (
            <>
              De un cobro de {formatCurrency(sample, sampleCurrency)} te quedan{" "}
              <span className="font-medium text-foreground tabular-nums">
                {formatCurrency(sample - fee, sampleCurrency)}
              </span>{" "}
              — {formatCurrency(fee, sampleCurrency)} se los lleva el intermediario.
            </>
          ) : (
            "Sin comisión: lo cobrado entra completo."
          )}
        </p>

        {dirty ? (
          <Button type="submit" size="sm" disabled={isPending}>
            {isPending ? <Loader2Icon className="animate-spin" /> : <CheckIcon />}
            Guardar
          </Button>
        ) : null}
      </div>
    </form>
  );
}

function NewChannelForm({ locations }: { locations: ChannelLocationOption[] }) {
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();

  function create(formData: FormData) {
    startTransition(async () => {
      try {
        await createPaymentChannel(formData);
        toast.success("Medio de cobro agregado");
        setOpen(false);
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "No se pudo agregar.");
      }
    });
  }

  // Progressive disclosure: agregar un canal es lo raro; lo normal es ajustar
  // el porcentaje de los que ya existen.
  if (!open) {
    return (
      <Button variant="outline" size="sm" onClick={() => setOpen(true)}>
        <PlusIcon />
        Agregar otro medio de cobro
      </Button>
    );
  }

  return (
    <form action={create} className="space-y-3 rounded-lg border border-dashed p-3">
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1">
          <Label htmlFor="channel-name">Nombre</Label>
          <Input id="channel-name" name="name" placeholder="Datáfono Bold" required />
        </div>
        <div className="space-y-1">
          <Label htmlFor="channel-method">Tipo</Label>
          <select
            id="channel-method"
            name="method"
            defaultValue="card"
            className="h-8 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm"
          >
            {METHODS.map((method) => (
              <option key={method} value={method}>
                {PAYMENT_METHOD_LABELS[method]}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-1">
          <Label htmlFor="channel-percent">Comisión %</Label>
          <Input id="channel-percent" name="feePercent" inputMode="decimal" defaultValue="0" />
        </div>
        <div className="space-y-1">
          <Label htmlFor="channel-fixed">Fijo por cobro</Label>
          <Input id="channel-fixed" name="feeFixed" inputMode="decimal" defaultValue="0" />
        </div>
        <div className="space-y-1 sm:col-span-2">
          <Label htmlFor="channel-location">Sede</Label>
          <select
            id="channel-location"
            name="locationId"
            defaultValue=""
            className="h-8 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm"
          >
            <option value="">Todas las sedes</option>
            {locations.map((location) => (
              <option key={location.id} value={location.id}>
                {location.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="flex justify-end gap-2">
        <Button type="button" variant="ghost" size="sm" onClick={() => setOpen(false)}>
          Cancelar
        </Button>
        <Button type="submit" size="sm" disabled={isPending}>
          {isPending ? <Loader2Icon className="animate-spin" /> : <PlusIcon />}
          Agregar
        </Button>
      </div>
    </form>
  );
}
