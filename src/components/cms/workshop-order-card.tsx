"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { CheckCircle2Icon, Loader2Icon, PrinterIcon, SendIcon, XCircleIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { resendWorkshopOrder } from "@/app/(cms)/(protected)/orders/actions";

interface SendOutcome {
  email: string;
  roleLabel: string;
  ok: boolean;
  error?: string;
}

/**
 * Acceso al documento de taller desde la ficha de la orden.
 *
 * El reenvío reporta destinatario por destinatario en vez de un "enviado" a
 * secas, porque la pregunta real cuando alguien pulsa este botón es "¿le llegó
 * al sastre?", y esa pregunta no la contesta un toast verde.
 */
export function WorkshopOrderCard({ orderId }: { orderId: string }) {
  const [outcome, setOutcome] = useState<SendOutcome[] | null>(null);
  const [isPending, startTransition] = useTransition();

  function resend() {
    startTransition(async () => {
      try {
        const result = await resendWorkshopOrder(orderId);
        setOutcome(result.recipients);

        if (result.failed === 0) {
          toast.success(
            `Orden de trabajo enviada a ${result.sent} ${result.sent === 1 ? "destinatario" : "destinatarios"}.`,
          );
        } else {
          toast.error(`${result.failed} de ${result.recipients.length} envíos fallaron.`);
        }
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "No se pudo enviar.");
      }
    });
  }

  return (
    <Card className="print:hidden">
      <CardHeader>
        <CardTitle>Orden de trabajo</CardTitle>
        <CardDescription>
          El documento del taller: prenda, tela, especificación y medidas. Sin teléfono, sin cédula
          y sin valores — se puede entregar impreso o mandar a un proveedor externo.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <Button size="sm" render={<Link href={`/orders/${orderId}/orden-taller`} />}>
            <PrinterIcon className="size-4" />
            Ver e imprimir
          </Button>
          <Button variant="outline" size="sm" onClick={resend} disabled={isPending}>
            {isPending ? (
              <Loader2Icon className="size-4 animate-spin" />
            ) : (
              <SendIcon className="size-4" />
            )}
            Reenviar al taller
          </Button>
        </div>

        {outcome ? (
          <ul className="space-y-1 rounded-md border p-3">
            {outcome.map((item) => (
              <li key={item.email} className="flex items-start gap-2 text-xs">
                {item.ok ? (
                  <CheckCircle2Icon className="mt-0.5 size-3 shrink-0 text-emerald-500" />
                ) : (
                  <XCircleIcon className="mt-0.5 size-3 shrink-0 text-destructive" />
                )}
                <span className={item.ok ? "" : "text-destructive"}>
                  <span className="text-muted-foreground">{item.roleLabel}:</span> {item.email}
                  {item.error ? <span className="block opacity-80">{item.error}</span> : null}
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-xs text-muted-foreground">
            Se envía sola al crear y al confirmar la orden.{" "}
            <Link href="/correos/destinatarios" className="underline underline-offset-2">
              Ver quién la recibe
            </Link>
            .
          </p>
        )}
      </CardContent>
    </Card>
  );
}
