import Link from "next/link";
import { notFound } from "next/navigation";
import { requireStaffSession } from "@/lib/auth/roles";
import { createClient } from "@/lib/supabase/server";
import { GARMENT_TYPE_LABELS, ORDER_STATUS_LABELS, APPOINTMENT_STATUS_LABELS } from "@/lib/constants";
import { formatCurrency, toUsd } from "@/lib/currency/exchange";
import { getPaymentChannels } from "@/lib/finance/payment-channels";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  DigitizeOrderDialog,
  type DigitizeLocationOption,
} from "@/components/cms/digitize-order-dialog";
import { ClientProfileForm } from "@/components/cms/client-profile-form";
import { ClientRestoreButton } from "@/components/cms/client-restore-button";
import {
  ClientMeasurementsPanel,
  type ClientMeasurementRecord,
} from "@/components/cms/client-measurements-panel";
import {
  ArrowLeftIcon,
  PlusIcon,
  Trash2Icon,
  WalletIcon,
  ReceiptTextIcon,
  PackageIcon,
  ClipboardCheckIcon,
} from "lucide-react";
import type { CurrencyCode, GarmentType, OrderStatus } from "@/types/database.types";

const CLOSED_STATUSES: OrderStatus[] = ["delivered", "cancelled"];

interface OrderItemRow {
  id: string;
  garment_type: GarmentType;
  quantity: number;
  unit_price: number | null;
}

