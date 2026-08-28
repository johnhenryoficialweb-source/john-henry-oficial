"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2Icon, PlusIcon, RulerIcon } from "lucide-react";
import {
  GARMENT_MEASUREMENT_FIELDS,
  GARMENT_TYPE_LABELS,
  getMeasurementFieldLabel,
} from "@/lib/constants";
import { saveClientGarmentMeasurement } from "@/app/(cms)/(protected)/clients/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { GarmentType } from "@/types/database.types";

/** Orden de pestañas: Saco → Camisa → Pantalón → Chaleco. */
const GARMENT_ORDER: GarmentType[] = ["saco", "camisa", "pantalon", "chaleco"];

export interface ClientMeasurementRecord {
  garmentType: GarmentType;
  values: Record<string, number>;
  unit: string;
  takenAt: string;
}

type GarmentDraft = {
  values: Record<string, number>;
  unit: string;
  takenAt: string | null;
};

function formatTakenAt(value: string): string {
  return new Date(value).toLocaleDateString("es-CO", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function garmentProgress(record: GarmentDraft, garment: GarmentType) {
  const fields = GARMENT_MEASUREMENT_FIELDS[garment];
  const taken = fields.filter((field) => (record.values[field] ?? 0) > 0);
  return {
    fields,
    taken,
    percent: fields.length > 0 ? Math.round((taken.length / fields.length) * 100) : 0,
    complete: taken.length === fields.length,
    hasAny: taken.length > 0,
  };
}

function defaultGarmentTab(draft: Record<GarmentType, GarmentDraft>): GarmentType {
  return (
    GARMENT_ORDER.find((garment) => garmentProgress(draft[garment], garment).hasAny) ?? "saco"
  );
}

function buildInitialDraft(measurements: ClientMeasurementRecord[]): Record<GarmentType, GarmentDraft> {
  const byGarment = new Map(measurements.map((m) => [m.garmentType, m]));

  return Object.fromEntries(
    GARMENT_ORDER.map((garment) => {
      const record = byGarment.get(garment);
      const fields = GARMENT_MEASUREMENT_FIELDS[garment];
      const values = Object.fromEntries(
        fields.map((field) => [field, record?.values[field] ?? 0])
      );
      return [
        garment,
        {
          values,
          unit: record?.unit ?? "cm",
          takenAt: record?.takenAt ?? null,
        },
      ];
    })
  ) as Record<GarmentType, GarmentDraft>;
}

export function ClientMeasurementsPanel({
  clientId,
  measurements,
}: {
  clientId: string;
  measurements: ClientMeasurementRecord[];
}) {
  const router = useRouter();
  const [draft, setDraft] = useState(() => buildInitialDraft(measurements));
  const [activeTab, setActiveTab] = useState<GarmentType>(() =>
    defaultGarmentTab(buildInitialDraft(measurements))
  );
  const draftKey = measurements.map((m) => `${m.garmentType}:${m.takenAt}`).join("|");

  useEffect(() => {
    setDraft(buildInitialDraft(measurements));
  }, [draftKey, measurements]);

  const hasAnyMeasurement = useMemo(
    () =>
      GARMENT_ORDER.some((garment) =>
        GARMENT_MEASUREMENT_FIELDS[garment].some((field) => (draft[garment].values[field] ?? 0) > 0)
      ),
    [draft]
  );

  async function saveGarmentField(garment: GarmentType, field: string, value: number) {
    const unit = draft[garment].unit as "cm" | "in";
    const nextValues = { ...draft[garment].values, [field]: value };
    setDraft((current) => ({
      ...current,
      [garment]: { ...current[garment], values: nextValues },
    }));

    try {
      await saveClientGarmentMeasurement(clientId, garment, nextValues, unit);
      toast.success(`${GARMENT_TYPE_LABELS[garment]} guardado`);
      router.refresh();
    } catch (err) {
      setDraft(buildInitialDraft(measurements));
      toast.error(err instanceof Error ? err.message : "No se pudo guardar");
      throw err;
    }
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between gap-4 space-y-0">
        <div className="space-y-1">
          <CardTitle>Medidas guardadas</CardTitle>
          <p className="text-xs text-muted-foreground">
            Edita cualquier campo; al salir se guarda una nueva versión vigente. Se reutilizan al crear
            una orden nueva.
          </p>
        </div>
        {hasAnyMeasurement && (
          <Button variant="ghost" size="sm" render={<Link href={`/clients/${clientId}/medidas`} />}>
            Ver historial
          </Button>
        )}
      </CardHeader>

      <CardContent className="space-y-4">
        {!hasAnyMeasurement ? (
          <div className="flex flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-border py-6 text-center">
            <RulerIcon className="size-7 text-muted-foreground" />
            <div className="space-y-1">
              <p className="font-medium">Sin medidas registradas</p>
              <p className="max-w-sm text-sm text-muted-foreground">
                Completa los campos en las pestañas o tómalas al crear una orden.
              </p>
            </div>
            <Button size="sm" className="mt-1" render={<Link href={`/orders/nueva?clientId=${clientId}`} />}>
              <PlusIcon />
              Tomar medidas en una orden
            </Button>
          </div>
        ) : null}

        <div className="space-y-4">
          <div
            className="flex items-stretch overflow-x-auto border-b border-border"
            role="tablist"
            aria-label="Tipo de prenda"
          >
            {GARMENT_ORDER.map((garment) => {
              const { taken, fields, complete, hasAny } = garmentProgress(draft[garment], garment);
              const active = activeTab === garment;

              return (
                <button
                  key={garment}
                  type="button"
                  role="tab"
                  aria-selected={active}
                  onClick={() => setActiveTab(garment)}
                  className={cn(
                    "flex min-w-0 flex-1 items-center justify-center gap-2 border-b-2 px-2 py-2.5 transition-colors sm:px-4",
                    active
                      ? "border-primary bg-primary/5"
                      : "border-transparent text-muted-foreground hover:bg-muted/40 hover:text-foreground"
                  )}
                >
                  <span
                    aria-hidden
                    className={cn(
                      "size-2 shrink-0 rounded-full",
                      complete ? "bg-[#6f9c7d]" : hasAny ? "bg-primary/50" : "bg-muted-foreground/30"
                    )}
                  />
                  <span className={cn("truncate text-sm", active && "font-medium text-foreground")}>
                    {GARMENT_TYPE_LABELS[garment]}
                  </span>
                  <span
                    className={cn(
                      "shrink-0 text-xs tabular-nums",
                      complete ? "text-[#6f9c7d]" : "text-muted-foreground"
                    )}
                  >
                    {taken.length}/{fields.length}
                  </span>
                </button>
              );
            })}
          </div>

          <div role="tabpanel" aria-label={GARMENT_TYPE_LABELS[activeTab]}>
            <EditableGarmentBlock
              garment={activeTab}
              record={draft[activeTab]}
              onSaveField={saveGarmentField}
            />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function EditableGarmentBlock({
  garment,
  record,
  onSaveField,
}: {
  garment: GarmentType;
  record: GarmentDraft;
  onSaveField: (garment: GarmentType, field: string, value: number) => Promise<void>;
}) {
  const { fields, taken, percent, complete, hasAny } = garmentProgress(record, garment);

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        <span
          className={cn(
            "text-xs tabular-nums",
            complete ? "text-[#6f9c7d]" : "text-muted-foreground"
          )}
        >
          {taken.length} de {fields.length} medidas
        </span>
        {record.takenAt ? (
          <span className="text-xs text-muted-foreground">
            Tomada el {formatTakenAt(record.takenAt)}
          </span>
        ) : (
          <span className="text-xs text-muted-foreground">Sin registro todavía</span>
        )}
      </div>

      <div className="h-1 overflow-hidden rounded-full bg-muted">
        <div
          className={cn("h-full rounded-full transition-all", complete ? "bg-[#6f9c7d]" : "bg-primary")}
          style={{ width: `${percent}%` }}
        />
      </div>

      <div className="@container">
        <div className="grid grid-cols-2 gap-2 @sm:grid-cols-3 @2xl:grid-cols-5">
          {fields.map((field) => (
            <MeasurementFieldCell
              key={field}
              garment={garment}
              field={field}
              value={record.values[field] ?? 0}
              unit={record.unit}
              hasAnyInGarment={hasAny}
              onSave={onSaveField}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

function MeasurementFieldCell({
  garment,
  field,
  value,
  unit,
  hasAnyInGarment,
  onSave,
}: {
  garment: GarmentType;
  field: string;
  value: number;
  unit: string;
  hasAnyInGarment: boolean;
  onSave: (garment: GarmentType, field: string, value: number) => Promise<void>;
}) {
  const [draft, setDraft] = useState(value > 0 ? String(value) : "");
  const [isPending, setIsPending] = useState(false);

  useEffect(() => {
    setDraft(value > 0 ? String(value) : "");
  }, [value]);

  const hasValue = value > 0;

  async function save() {
    const trimmed = draft.trim();
    const parsed = trimmed === "" ? 0 : Number(trimmed.replace(",", "."));
    if (trimmed !== "" && Number.isNaN(parsed)) {
      setDraft(hasValue ? String(value) : "");
      toast.error("Ingresa un número válido");
      return;
    }
    if (parsed === value) return;
    if (parsed === 0 && !hasAnyInGarment && trimmed === "") return;

    setIsPending(true);
    try {
      await onSave(garment, field, parsed);
    } catch {
      // El error ya se muestra en el panel.
    } finally {
      setIsPending(false);
    }
  }

  return (
    <div
      className={cn(
        "flex min-h-[4.25rem] flex-col items-start justify-between gap-1.5 rounded-lg border px-3 py-2.5",
        hasValue || draft.trim() ? "border-border bg-muted/30" : "border-dashed border-border/70 bg-transparent"
      )}
    >
      <span className="text-[10px] leading-tight font-medium tracking-[0.08em] text-muted-foreground uppercase">
        {getMeasurementFieldLabel(garment, field)}
      </span>
      <span className="flex w-full items-baseline gap-1.5">
        <Input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={save}
          onKeyDown={(e) => {
            if (e.key === "Enter") e.currentTarget.blur();
          }}
          inputMode="decimal"
          placeholder="—"
          disabled={isPending}
          className={cn(
            "h-auto min-h-8 border-transparent bg-transparent px-0 py-0 font-heading text-2xl leading-none tabular-nums shadow-none focus-visible:border-ring md:text-2xl",
            isPending && "opacity-60"
          )}
        />
        <span className="shrink-0 text-xs text-muted-foreground">{unit}</span>
        {isPending && <Loader2Icon className="size-3.5 animate-spin text-muted-foreground" />}
      </span>
    </div>
  );
}
