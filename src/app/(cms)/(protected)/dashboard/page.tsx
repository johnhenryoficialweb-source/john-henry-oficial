import { getDashboardData } from "@/lib/dashboard/queries";
import { ORDER_STATUS_LABELS } from "@/lib/constants";
import { formatCurrency } from "@/lib/currency/exchange";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { RevenueTrendChart } from "@/components/cms/revenue-trend-chart";
import { CalendarDaysIcon, TrendingUpIcon, UsersIcon, WalletIcon } from "lucide-react";

export default async function DashboardPage() {
  const data = await getDashboardData();

  const kpis = [
    {
      label: "Citas hoy",
      value: data.appointmentsToday,
      sub: `${data.appointmentsWeek} esta semana`,
      icon: CalendarDaysIcon,
    },
    {
      label: "Ingresos del mes (consolidado)",
      value: `$${data.revenueThisMonthConsolidatedUsd.toLocaleString("en-US")} USD`,
      sub: `Ticket promedio: $${data.avgTicketUsd.toLocaleString("en-US")}`,
      icon: WalletIcon,
    },
    {
      label: "Clientes nuevos",
      value: data.newClientsThisMonth,
      sub: `${data.recurringClientsThisMonth} recurrentes este mes`,
      icon: UsersIcon,
    },
    {
      label: "Órdenes activas",
      value:
        data.ordersByStatus.confirmed + data.ordersByStatus.in_production + data.ordersByStatus.ready_for_delivery,
      sub: `${data.ordersByStatus.draft} en borrador`,
      icon: TrendingUpIcon,
    },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-heading text-2xl">Dashboard</h1>
        <p className="text-sm text-muted-foreground">Resumen general del negocio.</p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {kpis.map((kpi) => (
          <Card key={kpi.label}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">{kpi.label}</CardTitle>
              <kpi.icon className="size-4 text-accent" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-semibold">{kpi.value}</div>
              <p className="text-xs text-muted-foreground">{kpi.sub}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Tendencia de ingresos (últimos 6 meses, USD consolidado)</CardTitle>
          </CardHeader>
          <CardContent>
            <RevenueTrendChart data={data.monthlyTrend} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Ingresos del mes por sede</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {data.revenueThisMonthByLocation.length === 0 && (
              <p className="text-sm text-muted-foreground">Sin órdenes registradas este mes.</p>
            )}
            {data.revenueThisMonthByLocation.map((loc) => (
              <div key={loc.locationCode} className="flex items-center justify-between text-sm">
                <span>{loc.locationName}</span>
                <span className="font-medium">{formatCurrency(loc.totalUsd, "USD")}</span>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Órdenes por estado</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-3">
          {Object.entries(data.ordersByStatus).map(([status, count]) => (
            <Badge key={status} variant="secondary" className="text-sm">
              {ORDER_STATUS_LABELS[status as keyof typeof ORDER_STATUS_LABELS]}: {count}
            </Badge>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
