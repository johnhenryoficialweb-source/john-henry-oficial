"use client";

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { ArrowDownIcon, ArrowUpDownIcon, ArrowUpIcon, FilterIcon, SearchIcon } from "lucide-react";
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
import { ClientDeleteButton } from "@/components/cms/client-delete-button";
import {
  ExcelFilterClearButton,
  ExcelValueFilter,
  EXCEL_FILTER_NO_MATCH,
  matchesExcelFilter,
} from "@/components/cms/excel-column-filter";
import { cn } from "@/lib/utils";
import { formatPhoneDisplay } from "@/lib/phone/format";

export interface ClientTableRow {
  id: string;
  full_name: string;
  phone: string;
  email: string | null;
  document_id: string | null;
  location_name: string | null;
  location_code: string | null;
  orders_count: number;
}

/*
 * La cédula entra al buscador en dos formas: como se guardó y sin separadores.
 *
 * El sastre la escribe como la lee del documento —"1.020.304"— y la base la
 * guarda normalizada. Sin la variante limpia, buscar por cédula falla justo
 * cuando se escribe con puntos, que es como está impresa.
 */
function clientSearchText(client: ClientTableRow): string {
  const phoneInfo = formatPhoneDisplay(client.phone, client.location_code);
  const document = client.document_id ?? "";
  return [
    client.full_name,
    client.phone,
    phoneInfo.formatted,
    phoneInfo.label,
    phoneInfo.country,
    client.email,
    document,
    document.replace(/[^\p{L}\p{N}]/gu, ""),
    client.location_name,
  ]
    .filter(Boolean)
    .join(" ");
}

/** Lo que el usuario escribió, con la misma limpieza que se aplicó al guardar. */
function normalizeQuery(query: string): string {
  return query.trim().toLowerCase();
}

