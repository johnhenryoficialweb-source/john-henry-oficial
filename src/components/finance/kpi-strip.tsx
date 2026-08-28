import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

export interface KpiItem {
  label: string;
  value: string;
  hint?: string;
  icon?: LucideIcon;
  href?: string;
  tone?: "default" | "out" | "accent";
}

/**
 * Regla UX #4: la primera fila de la pantalla ya responde "¿cómo vamos?" sin
 * pedir un solo clic.
 */
export function KpiStrip({ items }: { items: KpiItem[] }) {
  return (
    /* auto-fit en vez de un número fijo de columnas: la tira se usa con cinco
       y con seis indicadores, y una rejilla fija dejaría media fila vacía. */
    <div className="grid grid-cols-2 gap-px overflow-hidden rounded-xl bg-border ring-1 ring-foreground/10 sm:grid-cols-3 lg:[grid-template-columns:repeat(auto-fit,minmax(9.5rem,1fr))]">
      {items.map((item) => {
        const body = (
          <div className="flex h-full flex-col gap-1 bg-card p-4">
            <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
              {item.icon && <item.icon className="size-3.5" />}
              {item.label}
            </p>
            <p
              className={cn(
                "text-xl font-semibold tabular-nums",
                item.tone === "out" && "text-destructive",
                item.tone === "accent" && "text-accent",
              )}
            >
              {item.value}
            </p>
            {item.hint && <p className="text-xs text-muted-foreground">{item.hint}</p>}
          </div>
        );

        return item.href ? (
          <Link key={item.label} href={item.href} className="transition-opacity hover:opacity-80">
            {body}
          </Link>
        ) : (
          <div key={item.label}>{body}</div>
        );
      })}
    </div>
  );
}
