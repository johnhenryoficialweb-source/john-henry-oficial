"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { ArrowDownIcon, ArrowUpIcon } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  ExcelFilterClearButton,
  ExcelTextFilter,
  ExcelValueFilter,
  matchesExcelFilter,
} from "@/components/cms/excel-column-filter";
import { OrderDeleteButton } from "@/components/cms/order-delete-button";
import { ORDERS_QUERY_KEY } from "@/lib/orders/list-view";
import { ORDER_STATUS_LABELS } from "@/lib/constants";
import { formatCurrency } from "@/lib/currency/exchange";
import { cn } from "@/lib/utils";
import type { CurrencyCode } from "@/types/database.types";

export interface OrderTableRow {
  id: string;
  order_number: string | null;
  client_id: string | null;
  client_name: string | null;
  location_name: string | null;
  status: keyof typeof ORDER_STATUS_LABELS;
  expected_delivery_date: string | null;
  created_at: string | null;
  total: number;
  paid_total?: number;
  currency: CurrencyCode | null;
}

type ColumnFilters = {
  order_number: string;
  client_name: string;
  location_name: string;
  status: string;
  expected_delivery_date: string;
  total_min: string;
  total_max: string;
};

const EMPTY_FILTERS: ColumnFilters = {
  order_number: "",
  client_name: "",
  location_name: "",
  status: "",
  expected_delivery_date: "",
  total_min: "",
  total_max: "",
};

type SortKey = "delivery" | "created" | "total";
type SortDirection = "asc" | "desc";

function formatDate(date: string | null): string {
  if (!date) return "—";
  return new Date(date).toLocaleDateString("es-CO");
}

/** Días entre hoy y la entrega. Negativo = ya se pasó. */
function daysUntil(date: string | null): number | null {
  if (!date) return null;
  const target = new Date(`${date.slice(0, 10)}T12:00:00.000Z`).getTime();
  if (Number.isNaN(target)) return null;
  const today = new Date();
  const todayNoon = Date.UTC(today.getFullYear(), today.getMonth(), today.getDate(), 12);
  return Math.round((target - todayNoon) / 86_400_000);
}

/**
 * El color de la fecha de entrega dice qué hacer sin leer el número.
 *
 * Solo se pinta lo que sigue vivo: una orden ya entregada con fecha del año
 * pasado no está atrasada, está cerrada, y teñir de rojo mil filas históricas
 * convierte la señal en ruido y entrena al ojo a ignorarla.
 */
function deliveryTone(date: string | null, status: OrderTableRow["status"]): string {
  if (status === "delivered" || status === "cancelled") return "text-muted-foreground";
  const days = daysUntil(date);
  if (days === null) return "text-muted-foreground";
  if (days < 0) return "font-medium text-destructive";
  if (days <= 7) return "font-medium text-amber-500";
  return "";
}

function deliveryHint(date: string | null, status: OrderTableRow["status"]): string | null {
  if (status === "delivered" || status === "cancelled") return null;
  const days = daysUntil(date);
  if (days === null) return null;
  if (days < 0) return `${Math.abs(days)} d. de atraso`;
  if (days === 0) return "hoy";
  if (days <= 7) return `en ${days} d.`;
  return null;
}

/** Encabezado ordenable. Vive fuera de OrdersTable para no recrearse en cada render. */
function SortHeader({
  label,
  sortKeyName,
  sortKey,
  sortDir,
  onSort,
  align = "left",
}: {
  label: string;
  sortKeyName: SortKey;
  sortKey: SortKey;
  sortDir: SortDirection;
  onSort: (key: SortKey) => void;
  align?: "left" | "right";
}) {
  const active = sortKey === sortKeyName;
  return (
    <button
      type="button"
      onClick={() => onSort(sortKeyName)}
      className={cn(
        "flex items-center gap-1 hover:text-foreground",
        align === "right" && "ml-auto",
        active ? "text-foreground" : "text-muted-foreground"
      )}
    >
      {label}
      {active ? (
        sortDir === "asc" ? (
          <ArrowUpIcon className="size-3" />
        ) : (
          <ArrowDownIcon className="size-3" />
        )
      ) : null}
    </button>
  );
}

