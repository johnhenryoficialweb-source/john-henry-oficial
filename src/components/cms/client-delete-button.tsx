"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { toast } from "sonner";
import { Loader2Icon, Trash2Icon } from "lucide-react";
import {
  deleteClient,
  getClientDeletionBlockers,
  type ClientDeletionBlockers,
} from "@/app/(cms)/(protected)/clients/actions";
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

export function ClientDeleteButton({
  clientId,
  clientName,
}: {
  clientId: string;
  clientName: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [loadingBlockers, setLoadingBlockers] = useState(false);
  const [blockers, setBlockers] = useState<ClientDeletionBlockers | null>(null);
  const [isPending, startTransition] = useTransition();

  const hasHistory =
    blockers != null && (blockers.ordersCount > 0 || blockers.appointmentsCount > 0);

  async function loadBlockers() {
    setLoadingBlockers(true);
    try {
      const info = await getClientDeletionBlockers(clientId);
      setBlockers(info);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "No se pudo cargar la información");
      setOpen(false);
    } finally {
      setLoadingBlockers(false);
    }
  }

  function handleOpenChange(next: boolean) {
    setOpen(next);
    if (next) {
      setBlockers(null);
      void loadBlockers();
    }
  }

  function handleDelete() {
    startTransition(async () => {
      try {
        const name = await deleteClient(clientId);
        toast.success(`${name} movido a la papelera`);
        setOpen(false);
        router.refresh();
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "No se pudo mover a la papelera");
      }
    });
  }

  const displayName = blockers?.fullName ?? clientName;

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger
        render={
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            className="text-muted-foreground hover:text-destructive"
            aria-label={`Mover a papelera ${clientName}`}
          />
        }
      >
        <Trash2Icon className="size-4" />
      </DialogTrigger>
      <DialogContent showCloseButton={!isPending}>
        <DialogHeader>
          <DialogTitle>Mover a papelera</DialogTitle>
          <DialogDescription>
            {loadingBlockers
              ? "Revisando historial asociado…"
              : `Se ocultará a ${displayName} del directorio de clientes. Podrás recuperarlo desde la papelera si fue un error.`}
          </DialogDescription>
        </DialogHeader>
        {hasHistory && !loadingBlockers ? (
          <div className="space-y-2 text-sm text-muted-foreground">
            <p>Este cliente conservará su historial en el sistema:</p>
            <ul className="list-disc space-y-1 pl-5">
              {blockers.ordersCount > 0 && (
                <li>
                  {blockers.ordersCount} orden{blockers.ordersCount === 1 ? "" : "es"}
                </li>
              )}
              {blockers.appointmentsCount > 0 && (
                <li>
                  {blockers.appointmentsCount} cita{blockers.appointmentsCount === 1 ? "" : "s"}
                </li>
              )}
            </ul>
          </div>
        ) : null}
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => setOpen(false)} disabled={isPending}>
            Cancelar
          </Button>
          <Button
            type="button"
            variant="destructive"
            onClick={handleDelete}
            disabled={loadingBlockers || isPending}
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
        {!loadingBlockers ? (
          <p className="text-xs text-muted-foreground">
            Recuperar en{" "}
            <Link href="/clients/papelera" className="underline underline-offset-2 hover:text-foreground">
              Clientes → Papelera
            </Link>
            .
          </p>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
