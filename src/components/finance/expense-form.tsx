"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ChevronDownIcon, Loader2Icon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { formatCurrency } from "@/lib/currency/exchange";
import { createExpense } from "@/app/(cms)/(protected)/finance/actions";
import {
  EXPENSE_KIND_LABELS,
  PAYMENT_METHOD_LABELS,
  type ExpenseCategory,
} from "@/lib/finance/labels";
import type { CurrencyCode, PaymentMethod } from "@/types/database.types";

interface LocationOption {
  id: string;
  code: string;
  name: string;
  currency: CurrencyCode;
}

const METHODS: PaymentMethod[] = ["cash", "transfer", "card", "other"];

/**
 * Registro de una salida de dinero.
 *
 * Reglas UX aplicadas: fecha de hoy y sede del usuario ya puestas (#1); tipo de
 * salida en un clic sobre chips en vez de un desplegable (#13); método de pago
 * que se ajusta solo al tipo elegido (#2); proveedor/referencia/notas ocultos
 * hasta que hagan falta (#5); y un resumen que se arma en vivo mientras se
 * escribe (#6), incluido el equivalente consolidado en USD.
 */
export function ExpenseForm({
  categories,
  locations,
  defaultLocationId,
  exchangeRate,
}: {
  categories: ExpenseCategory[];
  locations: LocationOption[];
  defaultLocationId: string;
  exchangeRate: number;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const [locationId, setLocationId] = useState(defaultLocationId);
  const [categoryId, setCategoryId] = useState<string>("");
  const [amount, setAmount] = useState("");
  const [description, setDescription] = useState("");
  const [expenseDate, setExpenseDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [method, setMethod] = useState<PaymentMethod>("cash");
  const [methodTouched, setMethodTouched] = useState(false);
  const [showDetails, setShowDetails] = useState(false);

  const location = locations.find((l) => l.id === locationId) ?? locations[0];
  const currency: CurrencyCode = location?.currency ?? "USD";
  const category = categories.find((c) => c.id === categoryId) ?? null;

  const fixed = useMemo(() => categories.filter((c) => c.kind === "fixed"), [categories]);
  const sporadic = useMemo(() => categories.filter((c) => c.kind === "sporadic"), [categories]);

  const numericAmount = Number(amount.replace(/[^\d.,-]/g, "").replace(",", ".")) || 0;
  const amountUsd = currency === "USD" ? numericAmount : numericAmount / exchangeRate;
  const canSubmit = numericAmount > 0 && description.trim().length > 0 && Boolean(locationId);

  function selectCategory(next: ExpenseCategory) {
    setCategoryId(next.id === categoryId ? "" : next.id);
    // Las salidas fijas casi siempre se giran por transferencia; las puntuales
    // se pagan en efectivo. El usuario sigue pudiendo cambiarlo.
    if (!methodTouched) setMethod(next.kind === "fixed" ? "transfer" : "cash");
  }

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    formData.set("locationId", locationId);
    formData.set("categoryId", categoryId);
    formData.set("method", method);

    startTransition(async () => {
      try {
        await createExpense(formData);
        toast.success(
          `Salida registrada · ${formatCurrency(numericAmount, currency)} desde ${location?.name}`,
        );
        router.push("/finance/salidas");
        router.refresh();
      } catch (error) {
        toast.error(
          error instanceof Error ? error.message : "No se pudo registrar la salida de dinero.",
        );
      }
    });
  }

  return (
    <form onSubmit={handleSubmit} className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
      <div className="space-y-5">
        <div className="grid gap-4 sm:grid-cols-[160px_1fr]">
          <div className="space-y-2">
            <Label htmlFor="amount">Monto ({currency})</Label>
            <Input
              id="amount"
              name="amount"
              inputMode="decimal"
              autoFocus
              required
              placeholder="0"
              value={amount}
              onChange={(event) => setAmount(event.target.value)}
              className="text-lg tabular-nums"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="description">¿En qué se fue el dinero?</Label>
            <Input
              id="description"
              name="description"
              required
              placeholder="Arriendo de agosto, compra de forros, mensajería…"
              value={description}
              onChange={(event) => setDescription(event.target.value)}
            />
          </div>
        </div>

        <div className="space-y-2">
          <Label>Tipo de salida</Label>
          <p className="text-xs text-muted-foreground">
            Fijas se repiten cada mes; esporádicas ocurren una vez.
          </p>
          <div className="space-y-3 pt-1">
            {[
              { kind: "fixed" as const, items: fixed },
              { kind: "sporadic" as const, items: sporadic },
            ].map(({ kind, items }) => (
              <div key={kind} className="space-y-1.5">
                <p className="text-xs font-medium text-muted-foreground">
                  {EXPENSE_KIND_LABELS[kind]}s
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {items.map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => selectCategory(item)}
                      className={cn(
                        "focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 outline-none rounded-full border px-3 py-1 text-xs transition-colors",
                        categoryId === item.id
                          ? "border-accent bg-accent text-accent-foreground"
                          : "border-border text-muted-foreground hover:border-accent/40 hover:text-foreground",
                      )}
                    >
                      {item.name}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-3">
          <div className="space-y-2">
            <Label htmlFor="locationId">Sede</Label>
            <Select
              value={locationId}
              onValueChange={(value) => setLocationId(String(value))}
              items={locations.map((option) => ({
                value: option.id,
                label: `${option.name} (${option.currency})`,
              }))}
            >
              <SelectTrigger id="locationId" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {locations.map((option) => (
                  <SelectItem key={option.id} value={option.id}>
                    {option.name} ({option.currency})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="expenseDate">Fecha</Label>
            <Input
              id="expenseDate"
              name="expenseDate"
              type="date"
              value={expenseDate}
              onChange={(event) => setExpenseDate(event.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="method">Medio de pago</Label>
            <Select
              value={method}
              onValueChange={(value) => {
                setMethod(String(value) as PaymentMethod);
                setMethodTouched(true);
              }}
              items={METHODS.map((option) => ({ value: option, label: PAYMENT_METHOD_LABELS[option] }))}
            >
              <SelectTrigger id="method" className="w-full">
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
        </div>

        <div className="space-y-3">
          <button
            type="button"
            onClick={() => setShowDetails((value) => !value)}
            className="flex items-center gap-1 rounded-sm text-sm text-muted-foreground transition-colors outline-none hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50"
          >
            <ChevronDownIcon className={cn("size-4 transition-transform", showDetails && "rotate-180")} />
            Proveedor, referencia y notas
          </button>

          {showDetails && (
            <div className="grid gap-4 rounded-lg border p-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="vendor">Proveedor</Label>
                <Input id="vendor" name="vendor" placeholder="A quién se le pagó" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="reference">Referencia</Label>
                <Input id="reference" name="reference" placeholder="N.º de factura o comprobante" />
              </div>
              <div className="space-y-2 sm:col-span-2">
                <Label htmlFor="notes">Notas</Label>
                <Textarea id="notes" name="notes" rows={2} />
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Vista previa en vivo: el usuario ve lo que va a quedar registrado
          antes de confirmar (reglas UX #6 y #10). */}
      <aside className="lg:sticky lg:top-6 lg:self-start">
        <div className="space-y-4 rounded-xl bg-card p-5 ring-1 ring-foreground/10">
          <p className="text-xs tracking-wide text-muted-foreground uppercase">Resumen</p>

          <div>
            <p className="text-3xl font-semibold tabular-nums text-destructive">
              − {formatCurrency(numericAmount, currency)}
            </p>
            {currency !== "USD" && (
              <p className="text-xs text-muted-foreground">
                ≈ {formatCurrency(amountUsd, "USD")} consolidado
              </p>
            )}
          </div>

          <dl className="space-y-2 border-t pt-4 text-sm">
            <div className="flex justify-between gap-3">
              <dt className="text-muted-foreground">Sede</dt>
              <dd className="text-right">{location?.name ?? "—"}</dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt className="text-muted-foreground">Tipo</dt>
              <dd className="text-right">
                {category ? (
                  <span className="flex items-center justify-end gap-1.5">
                    <Badge variant={category.kind === "fixed" ? "secondary" : "outline"}>
                      {EXPENSE_KIND_LABELS[category.kind]}
                    </Badge>
                    {category.name}
                  </span>
                ) : (
                  <span className="text-muted-foreground">Sin clasificar</span>
                )}
              </dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt className="text-muted-foreground">Fecha</dt>
              <dd className="text-right">
                {new Date(`${expenseDate}T12:00:00`).toLocaleDateString("es-CO", {
                  day: "numeric",
                  month: "long",
                  year: "numeric",
                })}
              </dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt className="text-muted-foreground">Medio</dt>
              <dd className="text-right">{PAYMENT_METHOD_LABELS[method]}</dd>
            </div>
          </dl>

          {category?.kind === "fixed" && (
            <p className="rounded-md border border-accent/30 bg-accent/5 p-3 text-xs text-muted-foreground">
              Es una salida fija. Si se repite todos los meses, decláralas una vez en{" "}
              <span className="text-foreground">Salidas → Tipos y fijas</span> y el sistema las
              registra solo.
            </p>
          )}

          <Button type="submit" className="w-full" disabled={!canSubmit || isPending}>
            {isPending && <Loader2Icon className="animate-spin" />}
            Registrar salida
          </Button>
          {!canSubmit && (
            <p className="text-center text-xs text-muted-foreground">
              Falta el monto y la descripción.
            </p>
          )}
        </div>
      </aside>
    </form>
  );
}
