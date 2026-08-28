import Link from "next/link";
import Image from "next/image";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { formatCurrency } from "@/lib/currency/exchange";
import { Badge } from "@/components/ui/badge";
import { ArrowLeftIcon, SwatchBookIcon } from "lucide-react";

export default async function FabricDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: fabric } = await supabase.from("fabrics").select("*").eq("id", id).single();

  if (!fabric) notFound();

  return (
    <div className="max-w-2xl space-y-6">
      <Link href="/fabrics" className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeftIcon className="size-4" />
        Volver a telas
      </Link>

      <div className="flex gap-6">
        <div className="relative size-40 shrink-0 overflow-hidden rounded-lg border bg-muted">
          {fabric.image_url ? (
            <Image src={fabric.image_url} alt={fabric.name} fill className="object-cover" unoptimized />
          ) : (
            <div className="flex h-full items-center justify-center text-muted-foreground">
              <SwatchBookIcon className="size-10" />
            </div>
          )}
        </div>
        <div className="space-y-2">
          <h1 className="font-heading text-2xl">{fabric.name}</h1>
          <p className="text-sm text-muted-foreground">{fabric.code ?? "Sin código"}</p>
          <div className="flex flex-wrap gap-2 pt-1">
            {fabric.fabric_type && <Badge variant="secondary">{fabric.fabric_type}</Badge>}
            {fabric.color && <Badge variant="secondary">{fabric.color}</Badge>}
            <Badge variant="secondary">{fabric.stock_meters}m en stock</Badge>
            {fabric.price_cop != null && (
              <Badge variant="outline">{formatCurrency(fabric.price_cop, "COP")}/m</Badge>
            )}
            {fabric.price_usd != null && (
              <Badge variant="outline">{formatCurrency(fabric.price_usd, "USD")}/m</Badge>
            )}
            {!fabric.price_cop && !fabric.price_usd && fabric.price_per_meter && (
              <Badge variant="outline">{formatCurrency(fabric.price_per_meter, fabric.price_currency)}/m</Badge>
            )}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 text-sm">
        <div>
          <p className="text-muted-foreground">Tipo / muestrario</p>
          <p>{fabric.fabric_type ?? "—"}</p>
        </div>
        <div>
          <p className="text-muted-foreground">Composición</p>
          <p>{fabric.composition ?? "—"}</p>
        </div>
        <div>
          <p className="text-muted-foreground">Proveedor</p>
          <p>{fabric.supplier ?? "—"}</p>
        </div>
      </div>
    </div>
  );
}