function formatOrderDate(date: string): string {
  return new Date(date).toLocaleDateString("es-CO", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function formatOrderItemsSummary(items: OrderItemRow[]): string {
  if (items.length === 0) return "Sin prendas registradas";
  return items.map((item) => `${item.quantity}x ${GARMENT_TYPE_LABELS[item.garment_type]}`).join(" · ");
}

export default async function ClientDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await requireStaffSession();
  const supabase = await createClient();

  const { data: client } = await supabase
    .from("clients")
    .select("*, locations(name, code)")
    .eq("id", id)
    .single();

  if (!client) notFound();

  const isTrashed = Boolean(client.deleted_at);
  const location = client.locations as unknown as { name: string; code: string } | null;

  const { data: locations } = await supabase
    .from("locations")
    .select("id, name, currency")
    .eq("is_active", true)
    .order("name");

  const [
    { data: measurements },
    { data: orders },
    { data: appointments },
    paymentChannels,
    { data: staffUsers },
  ] = await Promise.all([
      supabase
        .from("client_measurements")
        .select("garment_type, values, unit, taken_at")
        .eq("client_id", id)
        .eq("is_latest", true)
        .eq("source", "profile")
        .order("taken_at", { ascending: false }),
      supabase
        .from("orders")
        .select(
          "id, order_number, status, currency, total, exchange_rate_to_usd, created_at, location_id, assigned_staff_id, order_items(id, garment_type, quantity, unit_price)"
        )
        .eq("client_id", id)
        .order("created_at", { ascending: false }),
      supabase
        .from("appointments")
        .select("id, appointment_type, starts_at, status")
        .eq("client_id", id)
        .order("starts_at", { ascending: false })
        .limit(10),
      getPaymentChannels({ locationId: client.home_location_id }),
      supabase
        .from("staff_users")
        .select("id, full_name, location_id")
        .eq("is_active", true)
        .order("full_name"),
    ]);

  /*
   * Una medida vigente por prenda. La consulta ya filtra is_latest, pero si
   * quedaran dos filas marcadas para la misma prenda (histórico migrado, dos
   * tomas el mismo día) se mostrarían duplicadas: gana la más reciente.
   */
  const latestByGarment = new Map<GarmentType, ClientMeasurementRecord>();
  for (const m of measurements ?? []) {
    if (latestByGarment.has(m.garment_type)) continue;
    latestByGarment.set(m.garment_type, {
      garmentType: m.garment_type,
      values: m.values as Record<string, number>,
      unit: m.unit,
      takenAt: m.taken_at,
    });
  }
  const profileMeasurements = [...latestByGarment.values()];

  const orderIds = (orders ?? []).map((o) => o.id);
  const { data: payments } =
    orderIds.length > 0
      ? await supabase.from("payments").select("order_id, amount").in("order_id", orderIds)
      : { data: [] as { order_id: string; amount: number }[] };

  const paidByOrder = new Map<string, number>();
  for (const p of payments ?? []) {
    paidByOrder.set(p.order_id, (paidByOrder.get(p.order_id) ?? 0) + p.amount);
  }

  const ordersWithBalance = (orders ?? []).map((order) => {
    const paid = paidByOrder.get(order.id) ?? 0;
    const balance = Math.max(order.total - paid, 0);
    const items = (order.order_items ?? []) as OrderItemRow[];
    return {
      ...order,
      paid,
      balance,
      itemsSummary: formatOrderItemsSummary(items),
    };
  });

  const totalSpentUsd = ordersWithBalance.reduce(
    (sum, o) => sum + toUsd(o.total, o.currency ?? "USD", o.exchange_rate_to_usd),
    0
  );
  const receivableUsd = ordersWithBalance.reduce(
    (sum, o) => sum + toUsd(o.balance, o.currency ?? "USD", o.exchange_rate_to_usd),
    0
  );
  const activeOrders = ordersWithBalance.filter((o) => !CLOSED_STATUSES.includes(o.status));
  const closedOrders = ordersWithBalance.filter((o) => CLOSED_STATUSES.includes(o.status));
  const currentOrder = ordersWithBalance[0] ?? null;

  /*
   * Órdenes que llegaron del histórico sin plata: existen, tienen prendas y
   * fecha, pero valen 0. Son el trabajo pendiente de digitalización y por eso
   * la tarjeta de órdenes las cuenta arriba en vez de esconderlas en la lista.
   */
  const digitizableOrders = ordersWithBalance.map((order) => ({
    id: order.id,
    orderNumber: order.order_number,
    createdAt: order.created_at,
    statusLabel: ORDER_STATUS_LABELS[order.status],
    itemsSummary: order.itemsSummary,
    currency: (order.currency ?? "USD") as CurrencyCode,
    total: order.total,
    paid: order.paid,
    locationId: order.location_id ?? null,
    assignedStaffId: order.assigned_staff_id ?? null,
    // Las prendas viajan con la orden: digitalizar es ponerles precio a estas,
    // no volver a escribir qué se hizo.
    items: ((order.order_items ?? []) as OrderItemRow[]).map((item) => ({
      id: item.id,
      garmentType: item.garment_type,
      quantity: item.quantity,
      unitPrice: item.unit_price ?? 0,
    })),
  }));
  const pendingDigitization = digitizableOrders.filter((order) => order.total <= 0);

  // Smart defaults para digitalizar: la prenda que más le hace este cliente y
  // el valor de su última orden que sí tiene precio.
  const garmentCounts = new Map<GarmentType, number>();
  for (const order of orders ?? []) {
    for (const item of (order.order_items ?? []) as OrderItemRow[]) {
      garmentCounts.set(item.garment_type, (garmentCounts.get(item.garment_type) ?? 0) + item.quantity);
    }
  }
  const defaultGarmentType =
    [...garmentCounts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? "saco";
  // El último precio por unidad que este cliente pagó: mejor punto de partida
  // que un campo vacío, y más honesto que un total suelto de otra orden.
  const suggestedUnitPrice =
    (orders ?? [])
      .flatMap((order) => (order.order_items ?? []) as OrderItemRow[])
      .find((item) => (item.unit_price ?? 0) > 0)?.unit_price ?? 0;

  const staffOptions = (staffUsers ?? []).map((person) => ({
    id: person.id,
    fullName: person.full_name,
    locationId: person.location_id,
  }));

  const kpis = [
    {
      label: "Total gastado",
      value: `$${totalSpentUsd.toLocaleString("en-US", { maximumFractionDigits: 0 })} USD`,
      sub: `${ordersWithBalance.length} orden${ordersWithBalance.length === 1 ? "" : "es"} en total`,
      icon: WalletIcon,
    },
    {
      label: "Cuentas por cobrar",
      value: `$${receivableUsd.toLocaleString("en-US", { maximumFractionDigits: 0 })} USD`,
      sub: receivableUsd > 0 ? "Saldo pendiente consolidado" : "Al día",
      icon: ReceiptTextIcon,
    },
    {
      label: "Órdenes activas",
      value: activeOrders.length,
      sub: `${closedOrders.length} cerrada${closedOrders.length === 1 ? "" : "s"}`,
      icon: PackageIcon,
    },
    {
      label: "Orden actual",
      value: currentOrder ? currentOrder.order_number : "—",
      sub: currentOrder ? ORDER_STATUS_LABELS[currentOrder.status] : "Sin órdenes",
      icon: ClipboardCheckIcon,
    },
  ];

  return (
    <div className="space-y-6">
      <Link
        href={isTrashed ? "/clients/papelera" : "/clients"}
        className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeftIcon className="size-4" />
        {isTrashed ? "Volver a papelera" : "Volver a clientes"}
      </Link>

      {isTrashed ? (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 py-3">
          <div className="flex items-start gap-3">
            <Trash2Icon className="mt-0.5 size-4 shrink-0 text-amber-600 dark:text-amber-400" />
            <div className="space-y-1">
              <p className="text-sm font-medium">Este cliente está en la papelera</p>
              <p className="text-xs text-muted-foreground">
                No aparece en el directorio activo. Restáuralo para volver a usarlo en órdenes y citas.
              </p>
            </div>
          </div>
          {session.role === "admin" ? (
            <ClientRestoreButton clientId={client.id} clientName={client.full_name} />
          ) : null}
        </div>
      ) : null}

      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="font-heading text-2xl">{client.full_name}</h1>
          <p className="text-sm text-muted-foreground">
            {client.phone} · {client.email ?? "sin correo"} · {location?.name}
          </p>
        </div>
        {!isTrashed ? (
          <Button render={<Link href={`/orders/nueva?clientId=${client.id}`} />}>
            <PlusIcon />
            Nueva orden
          </Button>
        ) : null}
      </div>

      {!isTrashed ? (
        <ClientProfileForm
          key={client.updated_at}
          clientId={client.id}
          defaultValues={{
            fullName: client.full_name,
            phone: client.phone,
            email: client.email ?? "",
            documentId: client.document_id ?? "",
            homeLocationId: client.home_location_id,
            notes: client.notes ?? "",
          }}
          locations={locations ?? []}
        />
      ) : null}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {kpis.map((kpi) => (
          <Card key={kpi.label}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">{kpi.label}</CardTitle>
              <kpi.icon className="size-4 text-accent" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-semibold">{kpi.value}</div>
              <p className="text-xs text-muted-foreground">{kpi.sub}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {!isTrashed ? (
        <ClientMeasurementsPanel clientId={client.id} measurements={profileMeasurements} />
      ) : null}

      <div className="grid grid-cols-1 gap-4">
        <Card>
          <CardHeader>
            <CardTitle>Órdenes</CardTitle>
            <CardDescription>
              {pendingDigitization.length > 0
                ? `${pendingDigitization.length} ${
                    pendingDigitization.length === 1
                      ? "orden sin valor ni pagos registrados"
                      : "órdenes sin valor ni pagos registrados"
                  }. Digitalízalas para que su dinero entre al sistema.`
                : "Todas las órdenes de este cliente tienen su valor registrado."}
            </CardDescription>
            {!isTrashed && ordersWithBalance.length > 0 ? (
              <CardAction>
                <DigitizeOrderDialog
                  clientId={client.id}
                  orders={digitizableOrders}
                  locations={(locations ?? []) as DigitizeLocationOption[]}
                  channels={paymentChannels}
                  defaultLocationId={client.home_location_id}
                  defaultGarmentType={defaultGarmentType}
                  suggestedUnitPrice={suggestedUnitPrice}
                  staff={staffOptions}
                  defaultStaffId={session.userId}
                  triggerVariant={pendingDigitization.length > 0 ? "default" : "outline"}
                />
              </CardAction>
            ) : null}
          </CardHeader>
          <CardContent className="space-y-5">
            {ordersWithBalance.length === 0 ? (
              <div className="flex flex-col items-center gap-3 rounded-lg border border-dashed py-10 text-center">
                <PackageIcon className="size-7 text-muted-foreground" />
                <div className="space-y-1">
                  <p className="font-medium">Sin órdenes todavía</p>
                  <p className="max-w-sm text-sm text-muted-foreground">
                    Si este cliente ya te compró antes, digitaliza esa orden con su pago: queda su
                    historial y el dinero entra al sistema.
                  </p>
                </div>
                <div className="flex flex-wrap items-center justify-center gap-2">
                  <DigitizeOrderDialog
                    clientId={client.id}
                    orders={digitizableOrders}
                    locations={(locations ?? []) as DigitizeLocationOption[]}
                    channels={paymentChannels}
                    defaultLocationId={client.home_location_id}
                    defaultGarmentType={defaultGarmentType}
                    suggestedUnitPrice={suggestedUnitPrice}
                    staff={staffOptions}
                    defaultStaffId={session.userId}
                    triggerLabel="Digitalizar una orden pasada"
                  />
                  <Button size="sm" variant="ghost" render={<Link href={`/orders/nueva?clientId=${client.id}`} />}>
                    Crear orden nueva
                  </Button>
                </div>
              </div>
            ) : (
              <>
                {activeOrders.length > 0 && (
                  <div className="space-y-2">
                    <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">Activas</p>
                    {activeOrders.map((order) => (
                      <OrderRow key={order.id} order={order} />
                    ))}
                  </div>
                )}
                {closedOrders.length > 0 && (
                  <div className="space-y-2">
                    <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">Cerradas</p>
                    {closedOrders.map((order) => (
                      <OrderRow key={order.id} order={order} />
                    ))}
                  </div>
                )}
              </>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Citas recientes</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {!appointments || appointments.length === 0 ? (
            <p className="text-sm text-muted-foreground">Sin citas registradas.</p>
          ) : (
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {appointments.map((appt) => (
                <div key={appt.id} className="flex items-center justify-between rounded-lg border border-border px-3 py-2 text-sm">
                  <span>{new Date(appt.starts_at).toLocaleString("es-CO", { dateStyle: "medium", timeStyle: "short" })}</span>
                  <Badge variant="secondary">{APPOINTMENT_STATUS_LABELS[appt.status]}</Badge>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

    </div>
  );
}

function OrderRow({
  order,
}: {
  order: {
    id: string;
    order_number: string | null;
    status: OrderStatus;
    currency: CurrencyCode | null;
    total: number;
    paid: number;
    balance: number;
    created_at: string;
    itemsSummary: string;
  };
}) {
  return (
    <Link
      href={`/orders/${order.id}`}
      className="flex items-start justify-between gap-3 rounded-lg border border-border px-3 py-2 text-sm hover:border-primary/40 hover:bg-primary/5"
    >
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-medium">{order.order_number}</span>
          <Badge variant="secondary">{ORDER_STATUS_LABELS[order.status]}</Badge>
        </div>
        <p className="mt-0.5 text-xs text-muted-foreground">
          {formatOrderDate(order.created_at)} · {order.itemsSummary}
        </p>
      </div>
      <span className="flex shrink-0 flex-col items-end gap-0.5 text-right">
        {order.total > 0 ? (
          <span className="tabular-nums">{formatCurrency(order.total, order.currency ?? "USD")}</span>
        ) : (
          /* $0.00 se lee como "gratis"; lo que pasa es que nadie le ha puesto valor. */
          <span className="text-xs text-muted-foreground">Sin valor</span>
        )}
        {order.balance > 0 && order.total > 0 && (
          <span className="tabular-nums text-xs text-primary">
            Debe {formatCurrency(order.balance, order.currency ?? "USD")}
          </span>
        )}
      </span>
    </Link>
  );
}
