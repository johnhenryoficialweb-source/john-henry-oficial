"use client";

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { CheckIcon, SearchIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { formatPhoneDisplay } from "@/lib/phone/format";

export interface ClientOption {
  id: string;
  full_name: string;
  phone: string;
  email?: string | null;
  /** Cédula o documento: el identificador que no cambia con el tiempo. */
  document_id?: string | null;
  /** Sede de origen del cliente — no todos los llamadores la cargan (ej. citas). */
  home_location_id?: string | null;
  location_code?: string | null;
}

function clientSearchText(client: ClientOption): string {
  const phoneInfo = formatPhoneDisplay(client.phone, client.location_code);
  return [
    client.full_name,
    client.phone,
    phoneInfo.formatted,
    client.email,
    client.document_id,
  ]
    .filter(Boolean)
    .join(" ");
}

function clientMatches(client: ClientOption, query: string): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;

  const haystack = clientSearchText(client).toLowerCase();
  if (haystack.includes(q)) return true;

  const digits = q.replace(/\D/g, "");
  if (digits) {
    const phoneDigits = client.phone.replace(/\D/g, "");
    if (phoneDigits.includes(digits)) return true;

    /*
     * La cédula se compara sin separadores. El sastre la escribe como está
     * impresa en el documento ("1.020.304") y en la base quedó normalizada, así
     * que sin esto la búsqueda que más importa —la del documento— falla en la
     * forma en que la gente realmente lo escribe.
     */
    const documentDigits = (client.document_id ?? "").replace(/\D/g, "");
    if (documentDigits && documentDigits.includes(digits)) return true;
  }

  return false;
}

/** Selector de cliente con búsqueda predictiva sobre la lista completa cargada en servidor. */
export function ClientCombobox({
  clients,
  name,
  defaultClient,
  onSelect,
}: {
  clients: ClientOption[];
  name: string;
  defaultClient?: ClientOption | null;
  onSelect?: (client: ClientOption | null) => void;
}) {
  const [query, setQuery] = useState(defaultClient?.full_name ?? "");
  const [selected, setSelected] = useState<ClientOption | null>(defaultClient ?? null);
  const [open, setOpen] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState<{ top: number; left: number; width: number } | null>(null);

  useEffect(() => {
    if (defaultClient) {
      setSelected(defaultClient);
      setQuery(defaultClient.full_name);
    }
  }, [defaultClient]);

  const suggestions = useMemo(() => {
    const q = query.trim();
    const matches = q ? clients.filter((client) => clientMatches(client, q)) : clients;
    return matches.slice(0, 10);
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

  function selectClient(client: ClientOption) {
    setSelected(client);
    setQuery(client.full_name);
    setOpen(false);
    onSelect?.(client);
  }

  function handleQueryChange(value: string) {
    setQuery(value);
    setOpen(true);
    if (selected && value.trim() !== selected.full_name) {
      setSelected(null);
      onSelect?.(null);
    }
  }

  return (
    <div ref={wrapperRef} className="relative">
      <input type="hidden" name={name} value={selected?.id ?? ""} />
      <SearchIcon className="absolute top-1/2 left-2.5 z-10 size-4 -translate-y-1/2 text-muted-foreground" />
      <Input
        ref={inputRef}
        value={query}
        onChange={(e) => handleQueryChange(e.target.value)}
        onFocus={() => setOpen(true)}
        placeholder="Buscar por nombre, cédula, teléfono o correo…"
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
            className="z-50 max-h-64 overflow-auto rounded-lg border bg-popover py-1 shadow-md"
            style={{
              position: "fixed",
              top: position.top,
              left: position.left,
              width: position.width,
            }}
          >
            {suggestions.length === 0 ? (
              <p className="px-3 py-2 text-sm text-muted-foreground">
                Sin resultados en {clients.length} clientes.
              </p>
            ) : (
              suggestions.map((client) => {
                const phoneInfo = formatPhoneDisplay(client.phone, client.location_code);
                return (
                  <button
                    key={client.id}
                    type="button"
                    className="flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-sm hover:bg-muted"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => selectClient(client)}
                  >
                    <span className="min-w-0">
                      <span className="block font-medium">{client.full_name}</span>
                      <span className="block truncate text-xs text-muted-foreground">
                        {phoneInfo.flag} {phoneInfo.formatted}
                        {client.email ? ` · ${client.email}` : ""}
                      </span>
                    </span>
                    {selected?.id === client.id && <CheckIcon className="size-4 shrink-0 text-accent" />}
                  </button>
                );
              })
            )}
          </div>,
          document.body
        )}
    </div>
  );
}