export function OrdersTable({ orders }: { orders: OrderTableRow[] }) {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  /*
   * Los filtros viven en la URL, no en estado local.
   *
   * Antes se perdían al entrar a una orden y volver con la flecha: el
   * componente se desmontaba y con él los filtros, así que revisar cinco
   * órdenes de un cliente obligaba a re-escribir el filtro cinco veces. En la
   * URL sobreviven el ida y vuelta, el refresh y el compartir el link.
   *
   * El estado local sigue existiendo como espejo para que escribir se sienta
   * instantáneo; la URL se sincroniza con retardo para no empujar una entrada
   * al historial por cada tecla.
   */
  const [columnFilters, setColumnFilters] = useState<ColumnFilters>(() => {
    const initial = { ...EMPTY_FILTERS };
    for (const key of Object.keys(EMPTY_FILTERS) as (keyof ColumnFilters)[]) {
      initial[key] = searchParams.get(key) ?? "";
    }
    return initial;
  });

  const [sortKey, setSortKey] = useState<SortKey>(
    (searchParams.get("sort") as SortKey) || "delivery"
  );
  const [sortDir, setSortDir] = useState<SortDirection>(
    (searchParams.get("dir") as SortDirection) || "asc"
  );

  useEffect(() => {
    const timer = setTimeout(() => {
      const params = new URLSearchParams();
      for (const [key, value] of Object.entries(columnFilters)) {
        if (value.trim()) params.set(key, value);
      }
      if (sortKey !== "delivery") params.set("sort", sortKey);
      if (sortDir !== "asc") params.set("dir", sortDir);

      const query = params.toString();
      const next = query ? `${pathname}?${query}` : pathname;
      if (next === `${pathname}${window.location.search}`) return;

      /*
       * `history.replaceState` y no `router.replace`.
       *
       * Filtrar no es navegar: las 1072 órdenes ya están en el cliente y el
       * filtrado es puro render. `router.replace` pedía al servidor volver a
       * producir la página en cada tecla —trabajo inútil— y en la práctica ni
       * siquiera llegaba a cambiar la barra de direcciones, así que los filtros
       * seguían perdiéndose. Esto reescribe la URL de una vez, sin round trip.
       */
      window.history.replaceState(null, "", next);
      // El detalle de una orden lee esto para saber a qué vista volver.
      window.sessionStorage.setItem(ORDERS_QUERY_KEY, query);
    }, 300);

    return () => clearTimeout(timer);
  }, [columnFilters, sortKey, sortDir, pathname]);

  const locationOptions = useMemo(
    () =>
      [...new Set(orders.map((order) => order.location_name).filter(Boolean))].sort() as string[],
    [orders]
  );

  const statusOptions = useMemo(
    () => [...new Set(orders.map((order) => ORDER_STATUS_LABELS[order.status]))].sort(),
    [orders]
  );

  const filtered = useMemo(() => {
    const min = columnFilters.total_min.trim() ? Number(columnFilters.total_min) : null;
    const max = columnFilters.total_max.trim() ? Number(columnFilters.total_max) : null;

    return orders.filter((order) => {
      if (!matchesExcelFilter(order.order_number, columnFilters.order_number)) return false;
      if (!matchesExcelFilter(order.client_name, columnFilters.client_name)) return false;
      if (!matchesExcelFilter(order.location_name, columnFilters.location_name)) return false;
      if (!matchesExcelFilter(ORDER_STATUS_LABELS[order.status], columnFilters.status)) {
        return false;
      }
      if (
        !matchesExcelFilter(
          formatDate(order.expected_delivery_date),
          columnFilters.expected_delivery_date
        )
      ) {
        return false;
      }
      if (min !== null && Number.isFinite(min) && order.total < min) return false;
      if (max !== null && Number.isFinite(max) && order.total > max) return false;
      return true;
    });
  }, [orders, columnFilters]);

  /*
   * Por defecto se ordena por entrega más cercana, que es la pregunta operativa
   * ("¿qué sale primero del taller?"). Lo cerrado —entregado o cancelado— cae al
   * final sin importar su fecha: son mil filas históricas que si se mezclan por
   * antigüedad tapan lo único que hay que mirar hoy.
   */
  const sorted = useMemo(() => {
    const rows = [...filtered];
    const factor = sortDir === "asc" ? 1 : -1;

    rows.sort((a, b) => {
      if (sortKey === "delivery") {
        const aClosed = a.status === "delivered" || a.status === "cancelled";
        const bClosed = b.status === "delivered" || b.status === "cancelled";
        if (aClosed !== bClosed) return aClosed ? 1 : -1;

        const aDate = a.expected_delivery_date ?? "";
        const bDate = b.expected_delivery_date ?? "";
        if (!aDate && !bDate) return 0;
        if (!aDate) return 1;
        if (!bDate) return -1;
        return aDate.localeCompare(bDate) * factor;
      }

      if (sortKey === "total") return (a.total - b.total) * factor;

      return (a.created_at ?? "").localeCompare(b.created_at ?? "") * factor;
    });

    return rows;
  }, [filtered, sortKey, sortDir]);

  function setFilter(key: keyof ColumnFilters, value: string) {
    setColumnFilters((prev) => ({ ...prev, [key]: value }));
  }

  function toggleSort(key: SortKey) {
    if (sortKey === key) {
      setSortDir((dir) => (dir === "asc" ? "desc" : "asc"));
      return;
    }
    setSortKey(key);
    setSortDir(key === "delivery" ? "asc" : "desc");
  }

  const hasFilters = Object.values(columnFilters).some((value) => value.trim().length > 0);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-muted-foreground">
          {sorted.length} de {orders.length} órdenes
        </p>
        <ExcelFilterClearButton
          active={hasFilters}
          onClear={() => setColumnFilters(EMPTY_FILTERS)}
        />
      </div>

      <div className="rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Orden</TableHead>
              <TableHead>Cliente</TableHead>
              <TableHead>Sede</TableHead>
              <TableHead>Estado</TableHead>
              <TableHead>
                <SortHeader
                  label="Atendida"
                  sortKeyName="created"
                  sortKey={sortKey}
                  sortDir={sortDir}
                  onSort={toggleSort}
                />
              </TableHead>
              <TableHead>
                <SortHeader
                  label="Entrega estimada"
                  sortKeyName="delivery"
                  sortKey={sortKey}
                  sortDir={sortDir}
                  onSort={toggleSort}
                />
              </TableHead>
              <TableHead className="text-right">
                <SortHeader
                  label="Total"
                  sortKeyName="total"
                  align="right"
                  sortKey={sortKey}
                  sortDir={sortDir}
                  onSort={toggleSort}
                />
              </TableHead>
              <TableHead className="w-10 text-right">Acciones</TableHead>
            </TableRow>

            <TableRow className="bg-muted/30 hover:bg-muted/30">
              <TableHead className="py-1.5 font-normal">
                <ExcelTextFilter
                  value={columnFilters.order_number}
                  onChange={(value) => setFilter("order_number", value)}
                />
              </TableHead>
              <TableHead className="py-1.5 font-normal">
                <ExcelTextFilter
                  value={columnFilters.client_name}
                  onChange={(value) => setFilter("client_name", value)}
                />
              </TableHead>
              <TableHead className="py-1.5 font-normal">
                <ExcelValueFilter
                  value={columnFilters.location_name}
                  onChange={(value) => setFilter("location_name", value)}
                  options={locationOptions}
                  placeholder="Sede…"
                />
              </TableHead>
              <TableHead className="py-1.5 font-normal">
                <ExcelValueFilter
                  value={columnFilters.status}
                  onChange={(value) => setFilter("status", value)}
                  options={statusOptions}
                  placeholder="Estado…"
                />
              </TableHead>
              <TableHead className="py-1.5 font-normal" />
              <TableHead className="py-1.5 font-normal">
                <ExcelTextFilter
                  value={columnFilters.expected_delivery_date}
                  onChange={(value) => setFilter("expected_delivery_date", value)}
                  placeholder="Fecha…"
                />
              </TableHead>
              {/*
                El filtro de total pasó de texto a rango. Buscar "$ 0" como
                cadena no respondía ninguna pregunta real; "muéstrame lo que
                pasa de dos millones" sí, y de paso deja aislar de un tirón el
                histórico sin precio con máximo 0.
              */}
              <TableHead className="py-1.5 font-normal">
                <div className="flex gap-1">
                  <Input
                    value={columnFilters.total_min}
                    onChange={(e) => setFilter("total_min", e.target.value)}
                    placeholder="Mín."
                    inputMode="decimal"
                    aria-label="Total mínimo"
                    className="h-7 bg-background text-xs"
                  />
                  <Input
                    value={columnFilters.total_max}
                    onChange={(e) => setFilter("total_max", e.target.value)}
                    placeholder="Máx."
                    inputMode="decimal"
                    aria-label="Total máximo"
                    className="h-7 bg-background text-xs"
                  />
                </div>
              </TableHead>
              <TableHead className="py-1.5 font-normal" />
            </TableRow>
          </TableHeader>

          <TableBody>
            {sorted.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} className="py-8 text-center">
                  <p className="text-muted-foreground">Ninguna orden coincide con los filtros.</p>
                  {hasFilters ? (
                    <button
                      type="button"
                      onClick={() => setColumnFilters(EMPTY_FILTERS)}
                      className="mt-1 text-sm underline underline-offset-4"
                    >
                      Limpiar filtros
                    </button>
                  ) : null}
                </TableCell>
              </TableRow>
            ) : (
              sorted.map((order) => {
                const hint = deliveryHint(order.expected_delivery_date, order.status);
                return (
                  <TableRow key={order.id}>
                    <TableCell className="font-medium">
                      <Link href={`/orders/${order.id}`} className="hover:underline">
                        {order.order_number ?? "—"}
                      </Link>
                    </TableCell>
                    <TableCell>
                      {order.client_id && order.client_name ? (
                        <Link href={`/clients/${order.client_id}`} className="hover:underline">
                          {order.client_name}
                        </Link>
                      ) : (
                        (order.client_name ?? "—")
                      )}
                    </TableCell>
                    <TableCell>{order.location_name ?? "—"}</TableCell>
                    <TableCell>
                      <Badge variant="secondary">{ORDER_STATUS_LABELS[order.status]}</Badge>
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {formatDate(order.created_at)}
                    </TableCell>
                    <TableCell className={deliveryTone(order.expected_delivery_date, order.status)}>
                      {formatDate(order.expected_delivery_date)}
                      {hint ? <span className="ml-1 text-xs opacity-80">· {hint}</span> : null}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {formatCurrency(order.total, order.currency ?? "USD")}
                    </TableCell>
                    <TableCell className="text-right">
                      <OrderDeleteButton
                        orderId={order.id}
                        orderNumber={order.order_number ?? "esta orden"}
                        total={order.total}
                        currency={order.currency ?? "USD"}
                        paidTotal={order.paid_total ?? 0}
                      />
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
