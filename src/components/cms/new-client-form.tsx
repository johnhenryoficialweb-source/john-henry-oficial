"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2Icon } from "lucide-react";
import {
  createClientInline,
  type DocumentOwner,
} from "@/app/(cms)/(protected)/clients/actions";
import { DocumentIdField } from "@/components/cms/document-id-field";
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

type LocationOption = { id: string; name: string };

/**
 * Alta de cliente.
 *
 * Es un componente de cliente y no un `<form action={serverAction}>` porque el
 * alta ahora puede fallar por una razón que el usuario debe poder leer y
 * resolver —la cédula ya existe—, y una acción de servidor que lanza en un form
 * plano se lleva la página entera a la pantalla de error, perdiendo lo ya
 * escrito. Aquí el fallo es un aviso y el formulario sigue en pie.
 */
export function NewClientForm({
  locations,
  defaultLocationId,
}: {
  locations: LocationOption[];
  defaultLocationId: string;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [documentConflict, setDocumentConflict] = useState<DocumentOwner | null>(null);
  const [form, setForm] = useState({
    fullName: "",
    phone: "",
    email: "",
    documentId: "",
    homeLocationId: defaultLocationId,
    notes: "",
  });

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault();

    if (documentConflict) {
      toast.error(`La cédula ya es de ${documentConflict.fullName}. Usa esa ficha.`);
      return;
    }

    startTransition(async () => {
      try {
        const client = await createClientInline(form);
        toast.success(`${client.full_name} registrado`);
        router.push(`/clients/${client.id}`);
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "No se pudo crear el cliente.");
      }
    });
  }

  const canSubmit =
    form.fullName.trim().length > 0 &&
    form.phone.trim().length > 0 &&
    Boolean(form.homeLocationId) &&
    !documentConflict;

  return (
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
          <Label htmlFor="email">Correo (opcional)</Label>
          <Input
            id="email"
            type="email"
            value={form.email}
            onChange={(e) => setForm((current) => ({ ...current, email: e.target.value }))}
          />
        </div>
      </div>

      <DocumentIdField
        label="Cédula o documento (opcional)"
        value={form.documentId}
        onChange={(value) => setForm((current) => ({ ...current, documentId: value }))}
        onConflictChange={setDocumentConflict}
        hint="Sirve para encontrarlo después: el teléfono cambia y el nombre se escribe de varias formas, el documento no."
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
        <Label htmlFor="notes">Notas internas (opcional)</Label>
        <Input
          id="notes"
          value={form.notes}
          onChange={(e) => setForm((current) => ({ ...current, notes: e.target.value }))}
          placeholder="Preferencias de tela, contexto, etc."
        />
      </div>

      <Button type="submit" className="w-full" disabled={isPending || !canSubmit}>
        {isPending ? (
          <>
            <Loader2Icon className="size-4 animate-spin" />
            Creando…
          </>
        ) : (
          "Crear cliente"
        )}
      </Button>
    </form>
  );
}
