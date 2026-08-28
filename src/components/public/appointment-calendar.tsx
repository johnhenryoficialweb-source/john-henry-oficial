"use client";

import { useEffect, useState } from "react";
import { ChevronLeftIcon, ChevronRightIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import type { LocationCode } from "@/config/locations";

const WEEKDAY_LABELS = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];
const MONTH_LABELS = [
  "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
  "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre",
];

function pad(n: number) {
  return String(n).padStart(2, "0");
}

function dateStr(year: number, month: number, day: number) {
  return `${year}-${pad(month)}-${pad(day)}`;
}

/** Calendario mensual con disponibilidad real: los días sin cupo quedan deshabilitados. */
export function AppointmentCalendar({
  locationCode,
  selectedDate,
  onSelectDate,
}: {
  locationCode: LocationCode;
  selectedDate: string | null;
  onSelectDate: (date: string) => void;
}) {
  const today = new Date();
  const todayStr = dateStr(today.getFullYear(), today.getMonth() + 1, today.getDate());
  const [viewYear, setViewYear] = useState(today.getFullYear());
  const [viewMonth, setViewMonth] = useState(today.getMonth() + 1);
  const [availableDates, setAvailableDates] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    // Sincroniza el estado de carga con el fetch de disponibilidad que arranca
    // justo debajo; no es un anti-patrón de derivar estado desde props.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLoading(true);
    fetch(`/api/availability/month?location=${locationCode}&year=${viewYear}&month=${viewMonth}`)
      .then((res) => res.json())
      .then((data) => {
        if (!cancelled) setAvailableDates(new Set<string>(data.availableDates ?? []));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [locationCode, viewYear, viewMonth]);

  const isCurrentMonth = viewYear === today.getFullYear() && viewMonth === today.getMonth() + 1;
  /**
   * Un mes entero en gris es indistinguible de un calendario roto. Cuando no
   * hay ningún cupo hay que decirlo y ofrecer la salida (mes siguiente),
   * nunca dejar la rejilla muda.
   */
  const noAvailability = !loading && availableDates.size === 0;
  const firstOfMonth = new Date(Date.UTC(viewYear, viewMonth - 1, 1));
  const mondayFirstOffset = (firstOfMonth.getUTCDay() + 6) % 7;
  const daysInMonth = new Date(Date.UTC(viewYear, viewMonth, 0)).getUTCDate();

  function goPrevMonth() {
    if (isCurrentMonth) return;
    if (viewMonth === 1) {
      setViewYear((y) => y - 1);
      setViewMonth(12);
    } else {
      setViewMonth((m) => m - 1);
    }
  }
  function goNextMonth() {
    if (viewMonth === 12) {
      setViewYear((y) => y + 1);
      setViewMonth(1);
    } else {
      setViewMonth((m) => m + 1);
    }
  }

  return (
    <div>
      <div className="mb-3 flex items-center justify-between">
        <button
          type="button"
          onClick={goPrevMonth}
          disabled={isCurrentMonth}
          aria-label="Mes anterior"
          className="rounded-full p-1.5 text-foreground/60 transition-colors hover:bg-[var(--jh-gold)]/10 hover:text-foreground disabled:pointer-events-none disabled:opacity-30"
        >
          <ChevronLeftIcon className="size-4" />
        </button>
        <span className="font-heading text-sm tracking-wide">
          {MONTH_LABELS[viewMonth - 1]} {viewYear}
        </span>
        <button
          type="button"
          onClick={goNextMonth}
          aria-label="Mes siguiente"
          className="rounded-full p-1.5 text-foreground/60 transition-colors hover:bg-[var(--jh-gold)]/10 hover:text-foreground"
        >
          <ChevronRightIcon className="size-4" />
        </button>
      </div>

      <div className="grid grid-cols-7 gap-1">
        {WEEKDAY_LABELS.map((w) => (
          <div key={w} className="pb-1 text-center text-[10px] tracking-wide text-foreground/40 uppercase">
            {w}
          </div>
        ))}
        {Array.from({ length: mondayFirstOffset }).map((_, i) => (
          <div key={`empty-${i}`} />
        ))}
        {Array.from({ length: daysInMonth }, (_, i) => i + 1).map((day) => {
          const d = dateStr(viewYear, viewMonth, day);
          const isPast = d < todayStr;
          const isToday = d === todayStr;
          const hasSlots = availableDates.has(d);
          const disabled = isPast || !hasSlots;
          const selected = d === selectedDate;

          return (
            <button
              key={d}
              type="button"
              disabled={disabled || loading}
              onClick={() => onSelectDate(d)}
              className={cn(
                "aspect-square rounded-lg text-sm transition-colors",
                selected
                  ? "bg-accent font-medium text-accent-foreground"
                  : disabled
                    ? "cursor-not-allowed text-foreground/20"
                    : "text-foreground hover:bg-accent/15",
                isToday && !selected && "ring-1 ring-accent/50"
              )}
            >
              {day}
            </button>
          );
        })}
      </div>

      {loading && (
        <p className="mt-4 text-center text-xs text-foreground/40">Consultando disponibilidad…</p>
      )}

      {noAvailability && (
        <div className="mt-4 border-t border-[var(--jh-gold-mid)]/20 pt-4 text-center">
          <p className="text-sm text-foreground/60">
            No queda agenda en {MONTH_LABELS[viewMonth - 1].toLowerCase()}.
          </p>
          <button
            type="button"
            onClick={goNextMonth}
            className="mt-2 font-institutional text-[10px] tracking-[0.28em] text-[var(--jh-gold)] uppercase transition-colors duration-500 hover:text-[var(--jh-ivory)]"
          >
            Ver {MONTH_LABELS[viewMonth === 12 ? 0 : viewMonth].toLowerCase()}
          </button>
        </div>
      )}
    </div>
  );
}
