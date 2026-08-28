import Link from "next/link";
import { requireAdminSession } from "@/lib/auth/roles";
import { createClient } from "@/lib/supabase/server";
import { fetchAllRows } from "@/lib/supabase/fetch-all";
import { ClientsTrashTable } from "@/components/cms/clients-trash-table";
import { EmptyState } from "@/components/shared/empty-state";
import { ArrowLeftIcon, Trash2Icon } from "lucide-react";

export default async function ClientsTrashPage() {
  await requireAdminSession();
  const supabase = await createClient();

  const clients = await fetchAllRows<{
    id: string;
    full_name: string;
    phone: string;
    email: string | null;
    deleted_at: string;
    locations: unknown;
    orders: unknown;
  }>((from, to) =>
    supabase
      .from("clients")
      .select("id, full_name, phone, email, deleted_at, locations(name, code), orders(count)")
      .not("deleted_at", "is", null)
      .order("deleted_at", { ascending: false })
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
        location_name: location?.name ?? null,
        location_code: location?.code ?? null,
        orders_count: orders?.[0]?.count ?? 0,
        deleted_at: client.deleted_at,
      };
    }) ?? [];

  return (
    <div className="space-y-6">
      <Link
        href="/clients"
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeftIcon className="size-4" />
        Volver a clientes
      </Link>

      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="font-heading text-2xl">Papelera de clientes</h1>
          <p className="text-sm text-muted-foreground">
            {rows.length} cliente{rows.length === 1 ? "" : "s"} en papelera. Restáuralos para volver al
            directorio activo.
          </p>
        </div>
      </div>

      {rows.length === 0 ? (
        <EmptyState
          icon={Trash2Icon}
          title="Papelera vacía"
          description="Los clientes movidos a la papelera aparecerán aquí para poder recuperarlos."
          action={{ href: "/clients", label: "Ir a clientes" }}
        />
      ) : (
        <ClientsTrashTable clients={rows} />
      )}
    </div>
  );
}
