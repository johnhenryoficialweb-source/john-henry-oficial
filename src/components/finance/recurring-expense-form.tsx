"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2Icon, PlusIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { formatCurrency } from "@/lib/currency/exchange";
import {
  createExpenseCategory,
  createRecurringExpense,
} from "@/app/(cms)/(protected)/finance/actions";
import {
  EXPENSE_KIND_DESCRIPTIONS,
  EXPENSE_KIND_LABELS,
  PAYMENT_METHOD_LABELS,
  type ExpenseCategory,
} from "@/lib/finance/labels";
import { cn } from "@/lib/utils";
import type { CurrencyCode, ExpenseKind, PaymentMethod } from "@/types/database.types";

const METHODS: PaymentMethod[] = ["transfer", "cash", "card", "other"];

/** Alta de una salida fija: se declara una vez y se repite todos los meses. */
export function RecurringExpenseForm({
  categories,
  locations,
  defaultLocationId,
}: {
  categories: ExpenseCategory[];
  locations: { id: string; name: string; currency: CurrencyCode }[];
  defaultLocationId: string;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [locationId, setLocationId] = useState(defaultLocationId);
  const [categoryId, setCategoryId] = useState(categories[0]?.id ?? "");
  const [amount, setAmount] = useState("");
  const [dayOfMonth, setDayOfMonth] = useState("1");

  const currency = locations.find((l) => l.id === locationId)?.currency ?? "USD";
  const numericAmount = Number(amount.replace(/[^\d.,-]/g, "").replace(",", ".")) || 0;

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const formData = new FormData(form);
    formData.set("locationId", locationId);
    formData.set("categoryId", categoryId);
    formData.set("dayOfMonth", dayOfMonth);

    startTransition(async () => {
      try {
        await createRecurringExpense(formData);
        toast.success(
          `Salida fija creada · ${formatCurrency(numericAmount, currency)} cada día ${dayOfMonth}`,
        );
        form.reset();
        setAmount("");
        router.refresh();
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "No se pudo crear la salida fija.");
      }
    });
  }

  return (
    <form onSubmit={handleSubmit} className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      <div className="space-y-2 sm:col-span-2 lg:col-span-1">
        <Label htmlFor="recurring-description">Descripción</Label>
        <Input
          id="recurring-description"
          name="description"
          required
          placeholder="Arriendo local Bogotá"
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="recurring-category">Tipo de salida</Label>
        <Select
          value={categoryId}
          onValueChange={(value) => setCategoryId(String(value))}
          items={categories.map((category) => ({ value: category.id, label: category.name }))}
        >
          <SelectTrigger id="recurring-category" className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {categories.map((category) => (
              <SelectItem key={category.id} value={category.id}>
                {category.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        <Label htmlFor="recurring-location">Sede</Label>
        <Select
          value={locationId}
          onValueChange={(value) => setLocationId(String(value))}
          items={locations.map((location) => ({
            value: location.id,
            label: `${location.name} (${location.currency})`,
          }))}
        >
          <SelectTrigger id="recurring-location" className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {locations.map((location) => (
              <SelectItem key={location.id} value={location.id}>
                {location.name} ({location.currency})
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        <Label htmlFor="recurring-amount">Monto mensual ({currency})</Label>
        <Input
          id="recurring-amount"
          name="amount"
          inputMode="decimal"
          required
          placeholder="0"
          value={amount}
          onChange={(event) => setAmount(event.target.value)}
          className="tabular-nums"
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="recurring-day">Día de pago</Label>
        <Input
          id="recurring-day"
          type="number"
          min={1}
          max={28}
          required
          value={dayOfMonth}
          onChange={(event) => setDayOfMonth(event.target.value)}
        />
        <p className="text-xs text-muted-foreground">Del 1 al 28, para que exista en todos los meses.</p>
      </div>

      <div className="space-y-2">
        <Label htmlFor="recurring-method">Medio de pago</Label>
        <Select
          name="method"
          defaultValue="transfer"
          items={METHODS.map((option) => ({ value: option, label: PAYMENT_METHOD_LABELS[option] }))}
        >
          <SelectTrigger id="recurring-method" className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {METHODS.map((option) => (
              <SelectItem key={option} value={option}>
                {PAYMENT_METHOD_LABELS[option]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="flex items-end sm:col-span-2 lg:col-span-3">
        <Button type="submit" disabled={isPending || numericAmount <= 0}>
          {isPending ? <Loader2Icon className="animate-spin" /> : <PlusIcon />}
          Crear salida fija
        </Button>
      </div>
    </form>
  );
}

/** Alta de un tipo de salida propio, cuando el catálogo base no alcanza. */
export function ExpenseCategoryForm() {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [kind, setKind] = useState<ExpenseKind>("sporadic");

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const formData = new FormData(form);
    formData.set("kind", kind);

    startTransition(async () => {
      try {
        await createExpenseCategory(formData);
        toast.success("Tipo de salida creado");
        form.reset();
        router.refresh();
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "No se pudo crear el tipo.");
      }
    });
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-wrap items-end gap-3">
      <div className="min-w-[200px] flex-1 space-y-2">
        <Label htmlFor="category-name">Nombre</Label>
        <Input id="category-name" name="name" required placeholder="Ej. Alquiler de maquinaria" />
      </div>

      <div className="space-y-2">
        <Label>Naturaleza</Label>
        <div className="flex gap-1.5">
          {(["fixed", "sporadic"] as ExpenseKind[]).map((option) => (
            <button
              key={option}
              type="button"
              onClick={() => setKind(option)}
              title={EXPENSE_KIND_DESCRIPTIONS[option]}
              className={cn(
                "focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 outline-none h-8 rounded-full border px-3 text-xs transition-colors",
                kind === option
                  ? "border-accent bg-accent text-accent-foreground"
                  : "border-border text-muted-foreground hover:border-accent/40 hover:text-foreground",
              )}
            >
              {EXPENSE_KIND_LABELS[option]}
            </button>
          ))}
        </div>
      </div>

      <Button type="submit" variant="secondary" disabled={isPending}>
        {isPending ? <Loader2Icon className="animate-spin" /> : <PlusIcon />}
        Agregar tipo
      </Button>
    </form>
  );
}
