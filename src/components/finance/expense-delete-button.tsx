"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2Icon, Trash2Icon } from "lucide-react";
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
import { deleteExpense } from "@/app/(cms)/(protected)/finance/actions";

/**
 * Regla UX #9 (Loss Aversion): no pregunta "¿desea eliminar?" — dice qué se
 * pierde, por cuánto, y que no hay papelera para este registro.
 */
export function ExpenseDeleteButton({
  expenseId,
  description,
  amountLabel,
  isGenerated,
}: {
  expenseId: string;
  description: string;
  amountLabel: string;
  isGenerated: boolean;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();

  function handleDelete() {
    startTransition(async () => {
      try {
        await deleteExpense(expenseId);
        toast.success(`Salida eliminada · ${amountLabel}`);
        setOpen(false);
        router.refresh();
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "No se pudo eliminar la salida.");
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
            aria-label={`Eliminar salida ${description}`}
          />
        }
      >
        <Trash2Icon className="size-4" />
      </DialogTrigger>
      <DialogContent showCloseButton={!isPending}>
        <DialogHeader>
          <DialogTitle>Eliminar esta salida</DialogTitle>
          <DialogDescription>
            Se borrará «{description}» por {amountLabel}. El resultado del periodo y el consolidado
            por sede se recalcularán al instante.
          </DialogDescription>
        </DialogHeader>
        <p className="text-sm text-muted-foreground">
          Las salidas no tienen papelera: esta acción no se puede deshacer.
          {isGenerated &&
            " Al venir de una salida fija, podrás volver a generarla desde el panel este mismo mes."}
        </p>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => setOpen(false)} disabled={isPending}>
            Conservar
          </Button>
          <Button type="button" variant="destructive" onClick={handleDelete} disabled={isPending}>
            {isPending ? (
              <>
                <Loader2Icon className="size-4 animate-spin" />
                Eliminando…
              </>
            ) : (
              "Eliminar salida"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
