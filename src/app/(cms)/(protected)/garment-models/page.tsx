import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { GARMENT_TYPE_LABELS } from "@/lib/constants";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { EmptyState } from "@/components/shared/empty-state";
import { PlusIcon, ShirtIcon } from "lucide-react";
import type { GarmentType } from "@/types/database.types";

const GARMENT_ORDER: GarmentType[] = ["saco", "pantalon", "camisa", "chaleco", "otro"];

export default async function GarmentModelsPage() {
  const supabase = await createClient();
  const { data: models } = await supabase
    .from("garment_models")
    .select("*")
    .eq("is_active", true)
    .order("name");

  const byType = new Map<GarmentType, typeof models>();
  for (const type of GARMENT_ORDER) byType.set(type, []);
  for (const model of models ?? []) {
    byType.get(model.garment_type)?.push(model);
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-heading text-2xl">Modelos</h1>
          <p className="text-sm text-muted-foreground">
            Catálogo de modelos/estilos por prenda, compartido entre sedes.
          </p>
        </div>
        <Button render={<Link href="/garment-models/nueva" />}>
          <PlusIcon />
          Nuevo modelo
        </Button>
      </div>

      {!models || models.length === 0 ? (
        <EmptyState
          icon={ShirtIcon}
          title="Aún no hay modelos en el catálogo"
          description="Agrega el primer modelo (ej. Saco Cruzado, Pantalón Recto) para poder seleccionarlo al armar una orden."
          action={{ href: "/garment-models/nueva", label: "Agregar primer modelo" }}
        />
      ) : (
        <div className="space-y-6">
          {GARMENT_ORDER.map((type) => {
            const items = byType.get(type) ?? [];
            if (items.length === 0) return null;
            return (
              <div key={type} className="space-y-2">
                <h2 className="text-sm font-medium text-muted-foreground uppercase tracking-[0.04em]">
                  {GARMENT_TYPE_LABELS[type]}
                </h2>
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
                  {items.map((model) => (
                    <Link key={model.id} href={`/garment-models/${model.id}`}>
                      <Card className="transition-colors hover:border-accent">
                        <CardContent className="space-y-1 p-3">
                          <p className="truncate text-sm font-medium">{model.name}</p>
                          <p className="text-xs text-muted-foreground">{model.code ?? "sin código"}</p>
                        </CardContent>
                      </Card>
                    </Link>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
