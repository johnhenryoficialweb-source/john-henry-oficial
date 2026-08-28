"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { CheckIcon, XIcon } from "lucide-react";
import { Button } from "@/components/ui/button";

export function AppointmentQuickActions({ appointmentId, status }: { appointmentId: string; status: string }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  function confirm() {
    startTransition(async () => {
      const res = await fetch(`/api/appointments/${appointmentId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "confirmed" }),
      });
      if (res.ok) {
        toast.success("Cita confirmada");
        router.refresh();
      } else {
        toast.error("No se pudo confirmar la cita.");
      }
    });
  }

  function cancel() {
    startTransition(async () => {
      const res = await fetch(`/api/appointments/${appointmentId}`, { method: "DELETE" });
      if (res.ok) {
        toast.success("Cita cancelada");
        router.refresh();
      } else {
        toast.error("No se pudo cancelar la cita.");
      }
    });
  }

  if (status === "cancelled" || status === "completed") return null;

  return (
    <div className="flex gap-1">
      {status === "pending" && (
        <Button type="button" size="icon-sm" variant="outline" disabled={isPending} onClick={confirm} title="Confirmar">
          <CheckIcon />
        </Button>
      )}
      <Button type="button" size="icon-sm" variant="ghost" disabled={isPending} onClick={cancel} title="Cancelar">
        <XIcon />
      </Button>
    </div>
  );
}
