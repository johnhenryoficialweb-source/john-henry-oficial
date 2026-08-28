"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  ArrowLeftIcon,
  CheckIcon,
  FilePlus2Icon,
  Loader2Icon,
  PlusIcon,
  XIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { GARMENT_TYPE_LABELS } from "@/lib/constants";
import { formatCurrency } from "@/lib/currency/exchange";
import {
  channelFee,
  channelFeeLabel,
  fallbackMethodOf,
  isFallbackChannel,
  resolveChannels,
  type PaymentChannelOption,
} from "@/lib/finance/labels";
import { digitizeOrder, type PaymentStage } from "@/app/(cms)/(protected)/orders/actions";
import type { CurrencyCode, GarmentType } from "@/types/database.types";

export interface DigitizableOrderItem {
  id: string;
  garmentType: GarmentType;
  quantity: number;
  unitPrice: number;
}

export interface DigitizableOrder {
  id: string;
  orderNumber: string | null;
  createdAt: string;
  statusLabel: string;
  itemsSummary: string;
  currency: CurrencyCode;
  total: number;
  paid: number;
  locationId: string | null;
  assignedStaffId: string | null;
  items: DigitizableOrderItem[];
}

export interface DigitizeLocationOption {
  id: string;
  name: string;
  currency: CurrencyCode;
}

export interface DigitizeStaffOption {
  id: string;
  fullName: string;
  locationId: string | null;
}

const GARMENT_TYPES: GarmentType[] = ["saco", "camisa", "pantalon", "chaleco", "otro"];

const NEW_ORDER = "new";

const STEP_TITLES = ["¿Cuál orden vas a digitalizar?", "Prendas, precios y pagos"];
const STEP_COUNT = STEP_TITLES.length;

const STAGE_LABELS: Record<PaymentStage, string> = {
  inicio: "Abono inicial",
  final: "Pago final",
};

/** Una prenda de la orden con su precio propio. */
interface LineDraft {
  key: string;
  /** id del order_item cuando la prenda ya existe en la orden. */
  itemId: string | null;
  garmentType: GarmentType;
  quantity: number;
  priceRaw: string;
}

/** Un pago que ya ocurrió, con su momento, su fecha y su medio. */
interface PaymentDraft {
  key: string;
  stage: PaymentStage;
  amountRaw: string;
  date: string;
  channelId: string;
}

let sequence = 0;
function nextKey(): string {
  sequence += 1;
  return `k${sequence}`;
}

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

function toDateInput(iso: string): string {
  return iso.slice(0, 10);
}

