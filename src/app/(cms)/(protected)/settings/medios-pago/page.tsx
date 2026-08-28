import Link from "next/link";
import { ArrowLeftIcon, CreditCardIcon } from "lucide-react";
import { requireStaffSession } from "@/lib/auth/roles";
import { createClient } from "@/lib/supabase/server";
import { getPaymentChannels } from "@/lib/finance/payment-channels";
import { PAYMENT_METHOD_LABELS, channelFeeLabel } from "@/lib/finance/labels";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  PaymentChannelEditor,
  type ChannelLocationOption,
} from "@/components/finance/payment-channel-editor";
import type { CurrencyCode } from "@/types/database.types";

export default async function PaymentChannelsPage() {
  const session = await requireStaffSession();
  const supabase = await createClient();

  const [channels, { data: locations }] = await Promise.all([
    getPaymentChannels({ includeInactive: true }),
    supabase.from("locations").select("id, name, currency").eq("is_active", true).order("name"),
  ]);

  const locationOptions = (locations ?? []) as ChannelLocationOption[];
  const sampleCurrency: CurrencyCode =
    locationOptions.find((location) => location.id === session.locationId)?.currency ??
    locationOptions[0]?.currency ??
    "COP";

  const withFee = channels.filter((channel) => channel.feePercent > 0 || channel.feeFixed > 0);
  const unconfigured = channels.filter(
    (channel) => channel.isActive && channel.method !== "cash" && channel.feePercent === 0 && channel.feeFixed === 0
  );

  return (
    <div className="max-w-2xl space-y-6">
      <Link
        href="/settings"
        className="flex w-fit items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeftIcon className="size-4" />
        Volver a ajustes
      </Link>

      <div>
        <h1 className="font-heading text-2xl">Medios de cobro y comisiones</h1>
        <p className="text-sm text-muted-foreground">
          Lo que retiene cada datáfono y cada pasarela. Con esto el sistema separa lo que el cliente
          pagó de lo que de verdad entró a caja, y arma el total gastado en comisiones.
        </p>
      </div>

      {session.role !== "admin" ? (
        <Card>
          <CardHeader>
            <CardTitle>Comisiones vigentes</CardTitle>
            <CardDescription>Solo un administrador puede modificarlas.</CardDescription>
          </CardHeader>
          <CardContent>
            <ul className="divide-y divide-border/60 text-sm">
              {channels
                .filter((channel) => channel.isActive)
                .map((channel) => (
                  <li key={channel.id} className="flex items-center justify-between gap-3 py-2">
                    <span className="flex items-center gap-2">
                      {channel.name}
                      <Badge variant="outline">{PAYMENT_METHOD_LABELS[channel.method]}</Badge>
                    </span>
                    <span className="tabular-nums text-muted-foreground">
                      {channelFeeLabel(channel)}
                    </span>
                  </li>
                ))}
            </ul>
          </CardContent>
        </Card>
      ) : (
        <>
          {unconfigured.length > 0 ? (
            <div className="flex items-start gap-3 rounded-lg border border-dashed p-4">
              <CreditCardIcon className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
              <div>
                <p className="text-sm font-medium">
                  {unconfigured.length === 1
                    ? `${unconfigured[0].name} todavía no tiene comisión configurada`
                    : `${unconfigured.length} medios de cobro sin comisión configurada`}
                </p>
                <p className="max-w-prose text-xs text-muted-foreground">
                  Mientras estén en 0%, el sistema asume que ese dinero entra completo y el reporte
                  de comisiones se queda corto. Pon el porcentaje que te cobran y cada cobro nuevo lo
                  descuenta solo.
                </p>
              </div>
            </div>
          ) : null}

          <Card>
            <CardHeader>
              <CardTitle>Comisión por medio de cobro</CardTitle>
              <CardDescription>
                Cada pago congela la comisión con la que se registró: cambiar un porcentaje acá
                afecta los cobros de aquí en adelante, nunca los que ya ocurrieron.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <PaymentChannelEditor
                channels={channels}
                locations={locationOptions}
                sampleCurrency={sampleCurrency}
              />
            </CardContent>
          </Card>

          <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border p-4 text-sm">
            <div>
              <p className="font-medium">
                {withFee.length > 0
                  ? `${withFee.length} ${withFee.length === 1 ? "medio cobra" : "medios cobran"} comisión`
                  : "Ningún medio cobra comisión todavía"}
              </p>
              <p className="text-xs text-muted-foreground">
                El total pagado en comisiones se acumula en el reporte financiero.
              </p>
            </div>
            <Button variant="outline" size="sm" render={<Link href="/finance/reportes" />}>
              Ver reporte
            </Button>
          </div>
        </>
      )}
    </div>
  );
}
