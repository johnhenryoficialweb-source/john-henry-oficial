"use client";

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, useTransition } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { toast } from "sonner";
import { SearchIcon } from "lucide-react";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";
import type { CurrencyCode } from "@/types/database.types";
import {
  updateFabricCell,
  type FabricEditableField,
} from "@/app/(cms)/(protected)/fabrics/actions";

export interface FabricTableRow {
  id: string;
  supplier: string | null;
  code: string | null;
  fabric_type: string | null;
  name: string;
  price_cop: number | null;
  price_usd: number | null;
  sales_count: number;
}

type ColumnFilters = {
  supplier: string;
  code: string;
  fabric_type: string;
  name: string;
  price_cop: string;
  price_usd: string;
  sales_count: string;
};

const EMPTY_FILTERS: ColumnFilters = {
  supplier: "",
  code: "",
  fabric_type: "",
  name: "",
  price_cop: "",
  price_usd: "",
  sales_count: "",
};

function matchesFilter(value: string | number | null | undefined, filter: string): boolean {
  if (!filter.trim()) return true;
  return String(value ?? "")
    .toLowerCase()
    .includes(filter.trim().toLowerCase());
}

function fabricSearchText(f: FabricTableRow): string {
  return [f.supplier, f.code, f.fabric_type, f.name].filter(Boolean).join(" ");
}

function formatPriceDisplay(value: number | null, currency: CurrencyCode): string {
  if (value == null) return "";
  return new Intl.NumberFormat(currency === "COP" ? "es-CO" : "en-US", {
    style: "currency",
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: currency === "COP" ? 2 : 4,
  }).format(value);
}

function parsePriceInput(raw: string): number | null {
  const cleaned = raw.replace(/[^\d.,-]/g, "").replace(",", ".");
  if (!cleaned) return null;
  const num = Number(cleaned);
  return Number.isNaN(num) ? null : num;
}

function EditablePriceCell({
  fabricId,
  field,
  value,
  currency,
}: {
  fabricId: string;
  field: "price_cop" | "price_usd";
  value: number | null;
  currency: CurrencyCode;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");
  const [isPending, startTransition] = useTransition();

  const display = value == null ? "—" : formatPriceDisplay(value, currency);

  function startEdit() {
    setDraft(value == null ? "" : String(value));
    setEditing(true);
  }

  function save() {
    setEditing(false);
    const parsed = parsePriceInput(draft);

    if (parsed === value) return;
    if (parsed == null && value == null) return;

    startTransition(async () => {
      try {
        await updateFabricCell(fabricId, field, draft);
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "No se pudo guardar");
      }
    });
  }

  if (editing) {
    return (
      <Input
        autoFocus
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={save}
        onKeyDown={(e) => {
          if (e.key === "Enter") e.currentTarget.blur();
          if (e.key === "Escape") {
            setEditing(false);
            setDraft(value == null ? "" : String(value));
          }
        }}
        inputMode="decimal"
        disabled={isPending}
        placeholder={currency === "COP" ? "$0" : "$0.00"}
        className={cn(
          "h-8 border-transparent bg-transparent px-1.5 text-right shadow-none focus-visible:border-ring tabular-nums",
          isPending && "opacity-60"
        )}
      />
    );
  }

  return (
    <button
      type="button"
      onClick={startEdit}
      disabled={isPending}
      className={cn(
        "h-8 w-full rounded-md px-1.5 text-right text-sm tabular-nums hover:bg-muted/50",
        isPending && "opacity-60",
        value == null && "text-muted-foreground"
      )}
    >
      {display}
    </button>
  );
}

function EditableCell({
  fabricId,
  field,
  value,
  className,
  inputMode,
  align = "left",
}: {
  fabricId: string;
  field: FabricEditableField;
  value: string | number | null;
  className?: string;
  inputMode?: "text" | "decimal";
  align?: "left" | "right";
}) {
  const [draft, setDraft] = useState(value == null ? "" : String(value));
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    setDraft(value == null ? "" : String(value));
  }, [value]);

  function save() {
    const next = draft.trim();
    const current = value == null ? "" : String(value);
    if (next === current) return;

    startTransition(async () => {
      try {
        await updateFabricCell(fabricId, field, draft);
      } catch (err) {
        setDraft(current);
        toast.error(err instanceof Error ? err.message : "No se pudo guardar");
      }
    });
  }

  return (
    <Input
      value={draft}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={save}
      onKeyDown={(e) => {
        if (e.key === "Enter") {
          e.currentTarget.blur();
        }
      }}
      inputMode={inputMode}
      disabled={isPending}
      className={cn(
        "h-8 border-transparent bg-transparent px-1.5 shadow-none focus-visible:border-ring",
        align === "right" && "text-right",
        isPending && "opacity-60",
        className
      )}
    />
  );
}

