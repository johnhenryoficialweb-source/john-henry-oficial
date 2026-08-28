"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useState, useTransition } from "react";
import { CalendarRangeIcon, Loader2Icon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { PERIOD_PRESETS, PERIOD_PRESET_LABELS, type Period } from "@/lib/finance/period";

/**
 * Selector de periodo compartido. Los presets cubren el 95% de los casos con
 * un clic (regla UX #2) y el rango manual queda escondido detrás de un enlace
 * hasta que alguien lo necesita (regla UX #5: revelación progresiva).
 */
export function PeriodFilter({ period }: { period: Period }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();
  const [showCustom, setShowCustom] = useState(period.preset === "personalizado");
  const [from, setFrom] = useState(period.from);
  const [to, setTo] = useState(period.to);

  function navigate(next: URLSearchParams) {
    const query = next.toString();
    startTransition(() => {
      router.push(query ? `${pathname}?${query}` : pathname);
    });
  }

  function selectPreset(preset: string) {
    const next = new URLSearchParams(searchParams.toString());
    next.set("periodo", preset);
    next.delete("from");
    next.delete("to");
    setShowCustom(false);
    navigate(next);
  }

  function applyCustom() {
    const next = new URLSearchParams(searchParams.toString());
    next.set("from", from);
    next.set("to", to);
    next.delete("periodo");
    navigate(next);
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-1.5">
        {PERIOD_PRESETS.map((preset) => (
          <button
            key={preset}
            type="button"
            onClick={() => selectPreset(preset)}
            disabled={isPending}
            className={cn(
              "focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 outline-none rounded-full border px-3 py-1 text-xs transition-colors disabled:opacity-60",
              period.preset === preset
                ? "border-accent bg-accent text-accent-foreground"
                : "border-border text-muted-foreground hover:border-accent/40 hover:text-foreground",
            )}
          >
            {PERIOD_PRESET_LABELS[preset]}
          </button>
        ))}

        <button
          type="button"
          onClick={() => setShowCustom((value) => !value)}
          className={cn(
            "focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 outline-none flex items-center gap-1 rounded-full border px-3 py-1 text-xs transition-colors",
            period.preset === "personalizado"
              ? "border-accent bg-accent text-accent-foreground"
              : "border-border text-muted-foreground hover:border-accent/40 hover:text-foreground",
          )}
        >
          <CalendarRangeIcon className="size-3" />
          {PERIOD_PRESET_LABELS.personalizado}
        </button>

        {isPending && <Loader2Icon className="size-3.5 animate-spin text-muted-foreground" />}
      </div>

      {showCustom && (
        <div className="flex flex-wrap items-end gap-2 rounded-lg border p-3">
          <div className="space-y-1">
            <label htmlFor="period-from" className="text-xs text-muted-foreground">
              Desde
            </label>
            <Input
              id="period-from"
              type="date"
              value={from}
              max={to}
              onChange={(event) => setFrom(event.target.value)}
              className="h-8"
            />
          </div>
          <div className="space-y-1">
            <label htmlFor="period-to" className="text-xs text-muted-foreground">
              Hasta
            </label>
            <Input
              id="period-to"
              type="date"
              value={to}
              min={from}
              onChange={(event) => setTo(event.target.value)}
              className="h-8"
            />
          </div>
          <Button type="button" size="sm" variant="secondary" onClick={applyCustom} disabled={isPending}>
            Aplicar
          </Button>
        </div>
      )}
    </div>
  );
}
