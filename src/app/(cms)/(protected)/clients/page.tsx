import Link from "next/link";
import { requireStaffSession } from "@/lib/auth/roles";
import { createClient } from "@/lib/supabase/server";
import { fetchAllRows } from "@/lib/supabase/fetch-all";
import { Button } from "@/components/ui/button";
import { ClientsTable } from "@/components/cms/clients-table";
import { PlusIcon, Trash2Icon, UsersIcon } from "lucide-react";
import { EmptyState } from "@/components/shared/empty-state";

export default async function ClientsPage() {
  const session = await requireStaffSession();
  const supabase = await createClient();

  // Paginado por la misma razón que órdenes: PostgREST corta en 1000 filas sin
  // avisar, y este directorio crece. Ver src/lib/supabase/fetch-all.ts.
  const clients = await fetchAllRows<{
    id: string;
    full_name: string;
    phone: string;
    email: string | null;
    document_id: string | null;
    created_at: string;
    locations: unknown;
    orders: unknown;
  }>((from, to) =>
    supabase
      .from("clients")
      .select("id, full_name, phone, email, document_id, created_at, locations(name, code), orders(count)")
      .is("deleted_at", null)
      .order("full_name", { ascending: true })
      .range(from, to)
  );

  const rows =
    clients?.map((client) => {
      const location = client.locations as unknown as { name: string; code: string } | null;
      const orders = client.orders as unknown as { count: number }[] | null;
      return {
        id: client.id,
        full_name: client.full_name,
        phone: client.phone,
        email: client.email,
        document_id: client.document_id,
        location_name: location?.name ?? null,
        location_code: location?.code ?? null,
        orders_count: orders?.[0]?.count ?? 0,
      };
    }) ?? [];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-heading text-2xl">Clientes</h1>
          <p className="text-sm text-muted-foreground">{rows.length} clientes registrados.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {session.role === "admin" && (
            <Button variant="outline" render={<Link href="/clients/papelera" />}>
              <Trash2Icon />
              Papelera
            </Button>
          )}
          <Button render={<Link href="/clients/nuevo" />}>
            <PlusIcon />
            Nuevo cliente
          </Button>
        </div>
      </div>

      {rows.length === 0 ? (
        <EmptyState
          icon={UsersIcon}
          title="Aún no hay clientes"
          description="Los clientes se crean manualmente o automáticamente al reservar una cita."
          action={{ href: "/clients/nuevo", label: "Crear primer cliente" }}
        />
      ) : (
        <ClientsTable clients={rows} canDelete={session.role === "admin"} />
      )}
    </div>
  );
}
