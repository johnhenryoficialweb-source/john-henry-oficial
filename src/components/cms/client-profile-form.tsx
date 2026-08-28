"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2Icon } from "lucide-react";
import {
  updateClient,
  type DocumentOwner,
} from "@/app/(cms)/(protected)/clients/actions";
import { DocumentIdField } from "@/components/cms/document-id-field";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type LocationOption = { id: string; name: string };

export function ClientProfileForm({
  clientId,
  defaultValues,
  locations,
}: {
  clientId: string;
  defaultValues: {
    fullName: string;
    phone: string;
    email: string;
    documentId: string;
    homeLocationId: string;
    notes: string;
  };
  locations: LocationOption[];
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [form, setForm] = useState(defaultValues);
  const [documentConflict, setDocumentConflict] = useState<DocumentOwner | null>(null);

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault();

    if (documentConflict) {
      toast.error(`La cédula ya es de ${documentConflict.fullName}.`);
      return;
    }

    startTransition(async () => {
      try {
        await updateClient(clientId, {
          fullName: form.fullName,
          phone: form.phone,
          email: form.email,
          documentId: form.documentId,
          homeLocationId: form.homeLocationId,
          notes: form.notes,
        });
        toast.success("Datos del cliente actualizados");
        router.refresh();
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "No se pudo guardar");
      }
    });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Datos del cliente</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="fullName">Nombre completo</Label>
            <Input
              id="fullName"
              value={form.fullName}
              onChange={(e) => setForm((current) => ({ ...current, fullName: e.target.value }))}
              required
            />
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="phone">Teléfono</Label>
              <Input
                id="phone"
                value={form.phone}
                onChange={(e) => setForm((current) => ({ ...current, phone: e.target.value }))}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">Correo</Label>
              <Input
                id="email"
                type="email"
                value={form.email}
                onChange={(e) => setForm((current) => ({ ...current, email: e.target.value }))}
                placeholder="Opcional"
              />
            </div>
          </div>
          <DocumentIdField
            value={form.documentId}
            onChange={(value) => setForm((current) => ({ ...current, documentId: value }))}
            onConflictChange={setDocumentConflict}
            excludeClientId={clientId}
          />
          <div className="space-y-2">
            <Label htmlFor="homeLocationId">Sede</Label>
            <Select
              value={form.homeLocationId}
              onValueChange={(value) =>
                setForm((current) => ({ ...current, homeLocationId: value ?? "" }))
              }
              items={locations.map((loc) => ({ value: loc.id, label: loc.name }))}
            >
              <SelectTrigger id="homeLocationId" className="w-full">
                <SelectValue placeholder="Selecciona una sede" />
              </SelectTrigger>
              <SelectContent>
                {locations.map((loc) => (
                  <SelectItem key={loc.id} value={loc.id}>
                    {loc.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="notes">Notas internas</Label>
            <Input
              id="notes"
              value={form.notes}
              onChange={(e) => setForm((current) => ({ ...current, notes: e.target.value }))}
              placeholder="Dirección, preferencias, contexto…"
            />
          </div>
          <Button type="submit" disabled={isPending || Boolean(documentConflict)}>
            {isPending ? (
              <>
                <Loader2Icon className="size-4 animate-spin" />
                Guardando…
              </>
            ) : (
              "Guardar cambios"
            )}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
