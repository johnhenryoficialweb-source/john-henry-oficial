"use client";

import { useMemo, useState, useTransition } from "react";
import { toast } from "sonner";
import { CheckIcon, Loader2Icon, PencilIcon, PlusIcon, TrashIcon, XIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { GARMENT_TYPE_LABELS } from "@/lib/constants";
import { formatCurrency } from "@/lib/currency/exchange";
import { parseAmount } from "@/lib/currency/parse";
import type { CurrencyCode, GarmentType } from "@/types/database.types";

export interface EditableOrderItem {
  id: string;
  garmentType: GarmentType;
  fabricName: string | null;
  modelName: string | null;
  quantity: number;
  unitPrice: number;
  notes: string | null;
}

export interface StaffOption {
  id: string;
  fullName: string;
}

export interface OrderEditorProps {
  orderId: string;
  currency: CurrencyCode;
  items: EditableOrderItem[];
  discount: number;
  expectedDeliveryDate: string | null;
  assignedStaffId: string | null;
  staffOptions: StaffOption[];
  totalPaid: number;
  /** El histórico importado llegó sin precios; se avisa distinto. */
  isUnpriced: boolean;
  onSave: (formData: FormData) => Promise<void>;
  onAddItem: (formData: FormData) => Promise<void>;
  onRemoveItem: (itemId: string) => Promise<void>;
}

const GARMENT_TYPES = Object.keys(GARMENT_TYPE_LABELS) as GarmentType[];

/**
 * Edición de una orden ya creada: precios, cantidades, prendas y a quién se le
 * abona la venta.
 *
 * Existe por dos razones que no se pueden resolver creando otra orden. La
 * primera es el histórico: más de mil órdenes importadas sin precio que dejan
 * el panel financiero en cero y que solo se arreglan cargándoles el valor a
 * mano, orden por orden, cuando aparezca el dato. La segunda es que una venta
 * de sastrería no termina en el mostrador — en la prueba el cliente suma una
 * camisa, o cancela una de las cinco que pidió — y esa orden tiene que poder
 * moverse sin inventar una orden paralela que rompa el histórico del cliente.
 *
 * El editor arranca cerrado. Ver una orden es la acción frecuente; editarla es
 * la excepción, y unos campos siempre abiertos sobre cifras que ya están bien
 * invitan al error de digitación más que a la corrección.
 */
export function OrderEditor({
  currency,
  items,
  discount,
  expectedDeliveryDate,
  assignedStaffId,
  staffOptions,
  totalPaid,
  isUnpriced,
  onSave,
  onAddItem,
  onRemoveItem,
}: OrderEditorProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [isAdding, setIsAdding] = useState(false);

  const [draft, setDraft] = useState(() =>
    items.map((item) => ({
      id: item.id,
      quantity: String(item.quantity),
      unitPrice: String(item.unitPrice),
    }))
  );
  const [draftDiscount, setDraftDiscount] = useState(String(discount));
  const [draftDelivery, setDraftDelivery] = useState(expectedDeliveryDate ?? "");
  const [draftStaff, setDraftStaff] = useState(assignedStaffId ?? "");

  /*
   * IKEA effect: los totales se recalculan mientras se escribe. Cargar precios
   * a una orden histórica es trabajo a ciegas si hay que guardar para saber si
   * el número cuadra con lo que dice el papel.
   */
  const preview = useMemo(() => {
    const subtotal = draft.reduce(
      (sum, row) => sum + parseAmount(row.quantity) * parseAmount(row.unitPrice),
      0
    );
    const total = Math.max(subtotal - parseAmount(draftDiscount), 0);
    return { subtotal, total, balance: total - totalPaid };
  }, [draft, draftDiscount, totalPaid]);

  function updateRow(id: string, field: "quantity" | "unitPrice", value: string) {
    setDraft((rows) => rows.map((row) => (row.id === id ? { ...row, [field]: value } : row)));
  }

  function save(formData: FormData) {
    startTransition(async () => {
      try {
        await onSave(formData);
        toast.success("Orden actualizada");
        setIsOpen(false);
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "No se pudo guardar la orden.");
      }
    });
  }

  function addItem(formData: FormData) {
    startTransition(async () => {
      try {
        await onAddItem(formData);
        toast.success("Prenda agregada a la orden");
        setIsAdding(false);
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "No se pudo agregar la prenda.");
      }
    });
  }

  function removeItem(itemId: string, label: string) {
    startTransition(async () => {
      try {
        await onRemoveItem(itemId);
        toast.success(`${label} quitada de la orden`);
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "No se pudo quitar la prenda.");
      }
    });
  }

  if (!isOpen) {
    return (
      <Card className="print:hidden">
        <CardContent className="flex flex-wrap items-center justify-between gap-3 py-4">
          <div className="min-w-0">
            <p className="text-sm font-medium">
              {isUnpriced ? "Esta orden no tiene valor registrado" : "Modificar la orden"}
            </p>
            <p className="text-xs text-muted-foreground">
              {isUnpriced
                ? "Llegó del histórico importado sin precios, así que no suma al facturado. Cárgale el valor si tienes el dato."
                : "Cambia el valor de las prendas, agrega o quita piezas, ajusta la entrega y el asesor."}
            </p>
          </div>
          <Button variant={isUnpriced ? "default" : "outline"} onClick={() => setIsOpen(true)}>
            <PencilIcon />
            {isUnpriced ? "Cargar valor" : "Modificar"}
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="print:hidden">
      <CardHeader className="flex-row items-center justify-between space-y-0">
        <CardTitle>Modificar la orden</CardTitle>
        <Button variant="ghost" size="sm" onClick={() => setIsOpen(false)} disabled={isPending}>
          <XIcon />
          Cerrar
        </Button>
      </CardHeader>

      <CardContent className="space-y-5">
        <form action={save} className="space-y-5">
          <div className="space-y-3">
            {items.map((item) => {
              const row = draft.find((candidate) => candidate.id === item.id);
              if (!row) return null;
              const label = GARMENT_TYPE_LABELS[item.garmentType];
              const lineTotal = parseAmount(row.quantity) * parseAmount(row.unitPrice);

              return (
                <div key={item.id} className="rounded-lg border p-3">
                  <div className="mb-2 flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-sm font-medium">{label}</p>
                      <p className="truncate text-xs text-muted-foreground">
                        {item.fabricName ?? "Tela por definir"}
                        {item.modelName ? ` · ${item.modelName}` : ""}
                      </p>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="shrink-0 text-sm tabular-nums">
                        {formatCurrency(lineTotal, currency)}
                      </span>
                      {items.length > 1 ? (
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          disabled={isPending}
                          aria-label={`Quitar ${label} de la orden`}
                          onClick={() => removeItem(item.id, label)}
                        >
                          <TrashIcon className="size-4" />
                        </Button>
                      ) : null}
                    </div>
                  </div>

                  <input type="hidden" name="itemId" value={item.id} />
                  <div className="grid gap-2 sm:grid-cols-[6rem_1fr]">
                    <div className="space-y-1">
                      <Label htmlFor={`qty-${item.id}`} className="text-xs">
                        Cantidad
                      </Label>
                      <Input
                        id={`qty-${item.id}`}
                        name="quantity"
                        inputMode="numeric"
                        value={row.quantity}
                        onChange={(event) => updateRow(item.id, "quantity", event.target.value)}
                      />
                    </div>
                    <div className="space-y-1">
                      <Label htmlFor={`price-${item.id}`} className="text-xs">
                        Valor unitario ({currency})
                      </Label>
                      <Input
                        id={`price-${item.id}`}
                        name="unitPrice"
                        inputMode="decimal"
                        value={row.unitPrice}
                        onChange={(event) => updateRow(item.id, "unitPrice", event.target.value)}
                      />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            <div className="space-y-1">
              <Label htmlFor="discount">Descuento ({currency})</Label>
              <Input
                id="discount"
                name="discount"
                inputMode="decimal"
                value={draftDiscount}
                onChange={(event) => setDraftDiscount(event.target.value)}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="expectedDeliveryDate">Entrega estimada</Label>
              <Input
                id="expectedDeliveryDate"
                name="expectedDeliveryDate"
                type="date"
                value={draftDelivery}
                onChange={(event) => setDraftDelivery(event.target.value)}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="assignedStaffId">Asesor que atendió</Label>
              <select
                id="assignedStaffId"
                name="assignedStaffId"
                value={draftStaff}
                onChange={(event) => setDraftStaff(event.target.value)}
                className="h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"
              >
                <option value="">Sin asignar</option>
                {staffOptions.map((staff) => (
                  <option key={staff.id} value={staff.id}>
                    {staff.fullName}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/*
            Contrast effect: antes de guardar, qué queda. El saldo es el número
            que decide si hay que cobrarle al cliente o devolverle, y es
            exactamente el que hoy sale negativo en las órdenes sin precio.
          */}
          <dl className="space-y-1 rounded-lg bg-muted/40 px-3 py-2 text-sm">
            <div className="flex justify-between gap-3">
              <dt className="text-muted-foreground">Subtotal</dt>
              <dd className="tabular-nums">{formatCurrency(preview.subtotal, currency)}</dd>
            </div>
            <div className="flex justify-between gap-3 border-t pt-1 font-medium">
              <dt>Total</dt>
              <dd className="tabular-nums">{formatCurrency(preview.total, currency)}</dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt className="text-muted-foreground">Pagado</dt>
              <dd className="tabular-nums">{formatCurrency(totalPaid, currency)}</dd>
            </div>
            <div className="flex justify-between gap-3 font-medium">
              <dt>Saldo pendiente</dt>
              <dd
                className={
                  preview.balance < 0 ? "tabular-nums text-destructive" : "tabular-nums"
                }
              >
                {formatCurrency(preview.balance, currency)}
              </dd>
            </div>
            {preview.balance < 0 ? (
              <p className="pt-1 text-xs text-destructive">
                El cliente pagó más que el total de la orden. Revisa el valor de las prendas antes
                de guardar.
              </p>
            ) : null}
          </dl>

          <Button type="submit" className="w-full" disabled={isPending}>
            {isPending ? <Loader2Icon className="animate-spin" /> : <CheckIcon />}
            Guardar cambios
          </Button>
        </form>

        {/* Progressive disclosure: agregar prenda es otro acto, con su propio formulario. */}
        <div className="border-t pt-4">
          {isAdding ? (
            <form action={addItem} className="space-y-3">
              <div className="grid gap-2 sm:grid-cols-3">
                <div className="space-y-1">
                  <Label htmlFor="newGarmentType">Prenda</Label>
                  <select
                    id="newGarmentType"
                    name="garmentType"
                    required
                    className="h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"
                  >
                    {GARMENT_TYPES.map((type) => (
                      <option key={type} value={type}>
                        {GARMENT_TYPE_LABELS[type]}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="space-y-1">
                  <Label htmlFor="newQuantity">Cantidad</Label>
                  <Input id="newQuantity" name="quantity" inputMode="numeric" defaultValue="1" />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="newUnitPrice">Valor unitario ({currency})</Label>
                  <Input id="newUnitPrice" name="unitPrice" inputMode="decimal" defaultValue="0" />
                </div>
              </div>
              <div className="space-y-1">
                <Label htmlFor="newNotes">Especificación (opcional)</Label>
                <Input id="newNotes" name="notes" placeholder="Tela, cuello, puño, iniciales…" />
              </div>
              <div className="flex gap-2">
                <Button type="submit" disabled={isPending}>
                  {isPending ? <Loader2Icon className="animate-spin" /> : <PlusIcon />}
                  Agregar prenda
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => setIsAdding(false)}
                  disabled={isPending}
                >
                  Cancelar
                </Button>
              </div>
            </form>
          ) : (
            <Button type="button" variant="outline" onClick={() => setIsAdding(true)}>
              <PlusIcon />
              Agregar otra prenda
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
