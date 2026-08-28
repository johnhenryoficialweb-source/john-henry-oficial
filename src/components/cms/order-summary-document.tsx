"use client";

import { useState } from "react";
import { toast } from "sonner";
import { HeartIcon, MailIcon, PrinterIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { GARMENT_TYPE_LABELS } from "@/lib/constants";
import { formatCurrency } from "@/lib/currency/exchange";
import {
  sendOrderSummaryEmail,
  sendOrderThankYouEmail,
} from "@/app/(cms)/(protected)/orders/actions";
import type { CurrencyCode, GarmentType } from "@/types/database.types";

export interface OrderSummaryItem {
  id: string;
  garmentType: GarmentType;
  fabricName: string | null;
  modelName: string | null;
  quantity: number;
  unitPrice: number;
  lineTotal: number;
  notes?: string | null;
}

export interface OrderSummaryDocumentProps {
  orderId: string;
  orderNumber: string;
  createdAt: string;
  expectedDeliveryDate: string | null;
  clientName: string;
  clientPhone: string;
  locationName: string;
  currency: CurrencyCode;
  subtotal: number;
  discount: number;
  total: number;
  totalPaid: number;
  balance: number;
  notes: string | null;
  items: OrderSummaryItem[];
}

/**
 * Resumen imprimible/enviable de la orden para el cliente: qué se pidió,
 * estilo y totales. Sin medidas corporales ni silueta 3D.
 */
export function OrderSummaryDocument({
  orderId,
  orderNumber,
  createdAt,
  expectedDeliveryDate,
  clientName,
  clientPhone,
  locationName,
  currency,
  subtotal,
  discount,
  total,
  totalPaid,
  balance,
  notes,
  items,
}: OrderSummaryDocumentProps) {
  const [sending, setSending] = useState(false);
  const [sendingThanks, setSendingThanks] = useState(false);

  const formattedDate = new Date(createdAt).toLocaleDateString("es-CO", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
  const formattedDelivery = expectedDeliveryDate
    ? new Date(expectedDeliveryDate).toLocaleDateString("es-CO", {
        day: "numeric",
        month: "long",
        year: "numeric",
      })
    : null;

  async function handleSendEmail() {
    setSending(true);
    try {
      await sendOrderSummaryEmail(orderId);
      toast.success("Resumen enviado por correo");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "No se pudo enviar el resumen.");
    } finally {
      setSending(false);
    }
  }

  async function handleSendThankYou() {
    setSendingThanks(true);
    try {
      await sendOrderThankYouEmail(orderId);
      toast.success("Agradecimiento enviado por correo");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "No se pudo enviar el agradecimiento.");
    } finally {
      setSendingThanks(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between print:hidden">
        <p className="text-sm text-muted-foreground">Resumen para el cliente</p>
        <div className="flex gap-2">
          {/* Reenvío del agradecimiento: el automático sale al crear la orden,
              pero a veces no llega. Va como acción terciaria — es el gesto,
              no el documento. */}
          <Button
            type="button"
            variant="ghost"
            size="sm"
            disabled={sendingThanks}
            onClick={handleSendThankYou}
            title="Reenvía el correo de agradecimiento por la compra (sin medidas ni precios)"
          >
            <HeartIcon />
            {sendingThanks ? "Enviando…" : "Agradecimiento"}
          </Button>
          <Button type="button" variant="outline" size="sm" disabled={sending} onClick={handleSendEmail}>
            <MailIcon />
            {sending ? "Enviando…" : "Enviar por correo"}
          </Button>
          <Button type="button" size="sm" onClick={() => window.print()}>
            <PrinterIcon />
            Descargar PDF
          </Button>
        </div>
      </div>

      <div className="order-summary-sheet flex min-h-0 flex-col overflow-hidden rounded-2xl border border-primary/20 bg-card print:min-h-[10in] print:w-full print:overflow-visible print:rounded-none print:border-0 print:shadow-none">
        <header className="shrink-0 border-b border-primary/20 bg-gradient-to-b from-primary/10 to-transparent px-8 py-10 text-center print:py-6">
          <p className="text-xs uppercase tracking-[0.4em] text-primary">JOHN HENRY</p>
          <p className="mt-2 font-heading text-3xl print:text-2xl">Resumen de Orden</p>
          <p className="mt-2 text-xs uppercase tracking-[0.2em] text-muted-foreground">{orderNumber}</p>
        </header>

        <div className="flex flex-1 flex-col p-8 print:p-6">
          <div className="order-summary-body flex-1 space-y-6">
            <dl className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm md:grid-cols-3 print:grid-cols-3">
              <SummaryField label="Cliente" value={clientName} />
              <SummaryField label="Teléfono" value={clientPhone} />
              <SummaryField label="Sede" value={locationName} />
              <SummaryField label="Fecha" value={formattedDate} />
              {formattedDelivery && <SummaryField label="Entrega estimada" value={formattedDelivery} />}
            </dl>

            <div className="h-px bg-primary/15" />

            <div className="space-y-5">
              {items.map((item) => (
                <div key={item.id} className="order-summary-item break-inside-avoid">
                  <div className="flex items-baseline justify-between">
                    <p className="font-heading text-lg print:text-base">{GARMENT_TYPE_LABELS[item.garmentType]}</p>
                    <p className="tabular-nums text-sm">{formatCurrency(item.lineTotal, currency)}</p>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {item.fabricName ?? "Tela por definir"}
                    {item.modelName && ` · ${item.modelName}`} · {item.quantity} ×{" "}
                    {formatCurrency(item.unitPrice, currency)}
                  </p>
                  {item.notes && (
                    <p className="mt-2 text-xs whitespace-pre-line text-muted-foreground">{item.notes}</p>
                  )}
                </div>
              ))}
            </div>
          </div>

          <footer className="order-summary-footer mt-auto shrink-0 space-y-4 pt-6 print:pt-8">
            <div className="h-px bg-primary/15" />

            <div className="space-y-1.5 text-sm">
              <div className="flex justify-between text-muted-foreground">
                <span>Subtotal</span>
                <span className="tabular-nums">{formatCurrency(subtotal, currency)}</span>
              </div>
              {discount > 0 && (
                <div className="flex justify-between text-muted-foreground">
                  <span>Descuento</span>
                  <span className="tabular-nums">-{formatCurrency(discount, currency)}</span>
                </div>
              )}
              <div className="flex justify-between font-heading text-xl print:text-lg">
                <span>Total</span>
                <span className="tabular-nums text-primary">{formatCurrency(total, currency)}</span>
              </div>
              <div className="flex justify-between text-muted-foreground">
                <span>Pagado</span>
                <span className="tabular-nums">{formatCurrency(totalPaid, currency)}</span>
              </div>
              <div className="flex justify-between font-medium">
                <span>Saldo pendiente</span>
                <span className="tabular-nums">{formatCurrency(balance, currency)}</span>
              </div>
            </div>

            {notes && <p className="text-xs text-muted-foreground italic">&ldquo;{notes}&rdquo;</p>}

            <div className="border-t border-primary/20 pt-4 text-center text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
              Sastrería Privada · Bogotá · Ciudad de Panamá
            </div>
          </footer>
        </div>
      </div>
    </div>
  );
}

function SummaryField({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">{label}</p>
      <p className="mt-0.5">{value}</p>
    </div>
  );
}
