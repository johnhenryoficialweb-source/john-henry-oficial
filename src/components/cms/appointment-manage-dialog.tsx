"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { toast } from "sonner";
import { CheckIcon, ExternalLinkIcon, Loader2Icon } from "lucide-react";
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
import { APPOINTMENT_STATUS_LABELS } from "@/lib/constants";
import { AGENDA_TIME_ZONE, LOCATION_ACCENT } from "@/config/locations";
import { zonedTimeToUtc } from "@/lib/datetime/timezone";
import type { AgendaAppointment } from "./agenda-views";

/**
 * Valor para `<input type="datetime-local">` a partir de un instante, en la
 * zona de la agenda.
 *
 * No se usa `toISOString().slice(0,16)` (daría UTC) ni se deja que el input
 * herede la zona del navegador: la cita ocurre en la hora de la sede, y un
 * sastre revisando la agenda desde otro huso vería —y guardaría— una hora
 * distinta de la real.
 */
function toLocalInputValue(iso: string): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: AGENDA_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(new Date(iso));
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "";
  return `${get("year")}-${get("month")}-${get("day")}T${get("hour")}:${get("minute")}`;
}

export function AppointmentManageDialog({
  appointment,
  children,
}: {
  appointment: AgendaAppointment;
  children: React.ReactNode;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState<null | "confirm" | "reschedule" | "cancel">(null);
  const [confirmingCancel, setConfirmingCancel] = useState(false);
  // Smart default: la cita ya tiene fecha y hora. Arrancar vacío obligaría a
  // reescribir desde cero algo que el sistema ya sabe.
  const [whenLocal, setWhenLocal] = useState(() => toLocalInputValue(appointment.starts_at));

  const closed = appointment.status === "cancelled" || appointment.status === "completed";
  const currentLocal = toLocalInputValue(appointment.starts_at);
  const moved = whenLocal !== currentLocal;

  function done(message: string) {
    toast.success(message);
    setOpen(false);
    setConfirmingCancel(false);
    router.refresh();
  }

  async function setStatus(status: string) {
    setPending("confirm");
    const res = await fetch(`/api/appointments/${appointment.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    setPending(null);
    if (res.ok) done("Cita confirmada");
    else toast.error("No se pudo confirmar la cita.");
  }

  async function reschedule() {
    if (!whenLocal || !moved) return;
    const [datePart, timePart] = whenLocal.split("T");
    setPending("reschedule");
    const res = await fetch(`/api/appointments/${appointment.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        startsAt: zonedTimeToUtc(datePart, timePart, AGENDA_TIME_ZONE).toISOString(),
      }),
    });
    setPending(null);
    if (res.ok) {
      done("Cita reprogramada");
      return;
    }
    const body = await res.json().catch(() => ({}));
    // 409 = choque con otra cita. El mensaje del servidor dice con cuál.
    toast.error(body.error ?? "No se pudo reprogramar.");
  }

  async function cancel() {
    setPending("cancel");
    const res = await fetch(`/api/appointments/${appointment.id}`, { method: "DELETE" });
    setPending(null);
    if (res.ok) done("Cita cancelada");
    else toast.error("No se pudo cancelar la cita.");
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<button type="button" className="w-full text-left" />}>
        {children}
      </DialogTrigger>

      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <span
              aria-hidden
              className="size-2 shrink-0 rounded-full"
              style={{ backgroundColor: LOCATION_ACCENT[appointment.locationCode] }}
            />
            <DialogTitle>{appointment.clientName}</DialogTitle>
            <Badge variant="secondary">{APPOINTMENT_STATUS_LABELS[appointment.status]}</Badge>
          </div>
          {/* Contexto permanente: qué cita se está tocando, sin salir de la agenda. */}
          <DialogDescription>
            {appointment.appointment_type} · {appointment.locationName} · {appointment.clientPhone}
          </DialogDescription>
        </DialogHeader>

        {closed ? (
          <p className="text-sm text-muted-foreground">
            Esta cita está {APPOINTMENT_STATUS_LABELS[appointment.status].toLowerCase()}. No admite cambios.
          </p>
        ) : confirmingCancel ? (
          /*
           * Loss aversion: no se pregunta "¿desea cancelar?" — se dice qué
           * pasa. El sastre tiene que saber que el cupo se libera y si el
           * cliente se entera antes de pulsar, no después.
           */
          <div className="space-y-3 rounded-lg border border-destructive/40 bg-destructive/5 p-3">
            <p className="text-sm font-medium">Cancelar esta cita</p>
            <p className="text-sm text-muted-foreground">
              El horario del{" "}
              <span className="text-foreground">
                {new Intl.DateTimeFormat("es-CO", {
                  timeZone: AGENDA_TIME_ZONE,
                  weekday: "long",
                  day: "numeric",
                  month: "long",
                  hour: "numeric",
                  minute: "2-digit",
                }).format(new Date(appointment.starts_at))}
              </span>{" "}
              vuelve a quedar libre para otro cliente. La cita queda en el historial, no se borra.
            </p>
            {/*
             * `cancelAppointment` solo envía el correo si el cliente tiene uno
             * registrado. Prometer "se le notifica" sin más haría que el sastre
             * no llamara — y el cliente se presentaría a una cita cancelada.
             */}
            {appointment.clientEmail ? (
              <p className="text-sm text-muted-foreground">
                Se le avisa por correo a{" "}
                <span className="text-foreground">{appointment.clientEmail}</span>.
              </p>
            ) : (
              <p className="text-sm text-destructive">
                {appointment.clientName.split(" ")[0]} no tiene correo registrado: no recibirá aviso.
                Habrá que llamarlo al {appointment.clientPhone}.
              </p>
            )}
          </div>
        ) : (
          <div className="space-y-2">
            <Label htmlFor="when">Fecha y hora</Label>
            <Input
              id="when"
              type="datetime-local"
              value={whenLocal}
              onChange={(e) => setWhenLocal(e.target.value)}
            />
            <p className="text-xs text-muted-foreground">
              {moved ? "Sin guardar todavía." : `Hora de ${appointment.locationName}.`}
            </p>
          </div>
        )}

        <DialogFooter className="flex-row items-center justify-between gap-2 sm:justify-between">
          {closed ? (
            <DialogClose render={<Button variant="outline" />}>Cerrar</DialogClose>
          ) : confirmingCancel ? (
            <>
              <Button variant="ghost" onClick={() => setConfirmingCancel(false)} disabled={pending !== null}>
                Volver
              </Button>
              <Button variant="destructive" onClick={cancel} disabled={pending !== null}>
                {pending === "cancel" && <Loader2Icon className="animate-spin" />}
                Sí, cancelar la cita
              </Button>
            </>
          ) : (
            <>
              <Button variant="ghost" onClick={() => setConfirmingCancel(true)} disabled={pending !== null}>
                Cancelar cita
              </Button>
              <div className="flex items-center gap-2">
                {appointment.status === "pending" && !moved && (
                  <Button variant="outline" onClick={() => setStatus("confirmed")} disabled={pending !== null}>
                    {pending === "confirm" ? <Loader2Icon className="animate-spin" /> : <CheckIcon />}
                    Confirmar
                  </Button>
                )}
                {/* Una acción principal: guardar el cambio de horario. Solo se
                    habilita si de verdad cambió algo. */}
                <Button onClick={reschedule} disabled={!moved || pending !== null}>
                  {pending === "reschedule" && <Loader2Icon className="animate-spin" />}
                  Guardar cambio
                </Button>
              </div>
            </>
          )}
        </DialogFooter>

        {/* Salida a la ficha completa, para lo que el modal no cubre (notas,
            historial). Discreta: el 90% de la gestión termina acá. */}
        <Link
          href={`/appointments/${appointment.id}`}
          className="inline-flex items-center gap-1 text-xs text-muted-foreground transition-colors hover:text-foreground"
        >
          Ver ficha completa
          <ExternalLinkIcon className="size-3" />
        </Link>
      </DialogContent>
    </Dialog>
  );
}
