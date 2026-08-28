"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2Icon } from "lucide-react";

export function RescheduleAppointmentForm({ appointmentId }: { appointmentId: string }) {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const startsAt = String(formData.get("startsAt"));
    if (!startsAt) return;

    setIsSubmitting(true);
    const res = await fetch(`/api/appointments/${appointmentId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ startsAt: new Date(startsAt).toISOString() }),
    });
    setIsSubmitting(false);

    if (res.ok) {
      toast.success("Cita reprogramada");
      router.refresh();
    } else {
      const body = await res.json().catch(() => ({}));
      toast.error(body.error ?? "No se pudo reprogramar.");
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex items-end gap-2">
      <div className="space-y-1">
        <Label htmlFor="startsAt">Nueva fecha y hora</Label>
        <Input id="startsAt" name="startsAt" type="datetime-local" required />
      </div>
      <Button type="submit" variant="outline" disabled={isSubmitting}>
        {isSubmitting && <Loader2Icon className="animate-spin" />}
        Reprogramar
      </Button>
    </form>
  );
}