function FabricSearch({
  fabrics,
  onQueryChange,
}: {
  fabrics: FabricTableRow[];
  onQueryChange: (q: string) => void;
}) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState<{ top: number; left: number; width: number } | null>(
    null
  );

  const suggestions = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return fabrics.slice(0, 8);
    return fabrics
      .filter((f) => fabricSearchText(f).toLowerCase().includes(q))
      .slice(0, 8);
  }, [fabrics, query]);

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

  function applySuggestion(text: string) {
    setQuery(text);
    onQueryChange(text);
    setOpen(false);
  }

  return (
    <div ref={wrapperRef} className="relative max-w-lg flex-1">
      <SearchIcon className="absolute top-1/2 left-2.5 z-10 size-4 -translate-y-1/2 text-muted-foreground" />
      <Input
        ref={inputRef}
        value={query}
        onChange={(e) => {
          setQuery(e.target.value);
          onQueryChange(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        placeholder="Buscar por proveedor, código, tipo o nombre…"
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
            {suggestions.map((f) => (
              <button
                key={f.id}
                type="button"
                className="flex w-full flex-col gap-0.5 px-3 py-2 text-left text-sm hover:bg-muted"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => applySuggestion(fabricSearchText(f))}
              >
                <span className="font-medium">{f.name}</span>
                <span className="text-xs text-muted-foreground">
                  {[f.supplier, f.code, f.fabric_type].filter(Boolean).join(" · ")}
                </span>
              </button>
            ))}
          </div>,
          document.body
        )}
    </div>
  );
}

export function FabricsTable({ fabrics }: { fabrics: FabricTableRow[] }) {
  const [globalQuery, setGlobalQuery] = useState("");
  const [columnFilters, setColumnFilters] = useState<ColumnFilters>(EMPTY_FILTERS);

  const filtered = useMemo(() => {
    const gq = globalQuery.trim().toLowerCase();
    return fabrics.filter((f) => {
      if (gq && !fabricSearchText(f).toLowerCase().includes(gq)) return false;
      if (!matchesFilter(f.supplier, columnFilters.supplier)) return false;
      if (!matchesFilter(f.code, columnFilters.code)) return false;
      if (!matchesFilter(f.fabric_type, columnFilters.fabric_type)) return false;
      if (!matchesFilter(f.name, columnFilters.name)) return false;
      if (!matchesFilter(f.price_cop, columnFilters.price_cop)) return false;
      if (!matchesFilter(f.price_usd, columnFilters.price_usd)) return false;
      if (!matchesFilter(f.sales_count, columnFilters.sales_count)) return false;
      return true;
    });
  }, [fabrics, globalQuery, columnFilters]);

  function setFilter(key: keyof ColumnFilters, value: string) {
    setColumnFilters((prev) => ({ ...prev, [key]: value }));
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <FabricSearch fabrics={fabrics} onQueryChange={setGlobalQuery} />
        <p className="text-sm text-muted-foreground">
          {filtered.length} de {fabrics.length} telas
        </p>
      </div>

      <div className="rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Proveedor</TableHead>
              <TableHead>Código</TableHead>
              <TableHead>Tipo / muestrario</TableHead>
              <TableHead>Nombre</TableHead>
              <TableHead className="text-right">COP/m ($)</TableHead>
              <TableHead className="text-right">USD/m ($)</TableHead>
              <TableHead className="text-right">Ventas</TableHead>
            </TableRow>
            <TableRow className="bg-muted/30 hover:bg-muted/30">
              {(
                [
                  ["supplier", "Filtrar…"],
                  ["code", "Filtrar…"],
                  ["fabric_type", "Filtrar…"],
                  ["name", "Filtrar…"],
                  ["price_cop", "COP…"],
                  ["price_usd", "USD…"],
                  ["sales_count", "Ventas…"],
                ] as const
              ).map(([key, placeholder]) => (
                <TableHead key={key} className="py-1.5 font-normal">
                  <Input
                    value={columnFilters[key]}
                    onChange={(e) => setFilter(key, e.target.value)}
                    placeholder={placeholder}
                    className="h-7 bg-background text-xs"
                  />
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="py-8 text-center text-muted-foreground">
                  Ninguna tela coincide con los filtros.
                </TableCell>
              </TableRow>
            ) : (
              filtered.map((fabric) => (
                <TableRow key={fabric.id}>
                  <TableCell className="min-w-[120px]">
                    <EditableCell fabricId={fabric.id} field="supplier" value={fabric.supplier} />
                  </TableCell>
                  <TableCell className="min-w-[100px]">
                    <EditableCell
                      fabricId={fabric.id}
                      field="code"
                      value={fabric.code}
                      className="font-mono text-xs"
                    />
                  </TableCell>
                  <TableCell className="min-w-[120px]">
                    <EditableCell
                      fabricId={fabric.id}
                      field="fabric_type"
                      value={fabric.fabric_type}
                    />
                  </TableCell>
                  <TableCell className="min-w-[180px]">
                    <div className="flex items-center gap-1">
                      <EditableCell
                        fabricId={fabric.id}
                        field="name"
                        value={fabric.name}
                        className="font-medium"
                      />
                      <Link
                        href={`/fabrics/${fabric.id}`}
                        className="shrink-0 text-xs text-muted-foreground hover:text-foreground"
                      >
                        →
                      </Link>
                    </div>
                  </TableCell>
                  <TableCell className="min-w-[110px]">
                    <EditablePriceCell
                      fabricId={fabric.id}
                      field="price_cop"
                      value={fabric.price_cop}
                      currency="COP"
                    />
                  </TableCell>
                  <TableCell className="min-w-[110px]">
                    <EditablePriceCell
                      fabricId={fabric.id}
                      field="price_usd"
                      value={fabric.price_usd}
                      currency="USD"
                    />
                  </TableCell>
                  <TableCell className="text-right tabular-nums text-muted-foreground">
                    {fabric.sales_count}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