function formatDate(value: string): string {
  return new Date(`${value}T12:00:00Z`).toLocaleDateString("es-CO", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

/**
 * Lee un monto escrito a mano.
 *
 * En COP se dictan pesos con puntos de miles ("1.200.000") y en USD con coma
 * ("1,200.50"). Un `type="number"` obligaría a escribirlo sin separadores —
 * justo el formato en que nadie tiene el dato en la libreta.
 */
function parseAmount(raw: string, currency: CurrencyCode): number {
  const cleaned = raw.replace(/[^\d.,]/g, "");
  if (!cleaned) return 0;
  if (currency === "COP") return Number(cleaned.replace(/\D/g, "")) || 0;
  const value = Number(cleaned.replace(/,/g, ""));
  return Number.isFinite(value) ? value : 0;
}

/**
 * Digitalización de una orden que ya ocurrió, en dos pasos: cuál orden, y
 * qué se hizo, cuánto valió y cómo lo pagaron.
 *
 * El asistente de orden nueva pide medidas, telas y modelos porque va a
 * producir la prenda. Una orden histórica ya se entregó: lo único que falta de
 * ella es la plata, y pedir lo demás sería cobrar un peaje por cargar el dato
 * que el negocio necesita hoy. Por eso este flujo corre aparte.
 *
 * Precio por prenda y pagos por separado, no un total y un abono: una orden de
 * dos sacos y una camisa tiene tres precios, y casi siempre se pagó en dos
 * momentos —abono al encargar, saldo al entregar— que caen en meses distintos
 * y a veces por medios distintos. Aplanar eso a un número borra exactamente lo
 * que hace útil el histórico.
 */
export function DigitizeOrderDialog({
  clientId,
  orders,
  locations,
  channels,
  staff,
  defaultLocationId,
  defaultStaffId = null,
  defaultGarmentType = "saco",
  suggestedUnitPrice = 0,
  triggerLabel = "Digitalizar orden",
  triggerVariant = "outline",
}: {
  clientId: string;
  orders: DigitizableOrder[];
  locations: DigitizeLocationOption[];
  /** Medios de cobro con su comisión, para saber cuánto entró de verdad. */
  channels: PaymentChannelOption[];
  /** Asesores que pueden figurar como responsables de la venta. */
  staff: DigitizeStaffOption[];
  defaultLocationId: string;
  defaultStaffId?: string | null;
  defaultGarmentType?: GarmentType;
  suggestedUnitPrice?: number;
  triggerLabel?: string;
  triggerVariant?: "default" | "outline" | "secondary" | "ghost";
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const [open, setOpen] = useState(false);
  const [step, setStep] = useState(1);
  const [savedIds, setSavedIds] = useState<string[]>([]);
  const [lastSaved, setLastSaved] = useState<string | null>(null);
  const [showValued, setShowValued] = useState(false);

  const pendingOrders = orders.filter((order) => order.total <= 0 && !savedIds.includes(order.id));
  const valuedOrders = orders.filter((order) => order.total > 0 && !savedIds.includes(order.id));

  // Smart default: la orden más reciente sin valor es casi siempre la que el
  // sastre tiene en la mano. Si no hay ninguna, la orden no está en el sistema.
  const [selection, setSelection] = useState<string>(() => pendingOrders[0]?.id ?? NEW_ORDER);
  const [locationId, setLocationId] = useState(defaultLocationId);
  const [orderDate, setOrderDate] = useState(today);
  const [staffId, setStaffId] = useState<string>(
    () => pendingOrders[0]?.assignedStaffId ?? defaultStaffId ?? ""
  );

  const selectedOrder = orders.find((order) => order.id === selection) ?? null;
  const currency =
    selectedOrder?.currency ??
    locations.find((location) => location.id === locationId)?.currency ??
    "USD";
  const effectiveDate = selectedOrder ? toDateInput(selectedOrder.createdAt) : orderDate;

  /*
   * Si todavía no hay canales configurados se usan los medios base. La
   * pregunta "¿por dónde entró?" no puede quedarse sin respuestas: perder el
   * tipo de pago es perder el dato, y recuperarlo después obliga a revisar
   * cobro por cobro.
   */
  const payChannels = resolveChannels(channels);
  const usingFallbackChannels = channels.length === 0;
  const defaultChannelId = payChannels[0]?.id ?? "";

  function buildLines(order: DigitizableOrder | null): LineDraft[] {
    // Una orden existente ya trae sus prendas: solo les falta el precio.
    if (order && order.items.length > 0) {
      return order.items.map((item) => ({
        key: nextKey(),
        itemId: item.id,
        garmentType: item.garmentType,
        quantity: item.quantity,
        priceRaw: item.unitPrice > 0 ? String(item.unitPrice) : "",
      }));
    }
    return [
      {
        key: nextKey(),
        itemId: null,
        garmentType: order ? "otro" : defaultGarmentType,
        quantity: 1,
        priceRaw: suggestedUnitPrice > 0 ? String(suggestedUnitPrice) : "",
      },
    ];
  }

  const [lines, setLines] = useState<LineDraft[]>(() => buildLines(pendingOrders[0] ?? null));
  const [payments, setPayments] = useState<PaymentDraft[]>([]);

  const total = lines.reduce(
    (sum, line) => sum + line.quantity * parseAmount(line.priceRaw, currency),
    0
  );
  const alreadyPaid = selectedOrder?.paid ?? 0;
  const paidAmount = payments.reduce(
    (sum, payment) => sum + parseAmount(payment.amountRaw, currency),
    0
  );
  const totalFee = payments.reduce((sum, payment) => {
    const channel = payChannels.find((option) => option.id === payment.channelId);
    return sum + (channel ? channelFee(channel, parseAmount(payment.amountRaw, currency)) : 0);
  }, 0);
  const balance = Math.max(total - alreadyPaid - paidAmount, 0);

  const canContinueFromStep1 =
    selection !== NEW_ORDER || (Boolean(locationId) && Boolean(orderDate));
  const canSave = total > 0 && payments.every((p) => parseAmount(p.amountRaw, currency) > 0);

  /**
   * Cada elección de orden arrastra sus propios valores por defecto: sus
   * prendas, su asesor y la fecha de sus pagos. Se fijan al elegir —no en un
   * efecto— para que el sastre nunca vea un campo con el dato del anterior.
   */
  function selectOrder(next: string) {
    setSelection(next);
    const order = orders.find((candidate) => candidate.id === next) ?? null;
    setLines(buildLines(order));
    setPayments([]);
    setStaffId(order?.assignedStaffId ?? defaultStaffId ?? "");
    // La sede de una orden que ya existe es la suya, no la del usuario.
    setLocationId(order?.locationId ?? defaultLocationId);
  }

  function updateLine(key: string, patch: Partial<LineDraft>) {
    setLines((current) =>
      current.map((line) => (line.key === key ? { ...line, ...patch } : line))
    );
  }

  function addLine(garmentType: GarmentType) {
    setLines((current) => [
      ...current,
      {
        key: nextKey(),
        itemId: null,
        garmentType,
        quantity: 1,
        // La prenda que se acaba de agregar suele valer lo mismo que la
        // anterior del mismo tipo: copiarla ahorra volver a teclear el precio.
        priceRaw:
          current.find((line) => line.garmentType === garmentType)?.priceRaw ??
          (suggestedUnitPrice > 0 ? String(suggestedUnitPrice) : ""),
      },
    ]);
  }

  function addPayment(stage: PaymentStage) {
    const pending = Math.max(total - alreadyPaid - paidAmount, 0);
    setPayments((current) => [
      ...current,
      {
        key: nextKey(),
        stage,
        // El abono inicial se escribe; el pago final casi siempre es el saldo.
        amountRaw: stage === "final" && pending > 0 ? String(pending) : "",
        date: effectiveDate,
        channelId: defaultChannelId,
      },
    ]);
  }

  function updatePayment(key: string, patch: Partial<PaymentDraft>) {
    setPayments((current) =>
      current.map((payment) => (payment.key === key ? { ...payment, ...patch } : payment))
    );
  }

  function resetForNext() {
    const remaining = pendingOrders.filter((order) => order.id !== selection);
    setStep(1);
    setShowValued(false);
    if (remaining.length > 0) {
      selectOrder(remaining[0].id);
    } else {
      setSelection(NEW_ORDER);
      setLines(buildLines(null));
      setPayments([]);
      setOrderDate(today());
      setStaffId(defaultStaffId ?? "");
    }
  }

  function save() {
    startTransition(async () => {
      const result = await digitizeOrder({
        clientId,
        orderId: selection === NEW_ORDER ? null : selection,
        newOrder: selection === NEW_ORDER ? { locationId, orderDate } : null,
        assignedStaffId: staffId || null,
        lines: lines.map((line) => ({
          itemId: line.itemId,
          garmentType: line.garmentType,
          quantity: line.quantity,
          unitPrice: parseAmount(line.priceRaw, currency),
        })),
        payments: payments.map((payment) => ({
          amount: parseAmount(payment.amountRaw, currency),
          // Un medio base no existe en la tabla: viaja como método suelto.
          channelId:
            payment.channelId && !isFallbackChannel(payment.channelId) ? payment.channelId : null,
          method:
            payment.channelId && isFallbackChannel(payment.channelId)
              ? fallbackMethodOf(payment.channelId)
              : null,
          paidAt: payment.date,
          stage: payment.stage,
        })),
      });

      if (!result.ok) {
        toast.error(result.error);
        return;
      }

      const label = result.orderNumber ?? "La orden";
      toast.success(
        result.paidAmount > 0
          ? `${label} · ${formatCurrency(result.paidAmount, currency)} registrados`
          : `${label} registrada por ${formatCurrency(result.total, currency)}`
      );

      const digitizedId = selection === NEW_ORDER ? result.orderId : selection;
      setSavedIds((previous) => [...previous, digitizedId]);
      setLastSaved(label);
      router.refresh();

      // Digitalizar es trabajo en tandas: si quedan órdenes sin valor, el
      // diálogo se queda abierto en la siguiente en vez de obligar a reabrirlo.
      const remaining = pendingOrders.filter((order) => order.id !== selection);
      if (remaining.length > 0) {
        resetForNext();
      } else {
        setOpen(false);
        setStep(1);
      }
    });
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) {
          setStep(1);
          setLastSaved(null);
        }
      }}
    >
      <DialogTrigger render={<Button variant={triggerVariant} size="sm" />}>
        <FilePlus2Icon />
        {triggerLabel}
      </DialogTrigger>

      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>Digitalizar orden</DialogTitle>
          <DialogDescription>
            Registra una orden que ya ocurrió y el dinero que ya entró por ella.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-1.5">
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>
              Paso {step} de {STEP_COUNT} · {STEP_TITLES[step - 1]}
            </span>
            <span className="tabular-nums">{Math.round((step / STEP_COUNT) * 100)}%</span>
          </div>
          <div className="h-1 overflow-hidden rounded-full bg-muted">
            <div
              className="h-full rounded-full bg-accent transition-all"
              style={{ width: `${(step / STEP_COUNT) * 100}%` }}
            />
          </div>
        </div>

        {lastSaved ? (
          <p className="flex items-center gap-1.5 rounded-lg bg-accent/10 px-3 py-2 text-xs text-accent">
            <CheckIcon className="size-3.5" />
            {lastSaved} quedó registrada. Sigue la siguiente.
          </p>
        ) : null}

        <div className="max-h-[58vh] space-y-3 overflow-y-auto">
          {step === 1 ? (
            <>
              {pendingOrders.length > 0 ? (
                <div className="space-y-2">
                  <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
                    Sin valor registrado ({pendingOrders.length})
                  </p>
                  {pendingOrders.map((order) => (
                    <OrderChoice
                      key={order.id}
                      selected={selection === order.id}
                      onSelect={() => selectOrder(order.id)}
                      title={order.orderNumber ?? "Orden sin número"}
                      badge={order.statusLabel}
                      subtitle={`${formatDate(toDateInput(order.createdAt))} · ${order.itemsSummary}`}
                      aside="Sin valor"
                    />
                  ))}
                </div>
              ) : null}

              <OrderChoice
                selected={selection === NEW_ORDER}
                onSelect={() => selectOrder(NEW_ORDER)}
                title="No está en el sistema"
                subtitle="Crearla ahora: fecha, sede y las prendas que le hiciste."
                icon={<PlusIcon className="size-4" />}
              />

              {selection === NEW_ORDER ? (
                <div className="space-y-1 rounded-lg border border-border bg-muted/30 p-3">
                  <Label htmlFor="digitize-date">Fecha de la orden</Label>
                  <Input
                    id="digitize-date"
                    type="date"
                    max={today()}
                    value={orderDate}
                    onChange={(event) => setOrderDate(event.target.value)}
                  />
                </div>
              ) : null}

              {staff.length > 0 ? (
                <div className="space-y-1.5">
                  <Label>Asesor de la venta</Label>
                  <div className="flex flex-wrap gap-1.5">
                    {staff.map((person) => (
                      <Chip
                        key={person.id}
                        selected={staffId === person.id}
                        onSelect={() => setStaffId(staffId === person.id ? "" : person.id)}
                      >
                        {person.fullName}
                      </Chip>
                    ))}
                  </div>
                </div>
              ) : null}

              {valuedOrders.length > 0 ? (
                showValued ? (
                  <div className="space-y-2">
                    <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
                      Órdenes que ya tienen valor
                    </p>
                    {valuedOrders.map((order) => (
                      <OrderChoice
                        key={order.id}
                        selected={selection === order.id}
                        onSelect={() => selectOrder(order.id)}
                        title={order.orderNumber ?? "Orden sin número"}
                        badge={order.statusLabel}
                        subtitle={`${formatDate(toDateInput(order.createdAt))} · ${order.itemsSummary}`}
                        aside={formatCurrency(order.total, order.currency)}
                      />
                    ))}
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => setShowValued(true)}
                    className="text-xs text-muted-foreground underline underline-offset-4 hover:text-foreground"
                  >
                    Registrar un pago sobre una orden que ya tiene valor
                  </button>
                )
              ) : null}
            </>
          ) : null}

          {step === 2 ? (
            <div className="space-y-4">
              <ContextLine
                orderLabel={selectedOrder?.orderNumber ?? "Orden nueva"}
                detail={`${formatDate(effectiveDate)}${
                  staffId
                    ? ` · ${staff.find((person) => person.id === staffId)?.fullName ?? ""}`
                    : ""
                }`}
              />

              {/* Sucursal ------------------------------------------------ */}
              <div className="space-y-1.5">
                <Label>Sucursal</Label>
                <div className="flex flex-wrap gap-1.5">
                  {locations.map((location) => (
                    <Chip
                      key={location.id}
                      selected={locationId === location.id}
                      /*
                       * La sede de una orden que ya existe no se toca desde
                       * acá: su número ya lleva el código de sede y su moneda
                       * está congelada, así que moverla dejaría los pagos en
                       * una moneda que la orden ya no usa.
                       */
                      disabled={Boolean(selectedOrder)}
                      onSelect={() => setLocationId(location.id)}
                    >
                      {location.name} · {location.currency}
                    </Chip>
                  ))}
                </div>
                <p className="text-xs text-muted-foreground">
                  {selectedOrder
                    ? "Viene de la orden y fija su moneda."
                    : "Define la moneda de los precios y de los pagos."}
                </p>
              </div>

              {/* Prendas ------------------------------------------------- */}
              <div className="space-y-2">
                <div className="flex items-baseline justify-between gap-3">
                  <Label>Prendas y precio ({currency})</Label>
                  <span className="text-xs text-muted-foreground tabular-nums">
                    Total {formatCurrency(total, currency)}
                  </span>
                </div>

                {lines.map((line) => {
                  const unitPrice = parseAmount(line.priceRaw, currency);
                  return (
                    <div
                      key={line.key}
                      className="grid grid-cols-[1fr_3.5rem_1fr_auto] items-center gap-2"
                    >
                      <select
                        aria-label="Prenda"
                        value={line.garmentType}
                        onChange={(event) =>
                          updateLine(line.key, {
                            garmentType: event.target.value as GarmentType,
                          })
                        }
                        className="h-8 w-full rounded-lg border border-input bg-transparent px-2 text-sm"
                      >
                        {GARMENT_TYPES.map((type) => (
                          <option key={type} value={type}>
                            {GARMENT_TYPE_LABELS[type]}
                          </option>
                        ))}
                      </select>

                      <Input
                        aria-label="Cantidad"
                        type="number"
                        min={1}
                        value={line.quantity}
                        onChange={(event) =>
                          updateLine(line.key, {
                            quantity: Math.max(1, Number(event.target.value) || 1),
                          })
                        }
                      />

                      <Input
                        aria-label="Precio por unidad"
                        inputMode="decimal"
                        placeholder={currency === "COP" ? "1.200.000" : "480"}
                        value={line.priceRaw}
                        onChange={(event) => updateLine(line.key, { priceRaw: event.target.value })}
                      />

                      {lines.length > 1 && !line.itemId ? (
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          onClick={() =>
                            setLines((current) => current.filter((l) => l.key !== line.key))
                          }
                          aria-label="Quitar prenda"
                        >
                          <XIcon />
                        </Button>
                      ) : (
                        <span className="w-7 shrink-0 text-right text-xs text-muted-foreground tabular-nums">
                          {line.quantity > 1 && unitPrice > 0
                            ? formatCurrency(line.quantity * unitPrice, currency)
                            : ""}
                        </span>
                      )}
                    </div>
                  );
                })}

                <div className="flex flex-wrap items-center gap-1.5">
                  <span className="text-xs text-muted-foreground">Agregar:</span>
                  {GARMENT_TYPES.map((type) => (
                    <Chip key={type} selected={false} onSelect={() => addLine(type)}>
                      + {GARMENT_TYPE_LABELS[type]}
                    </Chip>
                  ))}
                </div>
              </div>

              {/* Pagos --------------------------------------------------- */}
              <div className="space-y-2 border-t pt-3">
                <div className="flex items-baseline justify-between gap-3">
                  <Label>Pagos que ya recibiste</Label>
                  <span className="text-xs text-muted-foreground tabular-nums">
                    {paidAmount > 0 ? formatCurrency(paidAmount, currency) : "nada aún"}
                  </span>
                </div>

                {payments.length === 0 ? (
                  <p className="text-xs text-muted-foreground">
                    Sin pagos: la orden queda completa en cuentas por cobrar.
                  </p>
                ) : null}

                {payments.map((payment) => (
                  <div key={payment.key} className="space-y-2 rounded-lg border border-border p-2.5">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex gap-1.5">
                        {(["inicio", "final"] as PaymentStage[]).map((stage) => (
                          <Chip
                            key={stage}
                            selected={payment.stage === stage}
                            onSelect={() => updatePayment(payment.key, { stage })}
                          >
                            {STAGE_LABELS[stage]}
                          </Chip>
                        ))}
                      </div>
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        onClick={() =>
                          setPayments((current) =>
                            current.filter((item) => item.key !== payment.key)
                          )
                        }
                        aria-label="Quitar pago"
                      >
                        <XIcon />
                      </Button>
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <Input
                        aria-label="Monto"
                        inputMode="decimal"
                        placeholder={currency === "COP" ? "500.000" : "200"}
                        value={payment.amountRaw}
                        onChange={(event) =>
                          updatePayment(payment.key, { amountRaw: event.target.value })
                        }
                      />
                      <Input
                        aria-label="Fecha del pago"
                        type="date"
                        max={today()}
                        value={payment.date}
                        onChange={(event) =>
                          updatePayment(payment.key, { date: event.target.value })
                        }
                      />
                    </div>

                    <div className="flex flex-wrap gap-1.5">
                      {payChannels.map((option) => (
                        <Chip
                          key={option.id}
                          selected={payment.channelId === option.id}
                          onSelect={() => updatePayment(payment.key, { channelId: option.id })}
                        >
                          {option.name}
                          {option.feePercent > 0 || option.feeFixed > 0 ? (
                            <span className="opacity-70"> · {channelFeeLabel(option)}</span>
                          ) : null}
                        </Chip>
                      ))}
                    </div>
                  </div>
                ))}

                <div className="flex flex-wrap gap-1.5">
                  <Button variant="outline" size="sm" onClick={() => addPayment("inicio")}>
                    <PlusIcon />
                    Abono inicial
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => addPayment("final")}>
                    <PlusIcon />
                    Pago final
                  </Button>
                </div>

                {usingFallbackChannels ? (
                  <p className="text-xs text-muted-foreground">
                    Los medios se registran sin comisión. Para descontar lo que retiene el datáfono,
                    configura su porcentaje en Ajustes → Medios de cobro.
                  </p>
                ) : null}
              </div>

              {/* Resumen ------------------------------------------------- */}
              <div className="space-y-1 rounded-lg border border-border bg-muted/30 p-3 text-xs">
                <SummaryLine label="Valor de la orden" value={formatCurrency(total, currency)} />
                {alreadyPaid > 0 ? (
                  <SummaryLine
                    label="Ya registrado antes"
                    value={formatCurrency(alreadyPaid, currency)}
                  />
                ) : null}
                <SummaryLine
                  label={`Entradas de dinero (${payments.length})`}
                  value={paidAmount > 0 ? formatCurrency(paidAmount, currency) : "Ninguna"}
                  strong
                />
                {totalFee > 0 ? (
                  <>
                    <SummaryLine
                      label="Comisiones de los medios"
                      value={`− ${formatCurrency(totalFee, currency)}`}
                    />
                    <SummaryLine
                      label="Neto que entró a caja"
                      value={formatCurrency(paidAmount - totalFee, currency)}
                    />
                  </>
                ) : null}
                <SummaryLine label="Saldo pendiente" value={formatCurrency(balance, currency)} />
              </div>
            </div>
          ) : null}
        </div>

        <DialogFooter>
          {step > 1 ? (
            <Button variant="ghost" onClick={() => setStep(step - 1)} disabled={isPending}>
              <ArrowLeftIcon />
              Atrás
            </Button>
          ) : (
            <DialogClose render={<Button variant="ghost" />}>Cancelar</DialogClose>
          )}

          {step < STEP_COUNT ? (
            <Button onClick={() => setStep(step + 1)} disabled={!canContinueFromStep1}>
              Continuar
            </Button>
          ) : (
            <Button onClick={save} disabled={!canSave || isPending}>
              {isPending ? <Loader2Icon className="animate-spin" /> : <CheckIcon />}
              {paidAmount > 0
                ? `Guardar y registrar ${formatCurrency(paidAmount, currency)}`
                : "Guardar orden"}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function OrderChoice({
  selected,
  onSelect,
  title,
  subtitle,
  badge,
  aside,
  icon,
}: {
  selected: boolean;
  onSelect: () => void;
  title: string;
  subtitle: string;
  badge?: string;
  aside?: string;
  icon?: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={selected}
      className={cn(
        "flex w-full items-start justify-between gap-3 rounded-lg border px-3 py-2 text-left text-sm transition-colors",
        selected
          ? "border-accent bg-accent/10"
          : "border-border hover:border-accent/40 hover:bg-muted/50"
      )}
    >
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          {icon}
          <span className="font-medium">{title}</span>
          {badge ? <Badge variant="secondary">{badge}</Badge> : null}
        </div>
        <p className="mt-0.5 text-xs text-muted-foreground">{subtitle}</p>
      </div>
      {aside ? (
        <span className="shrink-0 text-xs text-muted-foreground tabular-nums">{aside}</span>
      ) : null}
    </button>
  );
}

function Chip({
  selected,
  onSelect,
  disabled,
  children,
}: {
  selected: boolean;
  onSelect: () => void;
  disabled?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      disabled={disabled}
      aria-pressed={selected}
      className={cn(
        "rounded-full border px-3 py-1 text-xs font-medium transition-colors",
        selected
          ? "border-accent bg-accent text-accent-foreground"
          : "border-border text-muted-foreground",
        disabled
          ? "cursor-default opacity-50 aria-pressed:opacity-100"
          : "hover:border-accent/40 hover:text-foreground"
      )}
    >
      {children}
    </button>
  );
}

function ContextLine({ orderLabel, detail }: { orderLabel: string; detail: string }) {
  return (
    <div className="rounded-lg bg-muted/40 px-3 py-2 text-xs">
      <span className="font-medium">{orderLabel}</span>
      <span className="text-muted-foreground"> · {detail}</span>
    </div>
  );
}

function SummaryLine({
  label,
  value,
  strong,
}: {
  label: string;
  value: string;
  strong?: boolean;
}) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-muted-foreground">{label}</span>
      <span className={cn("tabular-nums", strong && "font-medium text-foreground")}>{value}</span>
    </div>
  );
}
