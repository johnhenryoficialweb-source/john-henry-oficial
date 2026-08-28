"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useTransition } from "react";
import { XIcon } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { EXPENSE_KIND_LABELS, type ExpenseCategory } from "@/lib/finance/labels";

const ALL = "__all__";

/**
 * Filtros de la lista de salidas. Viven en la URL para que un filtro puesto
 * sea compartible y sobreviva a recargar la página (regla UX #13).
 */
export function ExpenseFilters({
  categories,
  locations,
  active,
}: {
  categories: ExpenseCategory[];
  locations: { id: string; name: string }[];
  active: { sede?: string; tipo?: string; categoria?: string };
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();

  function setParam(key: string, value: string) {
    const next = new URLSearchParams(searchParams.toString());
    if (!value || value === ALL) next.delete(key);
    else next.set(key, value);
    startTransition(() => router.push(`${pathname}?${next.toString()}`));
  }

  function clearAll() {
    const next = new URLSearchParams(searchParams.toString());
    for (const key of ["sede", "tipo", "categoria"]) next.delete(key);
    startTransition(() => router.push(`${pathname}?${next.toString()}`));
  }

  const hasFilters = Boolean(active.sede || active.tipo || active.categoria);

  return (
    <div className="flex flex-wrap items-center gap-2" data-pending={isPending || undefined}>
      <Select
        value={active.sede ?? ALL}
        onValueChange={(value) => setParam("sede", String(value))}
        items={[
          { value: ALL, label: "Todas las sedes" },
          ...locations.map((location) => ({ value: location.id, label: location.name })),
        ]}
      >
        <SelectTrigger className="w-[170px]">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={ALL}>Todas las sedes</SelectItem>
          {locations.map((location) => (
            <SelectItem key={location.id} value={location.id}>
              {location.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select
        value={active.tipo ?? ALL}
        onValueChange={(value) => setParam("tipo", String(value))}
        items={[
          { value: ALL, label: "Fijas y esporádicas" },
          { value: "fixed", label: `Solo ${EXPENSE_KIND_LABELS.fixed.toLowerCase()}s` },
          { value: "sporadic", label: `Solo ${EXPENSE_KIND_LABELS.sporadic.toLowerCase()}s` },
        ]}
      >
        <SelectTrigger className="w-[150px]">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={ALL}>Fijas y esporádicas</SelectItem>
          <SelectItem value="fixed">Solo {EXPENSE_KIND_LABELS.fixed.toLowerCase()}s</SelectItem>
          <SelectItem value="sporadic">
            Solo {EXPENSE_KIND_LABELS.sporadic.toLowerCase()}s
          </SelectItem>
        </SelectContent>
      </Select>

      <Select
        value={active.categoria ?? ALL}
        onValueChange={(value) => setParam("categoria", String(value))}
        items={[
          { value: ALL, label: "Todos los tipos" },
          ...categories.map((category) => ({ value: category.id, label: category.name })),
        ]}
      >
        <SelectTrigger className="w-[200px]">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={ALL}>Todos los tipos</SelectItem>
          {categories.map((category) => (
            <SelectItem key={category.id} value={category.id}>
              {category.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {hasFilters && (
        <Button type="button" variant="ghost" size="sm" onClick={clearAll}>
          <XIcon />
          Quitar filtros
        </Button>
      )}
    </div>
  );
}
