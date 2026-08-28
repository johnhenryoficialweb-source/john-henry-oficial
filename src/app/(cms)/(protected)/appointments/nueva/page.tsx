import Link from "next/link";
import { requireStaffSession } from "@/lib/auth/roles";
import { createClient } from "@/lib/supabase/server";
import { NewAppointmentForm } from "@/components/cms/new-appointment-form";
import type { ClientOption } from "@/components/cms/client-combobox";
import { Card, CardContent } from "@/components/ui/card";
import { ArrowLeftIcon } from "lucide-react";

function mapClient(row: {
  id: string;
  full_name: string;
  phone: string;
  email: string | null;
  locations: unknown;
}): ClientOption {
  const location = row.locations as { code: string } | null;
  return {
    id: row.id,
    full_name: row.full_name,
    phone: row.phone,
    email: row.email,
    location_code: location?.code ?? null,
  };
}

export default async function NuevaCitaPage() {
  const session = await requireStaffSession();
  const supabase = await createClient();

  const [{ data: clients }, { data: locations }] = await Promise.all([
    supabase
      .from("clients")
      .select("id, full_name, phone, email, document_id, locations(code)")
      .is("deleted_at", null)
      .order("full_name", { ascending: true }),
    supabase.from("locations").select("id, code, name").eq("is_active", true),
  ]);

  const defaultLocationCode = locations?.find((l) => l.id === session.locationId)?.code ?? locations?.[0]?.code;

  return (
    <div className="max-w-lg space-y-6">
      <Link href="/appointments" className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeftIcon className="size-4" />
        Volver a citas
      </Link>

      <div>
        <h1 className="font-heading text-2xl">Nueva cita</h1>
        <p className="text-sm text-muted-foreground">Agenda una cita manualmente para un cliente existente.</p>
      </div>

      <Card>
        <CardContent className="pt-6">
          <NewAppointmentForm
            clients={(clients ?? []).map(mapClient)}
            locations={locations ?? []}
            defaultLocationCode={defaultLocationCode}
          />
        </CardContent>
      </Card>
    </div>
  );
}
