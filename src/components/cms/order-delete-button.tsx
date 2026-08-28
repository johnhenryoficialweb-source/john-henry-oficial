"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { toast } from "sonner";
import { Loader2Icon, Trash2Icon } from "lucide-react";
import { moveOrderToTrash } from "@/app/(cms)/(protected)/orders/actions";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { formatCurrency } from "@/lib/currency/exchange";
import type { CurrencyCode } from "@/types/database.types";

/**
 * Regla UX #9 (aversión a la pérdida): el diálogo dice qué se lleva la acción,
 * no solo pregunta si estás seguro.
 *
 * Importa nombrar lo que NO se pierde. La duda real al mandar una orden a la
 * papelera es si con ella se van las medidas del cliente —el único dato que no
 * se puede volver a levantar sin volver a medir a la persona— y la respuesta es
 * que no: las medidas cuelgan del cliente, no de la orden.
 */
export function OrderDeleteButton({
  orderId,
  orderNumber,
  total,
  currency,
  paidTotal,
}: {
  orderId: string;
  orderNumber: string;
  total: number;
  currency: CurrencyCode;
  paidTotal: number;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();

  function handleDelete() {
    startTransition(async () => {
      try {
        await moveOrderToTrash(orderId);
        toast.success(`${orderNumber} movida a la papelera`);
        setOpen(false);
        router.refresh();
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "No se pudo mover a la papelera");
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            className="text-muted-foreground hover:text-destructive"
            aria-label={`Mover a papelera la orden ${orderNumber}`}
          />
        }
      >
        <Trash2Icon className="size-4" />
      </DialogTrigger>

      <DialogContent showCloseButton={!isPending}>
        <DialogHeader>
          <DialogTitle>Mover {orderNumber} a la papelera</DialogTitle>
          <DialogDescription>
            La orden sale de los listados y deja de sumar en el panel financiero. Podrás
            recuperarla desde la papelera.
          </DialogDescription>
        </DialogHeader>

        <ul className="list-disc space-y-1 pl-5 text-sm text-muted-foreground">
          <li>
            Deja de contar {formatCurrency(total, currency)} en el facturado
            {paidTotal > 0 ? ` y ${formatCurrency(paidTotal, currency)} ya cobrados` : ""}.
          </li>
          <li>Las medidas del cliente no se tocan: quedan en su ficha.</li>
          <li>Los datos personales del cliente no se tocan.</li>
        </ul>

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => setOpen(false)}
            disabled={isPending}
          >
            Cancelar
          </Button>
          <Button
            type="button"
            variant="destructive"
            onClick={handleDelete}
            disabled={isPending}
          >
            {isPending ? (
              <>
                <Loader2Icon className="size-4 animate-spin" />
                Moviendo…
              </>
            ) : (
              "Mover a papelera"
            )}
          </Button>
        </DialogFooter>

        <p className="text-xs text-muted-foreground">
          Recuperar en{" "}
          <Link
            href="/orders/papelera"
            className="underline underline-offset-2 hover:text-foreground"
          >
            Órdenes → Papelera
          </Link>
          .
        </p>
      </DialogContent>
    </Dialog>
  );
}
