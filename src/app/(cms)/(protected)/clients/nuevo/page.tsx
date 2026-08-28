import Link from "next/link";
import { requireStaffSession } from "@/lib/auth/roles";
import { createClient } from "@/lib/supabase/server";
import { NewClientForm } from "@/components/cms/new-client-form";
import { Card, CardContent } from "@/components/ui/card";
import { ArrowLeftIcon } from "lucide-react";

export default async function NuevoClientePage() {
  const session = await requireStaffSession();
  const supabase = await createClient();
  const { data: locations } = await supabase
    .from("locations")
    .select("id, name")
    .eq("is_active", true);

  const options = locations ?? [];

  return (
    <div className="max-w-lg space-y-6">
      <Link
        href="/clients"
        className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeftIcon className="size-4" />
        Volver a clientes
      </Link>

      <div>
        <h1 className="font-heading text-2xl">Nuevo cliente</h1>
        <p className="text-sm text-muted-foreground">
          Registra un cliente nuevo para citas y órdenes.
        </p>
      </div>

      <Card>
        <CardContent className="pt-6">
          <NewClientForm
            locations={options}
            defaultLocationId={session.locationId ?? options[0]?.id ?? ""}
          />
        </CardContent>
      </Card>
    </div>
  );
}
