import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { GARMENT_TYPE_LABELS, getMeasurementFieldLabel } from "@/lib/constants";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/shared/empty-state";
import { ArrowLeftIcon, RulerIcon } from "lucide-react";

export default async function ClientMeasurementsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: client } = await supabase.from("clients").select("id, full_name").eq("id", id).single();
  if (!client) notFound();

  const { data: measurements } = await supabase
    .from("client_measurements")
    .select("*")
    .eq("client_id", id)
    .order("taken_at", { ascending: false });

  return (
    <div className="max-w-2xl space-y-6">
      <Link href={`/clients/${id}`} className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeftIcon className="size-4" />
        Volver a {client.full_name}
      </Link>

      <div>
        <h1 className="font-heading text-2xl">Historial de medidas</h1>
        <p className="text-sm text-muted-foreground">
          Cada medida de perfil vigente se reutiliza en nuevas órdenes; los snapshots quedan ligados a la orden en la que se tomaron.
        </p>
      </div>

      {!measurements || measurements.length === 0 ? (
        <EmptyState
          icon={RulerIcon}
          title="Sin medidas registradas"
          description="Las medidas se capturan al crear una orden y quedan guardadas para reutilizarse."
        />
      ) : (
        <div className="space-y-3">
          {measurements.map((m) => (
            <Card key={m.id}>
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle className="text-base">{GARMENT_TYPE_LABELS[m.garment_type]}</CardTitle>
                <div className="flex items-center gap-2">
                  {m.source === "profile" && m.is_latest && <Badge>Vigente</Badge>}
                  <Badge variant="secondary">{m.source === "profile" ? "Perfil" : "Snapshot de orden"}</Badge>
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">
                  {Object.entries(m.values as Record<string, number>)
                    .filter(([, v]) => v > 0)
                    .map(([k, v]) => `${getMeasurementFieldLabel(m.garment_type, k)}: ${v}${m.unit}`)
                    .join(" · ")}
                </p>
                <p className="mt-2 text-xs text-muted-foreground">
                  Tomada el {new Date(m.taken_at).toLocaleDateString("es-CO")}
                </p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
