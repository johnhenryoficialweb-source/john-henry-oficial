"use client";

import {
  Bar,
  CartesianGrid,
  Legend,
  Line,
  ComposedChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { MonthlyFinanceRow } from "@/lib/finance/overview";

const currency = (value: number) => `$${Number(value).toLocaleString("en-US", { maximumFractionDigits: 0 })}`;

/**
 * Estas gráficas no animan su entrada, a diferencia de las del dashboard.
 * Viven detrás del filtro de periodo: cada clic en un preset re-navega, la
 * gráfica se remonta y la animación por defecto de Recharts vuelve a correr
 * desde cero. Comparar dos meses seguidos significaría esperar el crecimiento
 * de las barras cada vez, para leer un dato que ya estaba calculado.
 */
const ANIMATE = false;

/** Entradas contra salidas mes a mes, con el neto encima como línea. */
export function MoneyFlowChart({ data }: { data: MonthlyFinanceRow[] }) {
  return (
    <ResponsiveContainer width="100%" height={280}>
      <ComposedChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
        <XAxis dataKey="month" stroke="var(--muted-foreground)" fontSize={12} tickLine={false} axisLine={false} />
        <YAxis
          stroke="var(--muted-foreground)"
          fontSize={12}
          tickLine={false}
          axisLine={false}
          tickFormatter={currency}
        />
        <Tooltip
          contentStyle={{
            backgroundColor: "var(--popover)",
            borderColor: "var(--border)",
            borderRadius: "var(--radius)",
            color: "var(--popover-foreground)",
            fontSize: 12,
          }}
          formatter={(value) => currency(Number(value))}
        />
        <Legend wrapperStyle={{ fontSize: 12 }} />
        <Bar dataKey="ingresos" name="Entradas" fill="var(--chart-1)" radius={[4, 4, 0, 0]} isAnimationActive={ANIMATE} />
        <Bar dataKey="salidas" name="Salidas" fill="var(--destructive)" radius={[4, 4, 0, 0]} isAnimationActive={ANIMATE} />
        <Line
          type="monotone"
          dataKey="neto"
          name="Neto"
          stroke="var(--chart-3)"
          strokeWidth={2}
          dot={false}
          isAnimationActive={ANIMATE}
        />
      </ComposedChart>
    </ResponsiveContainer>
  );
}
