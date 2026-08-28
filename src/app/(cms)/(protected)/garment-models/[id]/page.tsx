import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { GARMENT_TYPE_LABELS } from "@/lib/constants";
import { Badge } from "@/components/ui/badge";
import { ArrowLeftIcon, ShirtIcon } from "lucide-react";

export default async function GarmentModelDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: model } = await supabase.from("garment_models").select("*").eq("id", id).single();

  if (!model) notFound();

  return (
    <div className="max-w-2xl space-y-6">
      <Link
        href="/garment-models"
        className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeftIcon className="size-4" />
        Volver a modelos
      </Link>

      <div className="flex gap-6">
        <div className="flex size-40 shrink-0 items-center justify-center rounded-lg border bg-muted text-muted-foreground">
          <ShirtIcon className="size-10" />
        </div>
        <div className="space-y-2">
          <h1 className="font-heading text-2xl">{model.name}</h1>
          <p className="text-sm text-muted-foreground">{model.code ?? "Sin código"}</p>
          <div className="flex flex-wrap gap-2 pt-1">
            <Badge variant="secondary">{GARMENT_TYPE_LABELS[model.garment_type]}</Badge>
          </div>
        </div>
      </div>

      <div>
        <p className="text-sm text-muted-foreground">Descripción</p>
        <p className="text-sm">{model.description ?? "—"}</p>
      </div>
    </div>
  );
}
