"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { HistoryIcon, LayersIcon, LoaderIcon, ShirtIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { GARMENT_TYPE_LABELS } from "@/lib/constants";
import { GarmentOptionsPicker } from "@/components/cms/garment-options-picker";
import { getClientGarmentSpecs, findMoldMatches } from "@/app/(cms)/(protected)/orders/actions";
import type { GarmentModelOption } from "@/components/cms/order-items-builder";
import type { GarmentSpecRef, MoldMatch } from "@/lib/orders/garment-specs";
import type { GarmentType } from "@/types/database.types";
import { cn } from "@/lib/utils";

function formatDate(iso: string): string {
  if (!iso) return "";
  return new Date(iso).toLocaleDateString("es-CO", { day: "numeric", month: "short", year: "numeric" });
}

/**
 * Detalle de confección de UNA pieza del pedido.
 *
 * Vive acá, junto a tela/cantidad/precio, y no en la ficha de medidas, porque
 * es parte de lo que se pide —no de cómo se mide el cuerpo—, y porque dos
 * piezas del mismo pedido pueden llevar detalles distintos.
 */
export function GarmentSpecEditor({
  garmentType,
  clientId,
  spec,
  onSpecChange,
  measurements,
  models,
  modelId,
  onModelSelect,
}: {
  garmentType: GarmentType;
  clientId: string | null;
  spec: string;
  onSpecChange: (spec: string) => void;
  /** Medidas de esta pieza, para buscar moldes equivalentes. */
  measurements: Record<string, number>;
  /** Modelos del catálogo para ESTA prenda. */
  models: GarmentModelOption[];
  modelId: string | null;
  /** Fija el modelo y siembra su texto base en el detalle. */
  onModelSelect: (modelId: string, description: string) => void;
}) {
  /**
   * `null` significa "todavía cargando"; `[]`, "cargado y sin resultados". Con
   * un booleano aparte harían falta dos estados para decir una sola cosa, y
   * además obligaría a un setState síncrono dentro del efecto.
   */
  const [history, setHistory] = useState<GarmentSpecRef[] | null>(null);
  const [molds, setMolds] = useState<MoldMatch[] | null>(null);
  const [loadingMolds, setLoadingMolds] = useState(false);

  const measurementsKey = useMemo(() => JSON.stringify(measurements), [measurements]);

  const loadMolds = useCallback(async () => {
    setLoadingMolds(true);
    try {
      setMolds(await findMoldMatches(garmentType, measurements, clientId));
    } catch {
      setMolds([]);
    } finally {
      setLoadingMolds(false);
    }
  }, [clientId, garmentType, measurements]);

  // Al abrir el detalle de confección (modelo), buscar moldes equivalentes sin
  // esperar un clic en "Buscar". Se vuelve a consultar si cambian las medidas.
  useEffect(() => {
    const timer = window.setTimeout(() => {
      void loadMolds();
    }, 300);
    return () => window.clearTimeout(timer);
  }, [clientId, garmentType, measurementsKey, loadMolds]);

  // El historial se carga solo: es el punto de partida más usado, y esconderlo
  // tras un clic lo apagaría justo cuando más sirve.
  useEffect(() => {
    let cancelled = false;

    async function load() {
      if (!clientId) {
        if (!cancelled) setHistory([]);
        return;
      }
      try {
        const rows = await getClientGarmentSpecs(clientId, garmentType);
        if (!cancelled) setHistory(rows);
      } catch {
        if (!cancelled) setHistory([]);
      }
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, [clientId, garmentType]);

  const label = GARMENT_TYPE_LABELS[garmentType];

  return (
    <div className="space-y-3 rounded-lg border border-border bg-muted/20 p-3">
      {/* Modelos base: el arranque más rápido. Van acá y no solo en el selector
          de la fila porque ahí el nombre se corta ("Selecciona un mo…") y
          obliga a abrir un desplegable para ver qué hay. */}
      {models.length > 0 && (
        <div className="space-y-1.5">
          <p className="flex items-center gap-1.5 text-[11px] tracking-[0.04em] text-muted-foreground uppercase">
            <ShirtIcon className="size-3" />
            Modelos de {label.toLowerCase()}
          </p>
          <div className="flex flex-wrap gap-1.5">
            {models.map((model) => {
              const selected = model.id === modelId;
              return (
                <button
                  key={model.id}
                  type="button"
                  title={model.description ?? undefined}
                  onClick={() => onModelSelect(model.id, model.description ?? "")}
                  className={cn(
                    "rounded-full border px-2.5 py-1 text-xs transition-colors",
                    selected
                      ? "border-primary bg-primary/10 text-foreground"
                      : "border-border bg-background text-muted-foreground hover:border-primary/50 hover:text-foreground"
                  )}
                >
                  {model.name}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Las opciones sueltas van ANTES del cuadro de texto: es lo que se
          responde en el 95% de las prendas, y el texto libre queda para la
          excepción. Al revés, el sastre teclearía lo que puede marcar. */}
      <GarmentOptionsPicker garmentType={garmentType} spec={spec} onSpecChange={onSpecChange} />

      <div className="space-y-1.5">
        <Label className="text-xs">Detalle de confección — {label}</Label>
        <p className="text-[11px] text-muted-foreground">
          Lo que marques arriba se escribe acá. Puedes editarlo o agregar lo que no esté en la
          lista.
        </p>
        <Textarea
          rows={3}
          value={spec}
          onChange={(e) => onSpecChange(e.target.value)}
          placeholder={
            garmentType === "saco"
              ? "Frente sencillo, 2 botones, Bolsillo tapa, Solapa clásica 8cm, Espalda dos aberturas…"
              : garmentType === "camisa"
                ? "Cuello Dany, Puño 7rd, Pespuntes 3/16, Textura normal, Pechera SI, Bolsillo NO…"
                : garmentType === "pantalon"
                  ? "Bolsillo sesgado, Pretina cruzada, Sin prenses, 2 bolsillos traseros, Bota sencilla…"
                  : "Detalles de confección de esta pieza…"
          }
          className="text-sm"
        />
      </div>

      {/* Prendas anteriores del cliente: el sastre parte de la última y la
          ajusta. Solo el 8% las repite palabra por palabra, así que se copian
          al campo para editarlas, nunca se aplican solas. */}
      <div className="space-y-1.5">
        <p className="flex items-center gap-1.5 text-[11px] tracking-[0.04em] text-muted-foreground uppercase">
          <HistoryIcon className="size-3" />
          {label}s anteriores de este cliente
        </p>
        {history == null ? (
          <p className="text-xs text-muted-foreground">Buscando…</p>
        ) : history.length === 0 ? (
          <p className="text-xs text-muted-foreground">
            {clientId ? "Sin pedidos anteriores de esta prenda." : "Selecciona un cliente para ver su historial."}
          </p>
        ) : (
          <div className="space-y-1.5">
            {history.map((ref, i) => (
              <button
                key={`${ref.orderNumber}-${i}`}
                type="button"
                onClick={() => onSpecChange(ref.spec)}
                title="Copiar al detalle para editarlo"
                className="block w-full rounded-md border border-border bg-background px-2.5 py-2 text-left transition-colors hover:border-primary/50 hover:bg-primary/5"
              >
                <span className="flex flex-wrap items-baseline gap-x-2 text-[11px] text-muted-foreground">
                  <span className="font-medium text-foreground">{ref.orderNumber ?? "Sin número"}</span>
                  <span>{formatDate(ref.createdAt)}</span>
                  {ref.fabricName && <span>· {ref.fabricName}</span>}
                </span>
                <span className="mt-0.5 line-clamp-2 block text-xs">{ref.spec}</span>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Moldes: a quién más le sirve esta prenda si el cliente no la recoge. */}
      <div className="space-y-1.5 border-t border-border pt-2.5">
        <div className="flex items-center justify-between gap-2">
          <p className="flex items-center gap-1.5 text-[11px] tracking-[0.04em] text-muted-foreground uppercase">
            <LayersIcon className="size-3" />
            Moldes equivalentes
          </p>
          <Button type="button" variant="ghost" size="sm" disabled={loadingMolds} onClick={loadMolds}>
            {loadingMolds && <LoaderIcon className="animate-spin" />}
            {molds ? "Actualizar" : "Buscar"}
          </Button>
        </div>
        {loadingMolds && molds == null ? (
          <p className="text-xs text-muted-foreground">Buscando moldes equivalentes…</p>
        ) : molds == null ? (
          <p className="text-xs text-muted-foreground">
            Otros clientes a los que les serviría esta misma prenda, por si no se recoge.
          </p>
        ) : molds.length === 0 ? (
          <p className="text-xs text-muted-foreground">
            Ningún otro cliente calza en este molde con las medidas actuales.
          </p>
        ) : (
          <ul className="space-y-1">
            {molds.map((m) => (
              <li
                key={m.clientId}
                className="flex items-center justify-between gap-2 rounded-md border border-border bg-background px-2.5 py-1.5 text-xs"
              >
                <span className="truncate">{m.fullName}</span>
                <span className="shrink-0 tabular-nums text-muted-foreground">
                  ±{m.averageDeltaCm.toFixed(1)} cm · máx {m.maxDeltaCm.toFixed(1)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
