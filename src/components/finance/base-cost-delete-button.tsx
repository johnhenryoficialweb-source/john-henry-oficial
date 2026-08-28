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
import { deleteBaseCost } from "@/app/(cms)/(protected)/finance/actions";

export function BaseCostDeleteButton({
  costId,
  scopeLabel,
  amountLabel,
}: {
  costId: string;
  scopeLabel: string;
  amountLabel: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();

  function handleDelete() {
    startTransition(async () => {
      try {
        await deleteBaseCost(costId);
        toast.success("Costo base eliminado");
        setOpen(false);
        router.refresh();
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "No se pudo eliminar el costo.");
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
            aria-label={`Eliminar costo base de ${scopeLabel}`}
          />
        }
      >
        <Trash2Icon className="size-4" />
      </DialogTrigger>
      <DialogContent showCloseButton={!isPending}>
        <DialogHeader>
          <DialogTitle>Eliminar este costo base</DialogTitle>
          <DialogDescription>
            {scopeLabel} · {amountLabel}
          </DialogDescription>
        </DialogHeader>
        <p className="text-sm text-muted-foreground">
          Las órdenes ya registradas conservan el costo con el que se crearon: su margen no cambia.
          Las piezas nuevas de este alcance pasarán a costar 0 hasta que cargues otro costo, y el
          margen que muestre el panel quedará inflado.
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
              "Eliminar costo"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