function ClientSearch({
  clients,
  query,
  onQueryChange,
}: {
  clients: ClientTableRow[];
  query: string;
  onQueryChange: (q: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState<{ top: number; left: number; width: number } | null>(
    null
  );

  const suggestions = useMemo(() => {
    const q = normalizeQuery(query);
    if (!q) return clients.slice(0, 8);
    // "1.020.304" y "1020304" tienen que encontrar al mismo cliente.
    const bare = q.replace(/[^\p{L}\p{N}]/gu, "");
    return clients
      .filter((c) => {
        const haystack = clientSearchText(c).toLowerCase();
        return haystack.includes(q) || (bare.length > 0 && haystack.includes(bare));
      })
      .slice(0, 8);
  }, [clients, query]);

  const updatePosition = useCallback(() => {
    const el = inputRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    setPosition({ top: rect.bottom + 4, left: rect.left, width: rect.width });
  }, []);

  useLayoutEffect(() => {
    if (!open) return;
    updatePosition();
    window.addEventListener("resize", updatePosition);
    window.addEventListener("scroll", updatePosition, true);
    return () => {
      window.removeEventListener("resize", updatePosition);
      window.removeEventListener("scroll", updatePosition, true);
    };
  }, [open, updatePosition, query]);

  useEffect(() => {
    if (!open) return;
    function handlePointerDown(event: PointerEvent) {
      const target = event.target as Node;
      if (wrapperRef.current?.contains(target)) return;
      if (dropdownRef.current?.contains(target)) return;
      setOpen(false);
    }
    document.addEventListener("pointerdown", handlePointerDown);
    return () => document.removeEventListener("pointerdown", handlePointerDown);
  }, [open]);

  function applySuggestion(client: ClientTableRow) {
    onQueryChange(client.full_name);
    setOpen(false);
  }

  return (
    <div ref={wrapperRef} className="relative max-w-lg flex-1">
      <SearchIcon className="absolute top-1/2 left-2.5 z-10 size-4 -translate-y-1/2 text-muted-foreground" />
      <Input
        ref={inputRef}
        value={query}
        onChange={(e) => {
          onQueryChange(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        placeholder="Buscar por nombre, cédula, teléfono o correo…"
        className="pl-8"
        autoComplete="off"
      />
      {open &&
        suggestions.length > 0 &&
        position &&
        createPortal(
          <div
            ref={dropdownRef}
            className="z-50 max-h-64 overflow-auto rounded-lg border bg-popover py-1 shadow-md"
            style={{
              position: "fixed",
              top: position.top,
              left: position.left,
              width: position.width,
            }}
          >
            {suggestions.map((client) => {
              const phoneInfo = formatPhoneDisplay(client.phone, client.location_code);
              return (
                <button
                  key={client.id}
                  type="button"
                  className="flex w-full flex-col gap-0.5 px-3 py-2 text-left text-sm hover:bg-muted"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => applySuggestion(client)}
                >
                  <span className="font-medium">{client.full_name}</span>
                  <span className="text-xs text-muted-foreground">
                    {client.document_id ? `CC ${client.document_id} · ` : ""}
                    {phoneInfo.flag} {phoneInfo.formatted}
                    {client.email ? ` · ${client.email}` : ""}
                    {client.location_name ? ` · ${client.location_name}` : ""}
                  </span>
                </button>
              );
            })}
          </div>,
          document.body
        )}
    </div>
  );
}

function PhoneCell({ phone, locationCode }: { phone: string; locationCode: string | null }) {
  const info = formatPhoneDisplay(phone, locationCode);

  return (
    <div className="flex items-center gap-2">
      <Badge
        variant="outline"
        className={cn(
          "shrink-0 tabular-nums",
          info.country === "CO"
            ? "border-amber-200 bg-amber-50 text-amber-900 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-100"
            : "border-sky-200 bg-sky-50 text-sky-900 dark:border-sky-900 dark:bg-sky-950 dark:text-sky-100"
        )}
        title={info.label}
      >
        {info.flag} {info.country}
      </Badge>
      <span className="tabular-nums">{info.formatted}</span>
    </div>
  );
}

type SortDirection = "asc" | "desc";
type OrdersSort = SortDirection | null;

function SortableHead({
  label,
  sort,
  active,
  align = "left",
  onSortChange,
  ariaAsc,
  ariaDesc,
  ariaInactive,
}: {
  label: string;
  sort: SortDirection | null;
  active: boolean;
  align?: "left" | "right";
  onSortChange: () => void;
  ariaAsc: string;
  ariaDesc: string;
  ariaInactive: string;
}) {
  const SortIcon =
    sort === "desc" ? ArrowDownIcon : sort === "asc" ? ArrowUpIcon : ArrowUpDownIcon;

  return (
    <TableHead className={align === "right" ? "text-right" : undefined}>
      <button
        type="button"
        onClick={onSortChange}
        className={cn(
          "inline-flex w-full items-center gap-1 transition-colors hover:text-foreground",
          align === "right" ? "justify-end" : "justify-start",
          active && "text-primary"
        )}
        aria-label={
          sort === "desc" ? ariaDesc : sort === "asc" ? ariaAsc : ariaInactive
        }
      >
        {label}
        <SortIcon className="size-3.5 shrink-0" aria-hidden />
      </button>
    </TableHead>
  );
}

function OrdersSortHead({
  sort,
  active,
  onSortChange,
}: {
  sort: OrdersSort;
  active: boolean;
  onSortChange: (sort: OrdersSort) => void;
}) {
  function cycleSort() {
    if (sort === null) onSortChange("desc");
    else if (sort === "desc") onSortChange("asc");
    else onSortChange(null);
  }

  return (
    <SortableHead
      label="Pedidos"
      sort={sort}
      active={active}
      align="right"
      onSortChange={cycleSort}
      ariaInactive="Ordenar por cantidad de pedidos"
      ariaAsc="Ordenado: más pedidos primero. Clic para menor a mayor."
      ariaDesc="Ordenado: menos pedidos primero. Clic para quitar orden."
    />
  );
}

export function ClientsTable({
  clients,
  canDelete = false,
}: {
  clients: ClientTableRow[];
  canDelete?: boolean;
}) {
  const [globalQuery, setGlobalQuery] = useState("");
  const [locationFilter, setLocationFilter] = useState("");
  const [nameSort, setNameSort] = useState<SortDirection>("asc");
  const [ordersSort, setOrdersSort] = useState<OrdersSort>(null);

  const locationOptions = useMemo(
    () =>
      [...new Set(clients.map((client) => client.location_name ?? "—"))].sort((a, b) =>
        a.localeCompare(b, "es")
      ),
    [clients]
  );

  const filtered = useMemo(() => {
    const gq = normalizeQuery(globalQuery);
    const bareQuery = gq.replace(/[^\p{L}\p{N}]/gu, "");
    return clients.filter((client) => {
      if (gq) {
        const haystack = clientSearchText(client).toLowerCase();
        const hit =
          haystack.includes(gq) || (bareQuery.length > 0 && haystack.includes(bareQuery));
        if (!hit) return false;
      }

      if (locationFilter === EXCEL_FILTER_NO_MATCH) return false;
      if (locationFilter.trim()) {
        const matchesLocation = matchesExcelFilter(
          client.location_name ?? "—",
          locationFilter
        ) || matchesExcelFilter(client.location_code, locationFilter);
        if (!matchesLocation) return false;
      }

      return true;
    });
  }, [clients, globalQuery, locationFilter]);

  const sorted = useMemo(() => {
    const list = [...filtered];

    if (ordersSort) {
      return list.sort((a, b) =>
        ordersSort === "desc" ? b.orders_count - a.orders_count : a.orders_count - b.orders_count
      );
    }

    return list.sort((a, b) => {
      const cmp = a.full_name.localeCompare(b.full_name, "es", { sensitivity: "base" });
      return nameSort === "asc" ? cmp : -cmp;
    });
  }, [filtered, ordersSort, nameSort]);

  const hasActiveFilters = globalQuery.trim().length > 0 || locationFilter.trim().length > 0;

  function clearFilters() {
    setGlobalQuery("");
    setLocationFilter("");
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <ClientSearch clients={clients} query={globalQuery} onQueryChange={setGlobalQuery} />
        <p className="text-sm text-muted-foreground">
          {filtered.length} de {clients.length} clientes
        </p>
        <ExcelFilterClearButton active={hasActiveFilters} onClear={clearFilters} />
      </div>

      <div className="rounded-lg border">
        <Table>
          <TableHeader className="sticky top-0 z-10 bg-card">
            <TableRow>
              <SortableHead
                label="Nombre"
                sort={ordersSort ? null : nameSort}
                active={!ordersSort}
                onSortChange={() => {
                  setOrdersSort(null);
                  setNameSort((current) => (current === "asc" ? "desc" : "asc"));
                }}
                ariaInactive="Ordenado A-Z. Clic para Z-A."
                ariaAsc="Ordenado A-Z. Clic para Z-A."
                ariaDesc="Ordenado Z-A. Clic para A-Z."
              />
              <TableHead>Cédula</TableHead>
              <TableHead>Teléfono</TableHead>
              <TableHead>Correo</TableHead>
              <TableHead>
                <span className="inline-flex items-center gap-1.5">
                  Sede
                  {locationFilter.trim() ? (
                    <FilterIcon className="size-3 text-primary" aria-hidden />
                  ) : null}
                </span>
              </TableHead>
              <OrdersSortHead
                sort={ordersSort}
                active={ordersSort !== null}
                onSortChange={setOrdersSort}
              />
              {canDelete && <TableHead className="w-12 text-right">Acciones</TableHead>}
            </TableRow>
            <TableRow className="bg-muted/30 hover:bg-muted/30">
              <TableHead className="py-1.5" />
              <TableHead className="py-1.5" />
              <TableHead className="py-1.5" />
              <TableHead className="py-1.5" />
              <TableHead className="py-1.5 font-normal">
                <ExcelValueFilter
                  value={locationFilter}
                  onChange={setLocationFilter}
                  options={locationOptions}
                  placeholder="Sede…"
                />
              </TableHead>
              <TableHead className="py-1.5" />
              {canDelete && <TableHead className="py-1.5" />}
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length === 0 ? (
              <TableRow>
                <TableCell colSpan={canDelete ? 7 : 6} className="py-8 text-center text-muted-foreground">
                  Ningún cliente coincide con los filtros.
                </TableCell>
              </TableRow>
            ) : (
              sorted.map((client) => (
                <TableRow key={client.id}>
                  <TableCell className="font-medium">
                    <Link href={`/clients/${client.id}`} className="hover:underline">
                      {client.full_name}
                    </Link>
                  </TableCell>
                  <TableCell className="tabular-nums text-muted-foreground">
                    {client.document_id ?? "—"}
                  </TableCell>
                  <TableCell>
                    <PhoneCell phone={client.phone} locationCode={client.location_code} />
                  </TableCell>
                  <TableCell>{client.email ?? "—"}</TableCell>
                  <TableCell>{client.location_name ?? "—"}</TableCell>
                  <TableCell className="text-right tabular-nums">
                    {client.orders_count > 0 ? (
                      <Link
                        href={`/clients/${client.id}/ordenes`}
                        className="hover:underline"
                      >
                        {client.orders_count}
                      </Link>
                    ) : (
                      <span className="text-muted-foreground">0</span>
                    )}
                  </TableCell>
                  {canDelete && (
                    <TableCell className="text-right">
                      <ClientDeleteButton clientId={client.id} clientName={client.full_name} />
                    </TableCell>
                  )}
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
