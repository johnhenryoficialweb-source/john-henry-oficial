"use client";

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { CheckIcon, SearchIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";

export interface FabricComboboxOption {
  id: string;
  name: string;
  code: string | null;
  color: string | null;
}

const SUGGESTION_LIMIT = 80;

function fabricSearchText(fabric: FabricComboboxOption): string {
  return [fabric.name, fabric.code, fabric.color].filter(Boolean).join(" ");
}

function fabricMatches(fabric: FabricComboboxOption, query: string): boolean {
  const tokens = query
    .trim()
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean);
  if (tokens.length === 0) return false;

  const haystack = fabricSearchText(fabric).toLowerCase();
  return tokens.every((token) => haystack.includes(token));
}

/** Selector de tela con búsqueda predictiva sobre el catálogo completo cargado en servidor. */
export function FabricCombobox({
  fabrics,
  value,
  onValueChange,
  placeholder = "Buscar tela por nombre, código o color…",
  "aria-label": ariaLabel,
}: {
  fabrics: FabricComboboxOption[];
  value: string | null;
  onValueChange: (fabricId: string | null) => void;
  placeholder?: string;
  "aria-label"?: string;
}) {
  const selected = useMemo(
    () => (value ? fabrics.find((fabric) => fabric.id === value) ?? null : null),
    [fabrics, value]
  );

  const [query, setQuery] = useState(selected?.name ?? "");
  const [open, setOpen] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState<{ top: number; left: number; width: number } | null>(null);

  useEffect(() => {
    setQuery(selected?.name ?? "");
  }, [selected?.id, selected?.name]);

  const trimmedQuery = query.trim();

  const { suggestions, totalMatches, truncated } = useMemo(() => {
    if (!trimmedQuery) {
      return { suggestions: [], totalMatches: 0, truncated: false };
    }

    const matches = fabrics.filter((fabric) => fabricMatches(fabric, trimmedQuery));
    return {
      suggestions: matches.slice(0, SUGGESTION_LIMIT),
      totalMatches: matches.length,
      truncated: matches.length > SUGGESTION_LIMIT,
    };
  }, [fabrics, trimmedQuery]);

  const updatePosition = useCallback(() => {
    const el = inputRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    setPosition({
      top: rect.bottom + 4,
      left: rect.left,
      width: Math.max(rect.width, 360),
    });
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
      if (selected) setQuery(selected.name);
    }
    document.addEventListener("pointerdown", handlePointerDown);
    return () => document.removeEventListener("pointerdown", handlePointerDown);
  }, [open, selected]);

  function selectFabric(fabric: FabricComboboxOption) {
    setQuery(fabric.name);
    setOpen(false);
    onValueChange(fabric.id);
  }

  function handleQueryChange(next: string) {
    setQuery(next);
    setOpen(true);
    if (selected && next.trim() !== selected.name) {
      onValueChange(null);
    }
  }

  return (
    <div ref={wrapperRef} className="relative min-w-0">
      <SearchIcon className="absolute top-1/2 left-2.5 z-10 size-4 -translate-y-1/2 text-muted-foreground" />
      <Input
        ref={inputRef}
        value={query}
        onChange={(e) => handleQueryChange(e.target.value)}
        onFocus={() => setOpen(true)}
        placeholder={placeholder}
        aria-label={ariaLabel}
        className={cn("pl-8", selected && "pr-8")}
        autoComplete="off"
      />
      {selected && (
        <CheckIcon className="absolute top-1/2 right-2.5 size-4 -translate-y-1/2 text-accent" aria-hidden />
      )}

      {open &&
        position &&
        createPortal(
          <div
            ref={dropdownRef}
            className="z-50 max-h-80 overflow-auto rounded-lg border bg-popover py-1 shadow-md"
            style={{
              position: "fixed",
              top: position.top,
              left: position.left,
              width: position.width,
            }}
          >
            {!trimmedQuery ? (
              <p className="px-3 py-2 text-sm text-muted-foreground">
                {fabrics.length.toLocaleString("es-CO")} telas en catálogo. Escribe para buscar por nombre,
                código o color.
              </p>
            ) : suggestions.length === 0 ? (
              <p className="px-3 py-2 text-sm text-muted-foreground">
                Sin resultados en {fabrics.length.toLocaleString("es-CO")} telas.
              </p>
            ) : (
              <>
                <p className="border-b border-border px-3 py-2 text-xs text-muted-foreground">
                  {totalMatches.toLocaleString("es-CO")} coincidencia{totalMatches === 1 ? "" : "s"}
                  {truncated ? ` · mostrando ${SUGGESTION_LIMIT}` : ""}
                </p>
                {suggestions.map((fabric) => (
                  <button
                    key={fabric.id}
                    type="button"
                    className="flex w-full items-start justify-between gap-3 px-3 py-2.5 text-left text-sm hover:bg-muted"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => selectFabric(fabric)}
                  >
                    <span className="min-w-0 flex-1">
                      <span className="block leading-snug font-medium whitespace-normal">{fabric.name}</span>
                      {(fabric.code || fabric.color) && (
                        <span className="mt-0.5 block text-xs text-muted-foreground">
                          {[fabric.code, fabric.color].filter(Boolean).join(" · ")}
                        </span>
                      )}
                    </span>
                    {selected?.id === fabric.id && <CheckIcon className="mt-0.5 size-4 shrink-0 text-accent" />}
                  </button>
                ))}
                {truncated ? (
                  <p className="border-t border-border px-3 py-2 text-xs text-muted-foreground">
                    Afina la búsqueda para ver el resto.
                  </p>
                ) : null}
              </>
            )}
          </div>,
          document.body
        )}
    </div>
  );
}
