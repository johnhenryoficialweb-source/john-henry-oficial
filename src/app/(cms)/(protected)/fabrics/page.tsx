import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { fetchAllRows } from "@/lib/supabase/fetch-all";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/shared/empty-state";
import { FabricsTable } from "@/components/cms/fabrics-table";
import { PlusIcon, SwatchBookIcon } from "lucide-react";

export default async function FabricsPage() {
  const supabase = await createClient();

  const [{ data: fabrics }, orderItems] = await Promise.all([
    supabase
      .from("fabrics")
      .select("id, code, name, supplier, fabric_type, price_cop, price_usd")
      .eq("is_active", true)
      .order("supplier", { ascending: true })
      .order("code", { ascending: true }),
    // Paginado: hay más de 1000 ítems y el conteo de ventas por tela saldría
    // corto en silencio.
    fetchAllRows<{ fabric_id: string | null; quantity: number | null }>((from, to) =>
      supabase
        .from("order_items")
        .select("fabric_id, quantity")
        .not("fabric_id", "is", null)
        .range(from, to)
    ),
  ]);

  const salesByFabric = new Map<string, number>();
  for (const item of orderItems ?? []) {
    if (!item.fabric_id) continue;
    salesByFabric.set(
      item.fabric_id,
      (salesByFabric.get(item.fabric_id) ?? 0) + (item.quantity ?? 0)
    );
  }

  const rows =
    fabrics?.map((f) => ({
      id: f.id,
      supplier: f.supplier,
      code: f.code,
      fabric_type: f.fabric_type,
      name: f.name,
      price_cop: f.price_cop,
      price_usd: f.price_usd,
      sales_count: salesByFabric.get(f.id) ?? 0,
    })) ?? [];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-heading text-2xl">Telas</h1>
          <p className="text-sm text-muted-foreground">
            {rows.length} telas en el catálogo. Edita en línea; filtra por columna como en Excel.
          </p>
        </div>
        <Button render={<Link href="/fabrics/nueva" />}>
          <PlusIcon />
          Nueva tela
        </Button>
      </div>

      {rows.length === 0 ? (
        <EmptyState
          icon={SwatchBookIcon}
          title="Aún no hay telas en el catálogo"
          description="Importa el catálogo parseado o agrega la primera tela manualmente."
          action={{ href: "/fabrics/nueva", label: "Agregar tela" }}
        />
      ) : (
        <FabricsTable fabrics={rows} />
      )}
    </div>
  );
}
