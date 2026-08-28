import Link from "next/link";
import { requireStaffSession } from "@/lib/auth/roles";
import { createClient } from "@/lib/supabase/server";
import { fetchAllRows } from "@/lib/supabase/fetch-all";
import type { GarmentType } from "@/types/database.types";
import { getPaymentChannels } from "@/lib/finance/payment-channels";
import { NewOrderWizard } from "@/components/cms/new-order-wizard";
import type { ClientOption } from "@/components/cms/client-combobox";
import { ArrowLeftIcon } from "lucide-react";

function mapClient(row: {
  id: string;
  full_name: string;
  phone: string;
  email: string | null;
  home_location_id: string;
  locations: unknown;
}): ClientOption {
  const location = row.locations as { code: string } | null;
  return {
    id: row.id,
    full_name: row.full_name,
    phone: row.phone,
    email: row.email,
    home_location_id: row.home_location_id,
    location_code: location?.code ?? null,
  };
}

export default async function NuevaOrdenPage({
  searchParams,
}: {
  searchParams: Promise<{ clientId?: string }>;
}) {
  const { clientId } = await searchParams;
  const session = await requireStaffSession();
  const supabase = await createClient();

  const [clients, fabrics, garmentModels, { data: locations }, defaultClientResult, channels] =
    await Promise.all([
    fetchAllRows<{
      id: string;
      full_name: string;
      phone: string;
      email: string | null;
      home_location_id: string;
      locations: unknown;
    }>((from, to) =>
      supabase
        .from("clients")
        .select("id, full_name, phone, email, document_id, home_location_id, locations(code)")
        .is("deleted_at", null)
        .order("full_name", { ascending: true })
        .range(from, to)
    ),
    fetchAllRows<{
      id: string;
      name: string;
      code: string | null;
      color: string | null;
      price_per_meter: number | null;
      price_currency: string;
    }>((from, to) =>
      supabase
        .from("fabrics")
        .select("id, name, code, color, price_per_meter, price_currency")
        .eq("is_active", true)
        .order("name")
        .range(from, to)
    ),
    fetchAllRows<{
      id: string;
      garment_type: GarmentType;
      name: string;
      code: string | null;
      description: string | null;
    }>((from, to) =>
      supabase
        .from("garment_models")
        .select("id, garment_type, name, code, description")
        .eq("is_active", true)
        .order("name")
        .range(from, to)
    ),
    supabase.from("locations").select("id, name, currency, code").eq("is_active", true),
    clientId
      ? supabase
          .from("clients")
          .select("id, full_name, phone, email, document_id, home_location_id, locations(code)")
          .eq("id", clientId)
          .single()
      : Promise.resolve({ data: null }),
    getPaymentChannels(),
  ]);

  const clientOptions = clients.map(mapClient);
  const defaultClient = defaultClientResult.data ? mapClient(defaultClientResult.data) : null;

  return (
    <div className="max-w-3xl space-y-6">
      <Link href="/orders" className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeftIcon className="size-4" />
        Volver a órdenes
      </Link>

      <NewOrderWizard
        clients={clientOptions}
        fabrics={fabrics}
        garmentModels={garmentModels}
        locations={locations ?? []}
        channels={channels}
        defaultClient={defaultClient}
        defaultLocationId={session.locationId ?? locations?.[0]?.id}
      />
    </div>
  );
}
