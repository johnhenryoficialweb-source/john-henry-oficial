import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getStaffSession } from "@/lib/auth/roles";
import {
  addOrderItem,
  registerPayment,
  removeOrderItem,
  updateOrderPricing,
  updateOrderStatus,
  updatePaymentDate,
} from "../actions";
import { formatCurrency } from "@/lib/currency/exchange";
import { parseAmount } from "@/lib/currency/parse";
import { formatPhoneDisplay } from "@/lib/phone/format";
import { getPaymentChannels } from "@/lib/finance/payment-channels";
import { BackToOrdersLink } from "@/components/cms/back-to-orders-link";
import { OrderStatusPipeline } from "@/components/cms/order-status-pipeline";
import { OrderEditor, type EditableOrderItem } from "@/components/cms/order-editor";
import { OrderSummaryDocument, type OrderSummaryItem } from "@/components/cms/order-summary-document";
import { WorkshopOrderCard } from "@/components/cms/workshop-order-card";
import { RegisterPaymentForm } from "@/components/finance/register-payment-form";
import { PaymentLedgerRow } from "@/components/finance/payment-ledger-row";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { GarmentType, OrderStatus } from "@/types/database.types";

export const dynamic = "force-dynamic";

export default async function OrderDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  // Corregir la fecha de un cobro mueve el mes contable: solo admin (RLS 0015).
  const session = await getStaffSession();
  const isAdmin = session?.role === "admin";

  const { data: order } = await supabase
    .from("orders")
    .select("*, clients(id, full_name, phone, locations(name, code)), locations(name)")
    .eq("id", id)
    .single();

  if (!order) notFound();

  const [{ data: items }, { data: payments }, channels, { data: staff }] = await Promise.all([
    supabase
      .from("order_items")
      .select("*, fabrics(name, code), garment_models(name)")
      .eq("order_id", id),
    supabase.from("payments").select("*").eq("order_id", id).order("paid_at", { ascending: false }),
    getPaymentChannels({ locationId: order.location_id }),
    supabase
      .from("staff_users")
      .select("id, full_name")
      .eq("is_active", true)
      .order("full_name"),
  ]);

  const channelById = new Map(channels.map((channel) => [channel.id, channel.name]));
  const totalFees = (payments ?? []).reduce((sum, p) => sum + (p.fee_amount ?? 0), 0);

  const client = order.clients as unknown as {
    id: string;
    full_name: string;
    phone: string;
    locations: { name: string; code: string } | null;
  } | null;
  const location = order.locations as unknown as { name: string } | null;
  const clientLocationCode = client?.locations?.code ?? null;
  const clientPhone = client?.phone
    ? formatPhoneDisplay(client.phone, clientLocationCode).formatted
    : "";
  const totalPaid = (payments ?? []).reduce((sum, p) => sum + p.amount, 0);
  const balance = order.total - totalPaid;
  const currency = order.currency ?? "USD";

  const summaryItems: OrderSummaryItem[] = (items ?? []).map((item) => {
    const fabric = item.fabrics as unknown as { name: string; code: string | null } | null;
    const model = item.garment_models as unknown as { name: string } | null;
    return {
      id: item.id,
      garmentType: item.garment_type,
      fabricName: fabric?.name ?? null,
      modelName: model?.name ?? null,
      quantity: item.quantity,
      unitPrice: item.unit_price,
      lineTotal: item.line_total,
      notes: item.notes ?? null,
    };
  });

  const editableItems: EditableOrderItem[] = (items ?? []).map((item) => {
    const fabric = item.fabrics as unknown as { name: string } | null;
    const model = item.garment_models as unknown as { name: string } | null;
    return {
      id: item.id,
      garmentType: item.garment_type,
      fabricName: fabric?.name ?? null,
      modelName: model?.name ?? null,
      quantity: item.quantity,
      unitPrice: item.unit_price,
      notes: item.notes ?? null,
    };
  });

  const staffOptions = (staff ?? []).map((member) => ({
    id: member.id,
    fullName: member.full_name,
  }));

  async function handleStatusChange(status: OrderStatus) {
    "use server";
    await updateOrderStatus(id, status);
  }

  async function handleRegisterPayment(formData: FormData) {
    "use server";
    await registerPayment(id, formData);
  }

  /*
   * Las filas del editor llegan como arreglos paralelos (`itemId[]`,
   * `quantity[]`, `unitPrice[]`) porque los inputs comparten nombre dentro del
   * mismo form. `getAll` conserva el orden del DOM, así que el índice une las
   * tres listas.
   */
  async function handleSaveOrder(formData: FormData) {
    "use server";
    const itemIds = formData.getAll("itemId").map(String);
    const quantities = formData.getAll("quantity").map(String);
    const prices = formData.getAll("unitPrice").map(String);

    await updateOrderPricing({
      orderId: id,
      items: itemIds.map((itemId, index) => ({
        id: itemId,
        quantity: Math.trunc(parseAmount(quantities[index])) || 1,
        unitPrice: parseAmount(prices[index]),
      })),
      discount: parseAmount(String(formData.get("discount") ?? "")),
      expectedDeliveryDate: String(formData.get("expectedDeliveryDate") ?? "") || null,
      assignedStaffId: String(formData.get("assignedStaffId") ?? "") || null,
    });
  }

  async function handleAddItem(formData: FormData) {
    "use server";
    await addOrderItem({
      orderId: id,
      garmentType: String(formData.get("garmentType") ?? "otro") as GarmentType,
      quantity: Math.trunc(parseAmount(String(formData.get("quantity") ?? ""))) || 1,
      unitPrice: parseAmount(String(formData.get("unitPrice") ?? "")),
      notes: String(formData.get("notes") ?? ""),
    });
  }

  async function handleRemoveItem(itemId: string) {
    "use server";
    await removeOrderItem(id, itemId);
  }

  async function handleUpdatePaymentDate(paymentId: string, formData: FormData) {
    "use server";
    await updatePaymentDate(paymentId, id, formData);
  }

  return (
    <div className="max-w-3xl space-y-6">
      <BackToOrdersLink />

      <div className="print:hidden">
        <OrderStatusPipeline currentStatus={order.status} onChange={handleStatusChange} />
      </div>

      <OrderSummaryDocument
        orderId={order.id}
        orderNumber={order.order_number ?? order.id}
        createdAt={order.created_at}
        expectedDeliveryDate={order.expected_delivery_date}
        clientName={client?.full_name ?? ""}
        clientPhone={clientPhone}
        locationName={location?.name ?? ""}
        currency={currency}
        subtotal={order.subtotal}
        discount={order.discount}
        total={order.total}
        totalPaid={totalPaid}
        balance={balance}
        notes={order.notes}
        items={summaryItems}
      />

      <OrderEditor
        orderId={order.id}
        currency={currency}
        items={editableItems}
        discount={order.discount}
        expectedDeliveryDate={order.expected_delivery_date}
        assignedStaffId={order.assigned_staff_id}
        staffOptions={staffOptions}
        totalPaid={totalPaid}
        isUnpriced={order.total === 0}
        onSave={handleSaveOrder}
        onAddItem={handleAddItem}
        onRemoveItem={handleRemoveItem}
      />

      <WorkshopOrderCard orderId={order.id} />

      <Card className="print:hidden">
        <CardHeader>
          <CardTitle>Registrar pago</CardTitle>
        </CardHeader>
        <CardContent>
          <RegisterPaymentForm
            channels={channels}
            currency={currency}
            balance={Math.max(balance, 0)}
            onSubmit={handleRegisterPayment}
          />

          {payments && payments.length > 0 && (
            <div className="mt-4 border-t pt-3">
              <div className="mb-1 flex items-baseline justify-between gap-3 text-xs text-muted-foreground">
                <span>
                  {payments.length} {payments.length === 1 ? "cobro" : "cobros"}
                </span>
                {totalFees > 0 ? (
                  <span className="tabular-nums">
                    Comisiones del periodo: − {formatCurrency(totalFees, currency)} · entró{" "}
                    {formatCurrency(totalPaid - totalFees, currency)} de {formatCurrency(totalPaid, currency)}
                  </span>
                ) : null}
              </div>

              {payments.map((p) => (
                <PaymentLedgerRow
                  key={p.id}
                  canEditDate={isAdmin}
                  payment={{
                    id: p.id,
                    paidAt: p.paid_at,
                    channelName: channelById.get(p.channel_id ?? "") ?? null,
                    amount: p.amount,
                    feeAmount: p.fee_amount,
                    feePercent: p.fee_percent,
                    netAmount: p.net_amount,
                    currency: p.currency,
                    reference: p.reference,
                  }}
                  onUpdateDate={handleUpdatePaymentDate.bind(null, p.id)}
                />
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
