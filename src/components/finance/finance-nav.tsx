"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { cn } from "@/lib/utils";

/**
 * Regla UX #7 y #14: las siete pantallas de finanzas comparten una sola barra
 * de navegación, siempre visible, para que nunca haya duda de dónde se está
 * ni de qué más hay. El periodo seleccionado viaja entre pestañas — cambiar de
 * vista no debe obligar a volver a elegir el mes.
 */
const FINANCE_TABS = [
  { href: "/finance", label: "Panel" },
  { href: "/finance/salidas", label: "Salidas" },
  { href: "/finance/cobrar", label: "Por cobrar" },
  { href: "/finance/payments", label: "Pagos" },
  { href: "/finance/costos", label: "Costos base" },
  { href: "/finance/royalties", label: "Regalía" },
  { href: "/finance/asesores", label: "Asesores" },
  { href: "/finance/reportes", label: "Reportes" },
];

const PERIOD_KEYS = ["periodo", "from", "to"];

export function FinanceNav() {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const carried = new URLSearchParams();
  for (const key of PERIOD_KEYS) {
    const value = searchParams.get(key);
    if (value) carried.set(key, value);
  }
  const suffix = carried.toString() ? `?${carried.toString()}` : "";

  return (
    <nav className="flex flex-wrap items-center gap-1 border-b pb-px print:hidden">
      {FINANCE_TABS.map((tab) => {
        const isActive =
          tab.href === "/finance"
            ? pathname === "/finance"
            : pathname === tab.href || pathname.startsWith(`${tab.href}/`);

        return (
          <Link
            key={tab.href}
            href={`${tab.href}${suffix}`}
            aria-current={isActive ? "page" : undefined}
            className={cn(
              "relative -mb-px border-b-2 px-3 py-2 text-sm transition-colors",
              isActive
                ? "border-accent font-medium text-foreground"
                : "border-transparent text-muted-foreground hover:text-foreground",
            )}
          >
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}
