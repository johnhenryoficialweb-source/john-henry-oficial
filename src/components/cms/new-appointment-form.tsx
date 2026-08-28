"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ClientCombobox, type ClientOption } from "@/components/cms/client-combobox";
import { SERVICE_TYPES, SERVICE_TYPE_LABELS } from "@/lib/constants";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Loader2Icon } from "lucide-react";

export function NewAppointmentForm({
  clients,
  locations,
  defaultLocationCode,
}: {
  clients: ClientOption[];
  locations: { code: string; name: string }[];
  defaultLocationCode?: string;
}) {
  const router = useRouter();
  const [clientId, setClientId] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const client = clients.find((c) => c.id === clientId);

    if (!client) {
      toast.error("Selecciona un cliente.");
      return;
    }

    setIsSubmitting(true);
    const res = await fetch("/api/appointments", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        fullName: client.full_name,
        phone: client.phone,
        locationCode: formData.get("locationCode"),
        serviceType: formData.get("serviceType"),
        startsAt: new Date(String(formData.get("startsAt"))).toISOString(),
      }),
    });

    setIsSubmitting(false);

    if (res.ok) {
      toast.success("Cita creada");
      router.push("/appointments");
      router.refresh();
    } else {
      const body = await res.json().catch(() => ({}));
      toast.error(body.error ?? "No se pudo crear la cita.");
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label>Cliente</Label>
        <ClientCombobox clients={clients} name="clientIdDisplay" onSelect={(c) => setClientId(c?.id ?? null)} />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="locationCode">Sede</Label>
          <Select
            name="locationCode"
            defaultValue={defaultLocationCode}
            items={locations.map((loc) => ({ value: loc.code, label: loc.name }))}
          >
            <SelectTrigger id="locationCode" className="w-full">
              <SelectValue placeholder="Sede" />
            </SelectTrigger>
            <SelectContent>
              {locations.map((loc) => (
                <SelectItem key={loc.code} value={loc.code}>
                  {loc.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="serviceType">Servicio</Label>
          <Select
            name="serviceType"
            defaultValue={SERVICE_TYPES[0]}
            items={SERVICE_TYPES.map((type) => ({ value: type, label: SERVICE_TYPE_LABELS[type] }))}
          >
            <SelectTrigger id="serviceType" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {SERVICE_TYPES.map((type) => (
                <SelectItem key={type} value={type}>
                  {SERVICE_TYPE_LABELS[type]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="startsAt">Fecha y hora</Label>
        <Input id="startsAt" name="startsAt" type="datetime-local" required />
      </div>

      <Button type="submit" className="w-full" disabled={isSubmitting}>
        {isSubmitting && <Loader2Icon className="animate-spin" />}
        Crear cita
      </Button>
    </form>
  );
}
