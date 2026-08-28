import Link from "next/link";
import { ArrowLeftIcon, UsersIcon } from "lucide-react";
import { requireStaffSession } from "@/lib/auth/roles";
import { createClient } from "@/lib/supabase/server";
import { getWorkshopRecipients } from "@/lib/orders/workshop-order";
import { WorkshopRecipientsEditor } from "@/components/cms/workshop-recipients-editor";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export const metadata = { title: "Destinatarios de la orden de trabajo" };

export default async function WorkshopRecipientsPage() {
  const session = await requireStaffSession();
  const supabase = await createClient();

  const [recipients, { data: locations }] = await Promise.all([
    getWorkshopRecipients({ includeInactive: true }),
    supabase.from("locations").select("id, name").eq("is_active", true).order("name"),
  ]);

  const active = recipients.filter((recipient) => recipient.isActive);
  const hasTailor = active.some((recipient) => recipient.role === "tailor");

  return (
    <div className="max-w-3xl space-y-6">
      <Link
        href="/correos"
        className="flex w-fit items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeftIcon className="size-4" />
        Correos del sistema
      </Link>

      <div>
        <h1 className="font-heading text-2xl">Destinatarios de la orden de trabajo</h1>
        <p className="max-w-prose text-sm text-muted-foreground">
          Quién recibe el documento de taller cada vez que se crea o se confirma una orden. Cada
          persona recibe su propio correo, nunca en copia con los demás.
        </p>
      </div>

      {/*
        Regla 4 — mostrar valor antes de pedir acciones: lo primero que importa
        es si el taller está enterado, no cuántas filas hay en una tabla.
      */}
      {!hasTailor ? (
        <div className="flex items-start gap-3 rounded-lg border border-dashed border-destructive/50 p-4">
          <UsersIcon className="mt-0.5 size-4 shrink-0 text-destructive" />
          <div>
            <p className="text-sm font-medium">Ningún sastre está recibiendo las órdenes de trabajo</p>
            <p className="max-w-prose text-xs text-muted-foreground">
              Mientras no haya uno configurado, el documento solo le llega al vendedor que registró
              la orden y el taller se entera por otro medio. Agrega abajo el correo del sastre de
              cada sede.
            </p>
          </div>
        </div>
      ) : (
        <div className="rounded-lg border p-4 text-sm">
          <p className="font-medium">
            {active.length} {active.length === 1 ? "destinatario activo" : "destinatarios activos"}
          </p>
          <p className="text-xs text-muted-foreground">
            Además de estos, el documento siempre le llega al vendedor que registró la orden.
          </p>
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Quién recibe</CardTitle>
          <CardDescription>
            El documento lleva prenda, tela, especificación y medidas. No lleva teléfono, cédula ni
            valores del cliente — puedes darlo a un proveedor externo sin exponer sus datos.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <WorkshopRecipientsEditor
            recipients={recipients}
            locations={locations ?? []}
            canEdit={session.role === "admin"}
          />
        </CardContent>
      </Card>
    </div>
  );
}
