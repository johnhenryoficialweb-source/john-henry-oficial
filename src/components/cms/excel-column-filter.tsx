"use client";

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { FilterIcon, XIcon } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export const EXCEL_FILTER_NO_MATCH = "__NO_MATCH__";

export function matchesExcelFilter(
  value: string | number | null | undefined,
  filter: string
): boolean {
  if (filter === EXCEL_FILTER_NO_MATCH) return false;
  const raw = filter.trim();
  if (!raw) return true;

  const haystack = String(value ?? "").toLowerCase();
  const parts = raw
    .split(",")
    .map((part) => part.trim().toLowerCase())
    .filter(Boolean);

  if (parts.length === 0) return true;
  return parts.some((part) => haystack.includes(part));
}

export function ExcelTextFilter({
  value,
  onChange,
  placeholder,
  className,
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
}) {
  return (
    <Input
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder ?? "Filtrar…"}
      className={cn("h-7 bg-background text-xs", className)}
    />
  );
}

export function ExcelValueFilter({
  value,
  onChange,
  options,
  placeholder,
}: {
  value: string;
  onChange: (value: string) => void;
  options: string[];
  placeholder?: string;
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const triggerRef = useRef<HTMLButtonElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState<{ top: number; left: number; width: number } | null>(
    null
  );

  const selected = useMemo(() => {
    if (!value.trim() || value === EXCEL_FILTER_NO_MATCH) return new Set<string>();
    return new Set(
      value
        .split(",")
        .map((part) => part.trim())
        .filter(Boolean)
    );
  }, [value]);

  const isAllSelected = !value.trim();

  const visibleOptions = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return options;
    return options.filter((option) => option.toLowerCase().includes(q));
  }, [options, search]);

  const isActive = value.trim().length > 0;

  const updatePosition = useCallback(() => {
    const el = triggerRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    setPosition({ top: rect.bottom + 4, left: rect.left, width: Math.max(rect.width, 220) });
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
  }, [open, updatePosition, search]);

  useEffect(() => {
    if (!open) return;
    function handlePointerDown(event: PointerEvent) {
      const target = event.target as Node;
      if (triggerRef.current?.contains(target)) return;
      if (dropdownRef.current?.contains(target)) return;
      setOpen(false);
    }
    document.addEventListener("pointerdown", handlePointerDown);
    return () => document.removeEventListener("pointerdown", handlePointerDown);
  }, [open]);

  function toggleOption(option: string) {
    if (!value.trim()) {
      onChange(options.filter((entry) => entry !== option).join(", "));
      return;
    }

    if (value === EXCEL_FILTER_NO_MATCH) {
      onChange(option);
      return;
    }

    const base = new Set(selected);
    if (base.has(option)) base.delete(option);
    else base.add(option);

    if (base.size === 0) {
      onChange(EXCEL_FILTER_NO_MATCH);
      return;
    }
    if (base.size === options.length) {
      onChange("");
      return;
    }
    onChange([...base].join(", "));
  }

  function selectAll() {
    onChange("");
    setSearch("");
  }

  function clearAll() {
    onChange(EXCEL_FILTER_NO_MATCH);
  }

  return (
    <>
      <Button
        ref={triggerRef}
        type="button"
        variant="outline"
        size="sm"
        className={cn(
          "h-7 w-full justify-between gap-1.5 px-2 text-xs font-normal",
          isActive && "border-primary/40 text-primary"
        )}
        onClick={() => setOpen((current) => !current)}
        aria-label="Filtrar por sede"
      >
        <span className="truncate">
          {value === EXCEL_FILTER_NO_MATCH
            ? "Ninguna"
            : !isActive
              ? (placeholder ?? "Filtrar…")
              : selected.size === 1
                ? [...selected][0]
                : `${selected.size} seleccionadas`}
        </span>
        <FilterIcon className="size-3.5 shrink-0" />
      </Button>

      {open &&
        position &&
        createPortal(
          <div
            ref={dropdownRef}
            className="z-50 rounded-lg border bg-popover p-2 shadow-md"
            style={{
              position: "fixed",
              top: position.top,
              left: position.left,
              width: position.width,
            }}
          >
            <Input
              autoFocus
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar valor…"
              className="mb-2 h-7 text-xs"
            />
            <div className="mb-2 flex gap-2">
              <Button type="button" variant="secondary" size="xs" onClick={selectAll}>
                Todos
              </Button>
              <Button type="button" variant="ghost" size="xs" onClick={clearAll}>
                Ninguno
              </Button>
            </div>
            <div className="max-h-48 space-y-1 overflow-y-auto">
              {visibleOptions.length === 0 ? (
                <p className="px-1 py-2 text-xs text-muted-foreground">Sin valores.</p>
              ) : (
                visibleOptions.map((option) => (
                  <label
                    key={option}
                    className="flex cursor-pointer items-center gap-2 rounded-md px-1 py-1 text-xs hover:bg-muted"
                  >
                    <input
                      type="checkbox"
                      checked={isAllSelected || selected.has(option)}
                      onChange={() => toggleOption(option)}
                    />
                    <span className="truncate">{option}</span>
                  </label>
                ))
              )}
            </div>
          </div>,
          document.body
        )}
    </>
  );
}

export function ExcelFilterClearButton({
  active,
  onClear,
}: {
  active: boolean;
  onClear: () => void;
}) {
  if (!active) return null;

  return (
    <Button type="button" variant="ghost" size="sm" onClick={onClear} className="h-8 gap-1.5">
      <XIcon className="size-3.5" />
      Limpiar filtros
    </Button>
  );
}
