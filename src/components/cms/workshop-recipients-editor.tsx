"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Loader2Icon, PlusIcon, Trash2Icon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { WORKSHOP_ROLE_LABELS, type WorkshopRecipient } from "@/lib/orders/workshop-labels";
import {
  createWorkshopRecipient,
  deleteWorkshopRecipient,
  toggleWorkshopRecipient,
} from "@/app/(cms)/(protected)/correos/actions";
import type { WorkshopRecipientRole } from "@/types/database.types";

const ROLES: WorkshopRecipientRole[] = ["tailor", "sales", "fabric_supplier"];

const ROLE_HINT: Record<WorkshopRecipientRole, string> = {
  tailor: "Corta y confecciona. Es quien más necesita el documento.",
  sales: "Además del vendedor que registró la orden, que siempre lo recibe.",
  fabric_supplier: "Recibe el detalle de tela para gestionar la compra.",
};

export interface RecipientLocationOption {
  id: string;
  name: string;
}

export function WorkshopRecipientsEditor({
  recipients,
  locations,
  canEdit,
}: {
  recipients: WorkshopRecipient[];
  locations: RecipientLocationOption[];
  canEdit: boolean;
}) {
  const byRole = ROLES.map((role) => ({
    role,
    items: recipients.filter((recipient) => recipient.role === role),
  }));

  return (
    <div className="space-y-6">
      {byRole.map(({ role, items }) => (
        <div key={role} className="space-y-2">
          <div>
            <p className="text-sm font-medium">{WORKSHOP_ROLE_LABELS[role]}</p>
            <p className="text-xs text-muted-foreground">{ROLE_HINT[role]}</p>
          </div>

          {items.length === 0 ? (
            <p className="rounded-md border border-dashed px-3 py-2.5 text-xs text-muted-foreground">
              Nadie configurado con este rol todavía.
            </p>
          ) : (
            <ul className="divide-y divide-border/60 rounded-md border">
              {items.map((recipient) => (
                <RecipientRow
                  key={recipient.id}
                  recipient={recipient}
                  locationName={
                    locations.find((location) => location.id === recipient.locationId)?.name ?? null
                  }
                  canEdit={canEdit}
                />
              ))}
            </ul>
          )}
        </div>
      ))}

      {canEdit ? (
        <NewRecipientForm locations={locations} />
      ) : (
        <p className="text-xs text-muted-foreground">
          Solo un administrador puede cambiar quién recibe las medidas de un cliente.
        </p>
      )}
    </div>
  );
}

function RecipientRow({
  recipient,
  locationName,
  canEdit,
}: {
  recipient: WorkshopRecipient;
  locationName: string | null;
  canEdit: boolean;
}) {
  const [isPending, startTransition] = useTransition();
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  function toggle() {
    startTransition(async () => {
      try {
        await toggleWorkshopRecipient(recipient.id, !recipient.isActive);
        toast.success(recipient.isActive ? "Dejó de recibir." : "Vuelve a recibir.");
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "No se pudo cambiar.");
      }
    });
  }

  function remove() {
    startTransition(async () => {
      try {
        await deleteWorkshopRecipient(recipient.id);
        toast.success(`${recipient.name} ya no recibe órdenes de trabajo.`);
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "No se pudo eliminar.");
      }
    });
  }

  return (
    <li className={cn("flex flex-wrap items-center gap-3 p-3", !recipient.isActive && "opacity-60")}>
      <div className="min-w-0 flex-1">
        <p className="flex flex-wrap items-center gap-2 text-sm">
          {recipient.name}
          <Badge variant="outline" className="text-[10px]">
            {locationName ?? "Todas las sedes"}
          </Badge>
          {!recipient.isActive ? (
            <Badge variant="secondary" className="text-[10px]">
              Pausado
            </Badge>
          ) : null}
        </p>
        <p className="truncate text-xs text-muted-foreground">{recipient.email}</p>
        {recipient.notes ? (
          <p className="truncate text-xs text-muted-foreground/70">{recipient.notes}</p>
        ) : null}
      </div>

      {canEdit ? (
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="sm" onClick={toggle} disabled={isPending}>
            {isPending ? <Loader2Icon className="size-3.5 animate-spin" /> : null}
            {recipient.isActive ? "Pausar" : "Reactivar"}
          </Button>

          {/*
            Regla 9 — el borrado dice qué implica antes de ocurrir. Pausar es
            reversible y está ahí al lado; eliminar no lo es.
          */}
          {confirmingDelete ? (
            <span className="flex items-center gap-1">
              <Button variant="destructive" size="sm" onClick={remove} disabled={isPending}>
                Eliminar
              </Button>
              <Button variant="ghost" size="sm" onClick={() => setConfirmingDelete(false)}>
                Cancelar
              </Button>
            </span>
          ) : (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setConfirmingDelete(true)}
              title="Eliminar definitivamente. Si es temporal, usa Pausar."
            >
              <Trash2Icon className="size-3.5" />
            </Button>
          )}
        </div>
      ) : null}
    </li>
  );
}

function NewRecipientForm({ locations }: { locations: RecipientLocationOption[] }) {
  const [isPending, startTransition] = useTransition();
  const [open, setOpen] = useState(false);

  function submit(formData: FormData) {
    startTransition(async () => {
      try {
        await createWorkshopRecipient(formData);
        toast.success("Destinatario agregado. Recibirá las próximas órdenes de trabajo.");
        setOpen(false);
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "No se pudo agregar.");
      }
    });
  }

  if (!open) {
    return (
      <Button variant="outline" size="sm" onClick={() => setOpen(true)}>
        <PlusIcon className="size-4" />
        Agregar destinatario
      </Button>
    );
  }

  return (
    <form action={submit} className="space-y-3 rounded-lg border p-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="wr-name">Nombre</Label>
          <Input id="wr-name" name="name" placeholder="Don Julio" required />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="wr-email">Correo</Label>
          <Input id="wr-email" name="email" type="email" placeholder="taller@ejemplo.com" required />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="wr-role">Rol</Label>
          <select
            id="wr-role"
            name="role"
            // Smart default: el sastre es el destinatario que casi siempre se
            // está agregando, y el que hace falta para que el flujo sirva.
            defaultValue="tailor"
            className="h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm shadow-xs"
          >
            {ROLES.map((role) => (
              <option key={role} value={role}>
                {WORKSHOP_ROLE_LABELS[role]}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="wr-location">Sede</Label>
          <select
            id="wr-location"
            name="locationId"
            className="h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm shadow-xs"
          >
            <option value="">Todas las sedes</option>
            {locations.map((location) => (
              <option key={location.id} value={location.id}>
                {location.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="wr-notes">Nota (opcional)</Label>
        <Input id="wr-notes" name="notes" placeholder="Taller de sacos — solo lunes a viernes" />
      </div>

      <div className="flex items-center gap-2">
        <Button type="submit" size="sm" disabled={isPending}>
          {isPending ? <Loader2Icon className="size-4 animate-spin" /> : null}
          Agregar
        </Button>
        <Button type="button" variant="ghost" size="sm" onClick={() => setOpen(false)}>
          Cancelar
        </Button>
      </div>
    </form>
  );
}
