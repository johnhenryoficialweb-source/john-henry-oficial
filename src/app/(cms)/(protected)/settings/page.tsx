import Link from "next/link";
import { requireStaffSession } from "@/lib/auth/roles";
import { createClient } from "@/lib/supabase/server";
import { updateExchangeRate } from "./actions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { ArrowRightIcon } from "lucide-react";

export default async function SettingsPage() {
  const session = await requireStaffSession();
  const supabase = await createClient();
  const { data: setting } = await supabase
    .from("settings")
    .select("value, updated_at")
    .eq("key", "exchange_rate_usd_cop")
    .single();

  const rate = (setting?.value as { rate?: number } | null)?.rate ?? 4000;

  return (
    <div className="max-w-lg space-y-6">
      <div>
        <h1 className="font-heading text-2xl">Ajustes</h1>
        <p className="text-sm text-muted-foreground">Configuración general del sistema.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Tasa de cambio USD → COP</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="mb-4 text-xs text-muted-foreground">
            Usada para el reporte financiero consolidado entre sedes. Última actualización:{" "}
            {setting?.updated_at ? new Date(setting.updated_at).toLocaleDateString("es-CO") : "nunca"}.
          </p>
          {session.role === "admin" ? (
            <form action={updateExchangeRate} className="flex items-end gap-3">
              <div className="space-y-1">
                <Label htmlFor="rate">1 USD equivale a (COP)</Label>
                <Input id="rate" name="rate" type="number" step="1" min="1" defaultValue={rate} />
              </div>
              <Button type="submit">Guardar</Button>
            </form>
          ) : (
            <p className="text-2xl font-semibold">{rate.toLocaleString("es-CO")} COP</p>
          )}
        </CardContent>
      </Card>

      <Link
        href="/correos"
        className="flex items-center justify-between rounded-lg border p-4 text-sm hover:border-accent"
      >
        <span>
          Correos del sistema
          <span className="block text-xs text-muted-foreground">
            Ver y editar cada correo que recibe el cliente, y comprobar que estén saliendo.
          </span>
        </span>
        <ArrowRightIcon className="size-4 shrink-0" />
      </Link>

      <Link
        href="/settings/medios-pago"
        className="flex items-center justify-between rounded-lg border p-4 text-sm hover:border-accent"
      >
        <span>
          Medios de cobro y comisiones
          <span className="block text-xs text-muted-foreground">
            El porcentaje que retienen el datáfono y las pasarelas de pago, que se descuenta de cada
            cobro y se acumula en el reporte.
          </span>
        </span>
        <ArrowRightIcon className="size-4 shrink-0" />
      </Link>

      {session.role === "admin" && (
        <>
          <Link
            href="/settings/usuarios"
            className="flex items-center justify-between rounded-lg border p-4 text-sm hover:border-accent"
          >
            <span>Gestión de usuarios del staff</span>
            <ArrowRightIcon className="size-4" />
          </Link>

          <Link
            href="/finance/royalties"
            className="flex items-center justify-between rounded-lg border p-4 text-sm hover:border-accent"
          >
            <span>
              Regalía entre sedes
              <span className="block text-xs text-muted-foreground">
                Consultar el acuerdo vigente y liquidar los giros pendientes.
              </span>
            </span>
            <ArrowRightIcon className="size-4 shrink-0" />
          </Link>
        </>
      )}
    </div>
  );
}
