"use client";

import { useMemo, useState } from "react";
import { toast } from "sonner";
import { XIcon, DownloadIcon, ListChecksIcon } from "lucide-react";
import {
  GARMENT_EXTRA_FIELDS,
  GARMENT_MEASUREMENT_FIELDS,
  GARMENT_TYPE_LABELS,
  getMeasurementFieldLabel,
} from "@/lib/constants";
import { getLatestMeasurement } from "@/app/(cms)/(protected)/orders/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  MeasurementMannequin,
  MeasurementFieldChips,
  estimateMeasurementsFromHeight,
  useWebglSupport,
  fabricColorToHex,
  DEFAULT_GARMENT_COLOR,
} from "@/components/measurement-digitizer";
import { FabricCombobox } from "@/components/cms/fabric-combobox";
import { countSpecGroups, countSpecSelections, parseSpec } from "@/lib/orders/garment-options";
import { cn } from "@/lib/utils";
import type { GarmentType, MeasurementUnit } from "@/types/database.types";

export const MEASURABLE_GARMENTS: GarmentType[] = ["saco", "pantalon", "camisa", "chaleco"];

export interface FabricOption {
  id: string;
  name: string;
  code: string | null;
  /** Texto libre ("Azul marino"). Siembra el color de la prenda en el visor 3D. */
  color: string | null;
  price_per_meter: number | null;
  price_currency: string;
}

export interface GarmentModelOption {
  id: string;
  garment_type: GarmentType;
  name: string;
  code: string | null;
  /** Texto base de confección: al elegir el modelo precarga el detalle. */
  description: string | null;
}

export interface OrderItemState {
  key: string;
  garmentType: GarmentType;
  fabricId: string | null;
  modelId: string | null;
  quantity: number;
  unitPrice: number;
  measurementUnit: MeasurementUnit;
  measurements: Record<string, number>;
  /**
   * Medidas que el sastre validó explícitamente. Se guarda aparte de
   * `measurements` porque un valor puede existir sin estar tomado: el maniquí
   * arranca con una estimación por altura, y eso es un punto de partida, no
   * una medida.
   */
  confirmedFields: string[];
  /**
   * Campos de texto libre (Iniciales, Material empleado, Observaciones) —
   * ver GARMENT_EXTRA_FIELDS. No son medidas en cm; es donde vive el
   * modelo/corte de ESTA pieza puntual, así dos sacos del mismo cliente
   * pueden llevar telas y diseños distintos en la misma orden.
   */
  extra: Record<string, string>;
  /**
   * Especificación de confección de ESTA pieza, en texto libre:
   * "Frente sencillo, 2 botones, Solapa clásica 8cm, Espalda dos aberturas…".
   *
   * Es texto libre y no una lista de opciones porque así funciona el oficio:
   * de las 462 especificaciones de saco del sistema anterior, 435 son
   * distintas entre sí. El modelo del catálogo y las prendas anteriores del
   * cliente sirven de punto de partida, pero el sastre siempre ajusta.
   */
  spec: string;
}

function emptyExtra(garmentType: GarmentType): Record<string, string> {
  return Object.fromEntries(GARMENT_EXTRA_FIELDS[garmentType].map((f) => [f.id, ""]));
}

/**
 * Clona una pieza para pedir la MISMA prenda con otra tela/modelo/precio —
 * el caso de "3 sacos, cada uno de una tela distinta" del mismo cliente. El
 * cuerpo no cambia entre telas, así que las medidas y lo confirmado viajan
 * tal cual; lo que sí arranca en blanco es justo lo que distingue a la pieza
 * nueva: tela, precio y observaciones (modelo/corte).
 */
export function duplicateOrderItem(item: OrderItemState): OrderItemState {
  return {
    ...item,
    key: crypto.randomUUID(),
    fabricId: null,
    modelId: null,
    quantity: 1,
    unitPrice: 0,
    extra: emptyExtra(item.garmentType),
    // La especificación se conserva a propósito: duplicar es "lo mismo en otra
    // tela", y volver a escribirla entera sería el error más caro de la pantalla.
    spec: item.spec,
  };
}

/**
 * Cada prenda lleva SUS PROPIAS medidas, sin compartir valores con las demás.
 *
 * Antes existía un pool común por nombre de campo, con la idea de no pedir
 * "cintura" dos veces si la orden tenía saco y pantalón. Es incorrecto: el
 * pecho de un saco y el de una camisa se llaman igual pero no son el mismo
 * número — llevan holguras y construcciones distintas. Compartirlos hacía que
 * tomar la camisa pisara la medida del saco en silencio.
 */
function emptyMeasurements(garmentType: GarmentType): Record<string, number> {
  return Object.fromEntries(GARMENT_MEASUREMENT_FIELDS[garmentType].map((f) => [f, 0]));
}

/**
 * Arma una pieza nueva precargada con la última medida guardada del cliente
 * PARA ESA PRENDA (si existe) y, si ya se conoce la altura de la orden, con
 * la estimación por altura como punto de partida. Es la única puerta de
 * entrada para crear una pieza — la usan tanto los botones "+ prenda" de
 * este componente como el control de agregar en la tarjeta de Precios, para
 * que agregar un saco desde cualquiera de los dos lugares se comporte
 * exactamente igual.
 */
export async function createOrderItem(
  garmentType: GarmentType,
  clientId: string | null,
  heightCm: number | null
): Promise<OrderItemState> {
  let prefill: Record<string, number> = {};
  if (clientId) {
    const existing = await getLatestMeasurement(clientId, garmentType);
    if (existing) prefill = existing.values as Record<string, number>;
  }

  const fields = GARMENT_MEASUREMENT_FIELDS[garmentType];
  const measurements = { ...emptyMeasurements(garmentType) };

  // Si ya sabemos la altura, la prenda nace con la estimación puesta — como
  // sugerencia, nunca confirmada. Sin esto, cada prenda nueva volvería a
  // pedir un dato que ya se había respondido.
  if (heightCm != null) {
    const estimate = estimateMeasurementsFromHeight(heightCm);
    for (const f of fields) measurements[f] = estimate[f] ?? 0;
  }
  // La medida real guardada del cliente pisa a la estimación: es un dato
  // tomado, no un cálculo.
  for (const f of fields) if (prefill[f] > 0) measurements[f] = prefill[f];

  return {
    key: crypto.randomUUID(),
    garmentType,
    fabricId: null,
    modelId: null,
    quantity: 1,
    unitPrice: 0,
    measurementUnit: "cm" as MeasurementUnit,
    measurements,
    confirmedFields: fields.filter((f) => prefill[f] > 0),
    extra: emptyExtra(garmentType),
    spec: "",
  };
}

export function OrderItemsBuilder({
  fabrics,
  models,
  clientId,
  items,
  onChange,
  heightCm,
  onHeightChange,
  onItemModelSelected,
}: {
  fabrics: FabricOption[];
  models: GarmentModelOption[];
  clientId: string | null;
  items: OrderItemState[];
  onChange: (items: OrderItemState[]) => void;
  /**
   * La altura es del cuerpo del cliente, no de la prenda: se pregunta una vez
   * por orden y sirve para el saco, el chaleco y la camisa por igual. Vive
   * en el padre (junto a `items`) para que el control de agregar prenda de
   * la tarjeta de Precios pueda sembrar la misma estimación que estos
   * botones, en vez de reiniciarse y volver a preguntar algo ya respondido.
   */
  heightCm: number | null;
  onHeightChange: (cm: number) => void;
  /** Al elegir modelo en la ficha de medidas, abre el detalle de confección abajo. */
  onItemModelSelected?: (itemKey: string) => void;
}) {
  const [loadingGarment, setLoadingGarment] = useState<GarmentType | null>(null);
  const [addingGarment, setAddingGarment] = useState<GarmentType | null>(null);
  const [activeKey, setActiveKey] = useState<string | null>(null);
  const [activeField, setActiveField] = useState<string | null>(null);
  /**
   * Color elegido a mano POR PIEZA. Es solo previsualización del visor 3D — no
   * viaja a `order_items`, la tela sigue siendo la fuente de verdad de qué se
   * corta. Va por `item.key` y no en un único color global porque dos sacos de
   * la misma orden pueden ir en telas distintas.
   */
  const [colorByItemKey, setColorByItemKey] = useState<Record<string, string>>({});
  const webglSupported = useWebglSupport();

  const activeItem = items.find((i) => i.key === activeKey) ?? items[0] ?? null;
  const activeFields = activeItem ? GARMENT_MEASUREMENT_FIELDS[activeItem.garmentType] : [];
  const activeConfirmed = useMemo(
    () => new Set(activeItem?.confirmedFields ?? []),
    [activeItem]
  );

  /*
   * Color efectivo de la prenda activa: lo que el sastre eligió a mano manda;
   * si no tocó nada, se deduce del color de la tela seleccionada; y si esa
   * tela no tiene color registrado, el azul marino por defecto.
   */
  const activeGarmentColor = useMemo(() => {
    if (!activeItem) return DEFAULT_GARMENT_COLOR;
    const override = colorByItemKey[activeItem.key];
    if (override) return override;
    const fabric = fabrics.find((f) => f.id === activeItem.fabricId);
    return fabricColorToHex(fabric?.color) ?? DEFAULT_GARMENT_COLOR;
  }, [activeItem, colorByItemKey, fabrics]);

  function patchItem(key: string, patch: Partial<OrderItemState>) {
    onChange(items.map((item) => (item.key === key ? { ...item, ...patch } : item)));
  }

  async function addItem(garmentType: GarmentType) {
    setAddingGarment(garmentType);
    let item: OrderItemState;
    try {
      item = await createOrderItem(garmentType, clientId, heightCm);
    } finally {
      setAddingGarment(null);
    }
    onChange([...items, item]);
    setActiveKey(item.key);
    setActiveField(null);
  }

  function removeItem(key: string) {
    const next = items.filter((item) => item.key !== key);
    onChange(next);
    if (activeKey === key) setActiveKey(next[0]?.key ?? null);
    // La pieza ya no existe: su color elegido tampoco tiene a quién pertenecer.
    setColorByItemKey((prev) => {
      if (!(key in prev)) return prev;
      const next = { ...prev };
      delete next[key];
      return next;
    });
  }

  function setFieldValue(field: string, valueCm: number) {
    if (!activeItem) return;
    patchItem(activeItem.key, {
      measurements: { ...activeItem.measurements, [field]: valueCm },
    });
  }

  function setExtraValue(key: string, fieldId: string, value: string) {
    const item = items.find((i) => i.key === key);
    if (!item) return;
    patchItem(key, { extra: { ...item.extra, [fieldId]: value } });
  }

  function confirmField(field: string) {
    if (!activeItem) return;
    if (activeItem.confirmedFields.includes(field)) return;
    patchItem(activeItem.key, { confirmedFields: [...activeItem.confirmedFields, field] });
  }

  /**
   * Se responde una sola vez en toda la orden. Siembra la estimación en la
   * prenda activa y queda guardada para las que se agreguen después.
   */
  function confirmHeight(cm: number) {
    onHeightChange(cm);
    if (!activeItem) return;
    const estimate = estimateMeasurementsFromHeight(cm);
    const fields = GARMENT_MEASUREMENT_FIELDS[activeItem.garmentType];
    const next = { ...activeItem.measurements };
    for (const f of fields) if (!(next[f] > 0)) next[f] = estimate[f] ?? 0;
    patchItem(activeItem.key, { measurements: next });
  }

  /**
   * Vuelve la prenda activa al mismo punto de partida que al agregarla: la
   * estimación por altura (si ya se conoce), sin ninguna medida confirmada.
   * No se limpia a cero — un maniquí en 0.0cm en todos los campos no es un
   * estado útil desde el que seguir midiendo, y el sastre de todos modos
   * vuelve a tocar cada medida real.
   */
  function resetMeasurements() {
    if (!activeItem) return;
    const fields = GARMENT_MEASUREMENT_FIELDS[activeItem.garmentType];
    const next = { ...activeItem.measurements };
    for (const f of fields) next[f] = 0;
    if (heightCm != null) {
      const estimate = estimateMeasurementsFromHeight(heightCm);
      for (const f of fields) next[f] = estimate[f] ?? 0;
    }
    patchItem(activeItem.key, { measurements: next, confirmedFields: [] });
    setActiveField(null);
  }

  async function loadLastMeasurement() {
    if (!activeItem) return;
    if (!clientId) {
      toast.error("Selecciona un cliente primero.");
      return;
    }
    setLoadingGarment(activeItem.garmentType);
    try {
      const measurement = await getLatestMeasurement(clientId, activeItem.garmentType);
      if (!measurement) {
        toast.info("Este cliente no tiene medidas guardadas para esta prenda.");
        return;
      }
      const values = measurement.values as Record<string, number>;
      const fields = GARMENT_MEASUREMENT_FIELDS[activeItem.garmentType];
      const next = { ...activeItem.measurements };
      for (const f of fields) if (values[f] > 0) next[f] = values[f];
      patchItem(activeItem.key, {
        measurements: next,
        // Vienen de una orden anterior: alguien ya las tomó.
        confirmedFields: Array.from(new Set([...activeItem.confirmedFields, ...fields.filter((f) => values[f] > 0)])),
      });
      toast.success("Medidas cargadas y confirmadas");
    } finally {
      setLoadingGarment(null);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        {MEASURABLE_GARMENTS.map((garment) => (
          <Button
            key={garment}
            type="button"
            variant="outline"
            size="sm"
            disabled={addingGarment !== null}
            onClick={() => addItem(garment)}
          >
            {addingGarment === garment ? "Agregando…" : `+ ${GARMENT_TYPE_LABELS[garment]}`}
          </Button>
        ))}
      </div>

      {items.length === 0 && (
        <p className="text-sm text-muted-foreground">Agrega al menos una prenda para continuar.</p>
      )}

      {items.length > 0 && activeItem && (
        <>
          <GarmentTabs
            items={items}
            fabrics={fabrics}
            activeKey={activeItem.key}
            onSelect={(key) => {
              setActiveKey(key);
              setActiveField(null);
            }}
            onRemove={removeItem}
          />

          <div className={webglSupported ? "grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px]" : "space-y-4"}>
            {webglSupported ? (
              <MeasurementMannequin
                garmentType={activeItem.garmentType}
                garmentLabel={GARMENT_TYPE_LABELS[activeItem.garmentType]}
                fields={activeFields}
                unit="cm"
                measurements={activeItem.measurements}
                confirmedFields={activeConfirmed}
                heightCm={heightCm}
                onHeightConfirm={confirmHeight}
                garmentColor={activeGarmentColor}
                onGarmentColorChange={(hex) =>
                  setColorByItemKey((prev) => ({ ...prev, [activeItem.key]: hex }))
                }
                activeField={activeField}
                onActiveFieldChange={setActiveField}
                onFieldChange={setFieldValue}
                onConfirmField={confirmField}
                onBulkChange={(valuesCm) =>
                  patchItem(activeItem.key, {
                    measurements: { ...activeItem.measurements, ...valuesCm },
                  })
                }
                onResetMeasurements={resetMeasurements}
              />
            ) : null}

            <GarmentPanel
              item={activeItem}
              fabrics={fabrics}
              models={models.filter((m) => m.garment_type === activeItem.garmentType)}
              loading={loadingGarment === activeItem.garmentType}
              webglSupported={!!webglSupported}
              activeField={activeField}
              confirmedFields={activeConfirmed}
              onSelectField={setActiveField}
              onFieldValueChange={setFieldValue}
              onExtraChange={(fieldId, value) => setExtraValue(activeItem.key, fieldId, value)}
              onUpdate={(patch) => patchItem(activeItem.key, patch)}
              onLoadLastMeasurement={loadLastMeasurement}
              onModelSelected={() => onItemModelSelected?.(activeItem.key)}
            />
          </div>
        </>
      )}
    </div>
  );
}

/**
 * Una prenda a la vez. Antes cada prenda traía su propia tarjeta apilada con
 * sus propios chips, y con tres prendas la pantalla era una columna de fichas
 * casi idénticas donde no se sabía cuál estabas midiendo.
 *
 * Cuando hay más de una prenda del mismo tipo (dos sacos con telas
 * distintas, por ejemplo) la pestaña se distingue por la tela elegida —
 * "Saco" a secas dos veces en la misma fila no dice cuál es cuál.
 */
function GarmentTabs({
  items,
  fabrics,
  activeKey,
  onSelect,
  onRemove,
}: {
  items: OrderItemState[];
  fabrics: FabricOption[];
  activeKey: string;
  onSelect: (key: string) => void;
  onRemove: (key: string) => void;
}) {
  const countsByGarment = items.reduce<Record<string, number>>((acc, item) => {
    acc[item.garmentType] = (acc[item.garmentType] ?? 0) + 1;
    return acc;
  }, {});
  const ordinalSoFar: Record<string, number> = {};

  return (
    <div className="flex flex-wrap items-stretch gap-px border-b border-border">
      {items.map((item) => {
        const fields = GARMENT_MEASUREMENT_FIELDS[item.garmentType];
        const confirmed = item.confirmedFields.length;
        const done = confirmed === fields.length;
        const active = item.key === activeKey;

        ordinalSoFar[item.garmentType] = (ordinalSoFar[item.garmentType] ?? 0) + 1;
        const hasDuplicates = countsByGarment[item.garmentType] > 1;
        const fabricName = fabrics.find((f) => f.id === item.fabricId)?.name ?? null;
        const disambiguator = hasDuplicates
          ? fabricName
            ? ` · ${fabricName}`
            : ` #${ordinalSoFar[item.garmentType]}`
          : "";
        const tabLabel = `${GARMENT_TYPE_LABELS[item.garmentType]}${disambiguator}`;
        const hasExtra = Object.values(item.extra).some((v) => v.trim().length > 0);

        return (
          <div
            key={item.key}
            className={cn(
              "group/tab relative flex items-center gap-2 border-b-2 px-4 py-2.5 transition-colors",
              active
                ? "border-primary bg-primary/5"
                : "border-transparent hover:bg-muted/40"
            )}
          >
            <button
              type="button"
              onClick={() => onSelect(item.key)}
              className="flex items-center gap-2 text-left"
            >
              <span
                aria-hidden
                className={cn(
                  "size-2 shrink-0 rounded-full transition-colors",
                  done ? "bg-[#6f9c7d]" : confirmed > 0 ? "bg-primary/50" : "bg-muted-foreground/30"
                )}
              />
              <span className={cn("text-sm", active ? "font-medium text-foreground" : "text-muted-foreground")}>
                {tabLabel}
              </span>
              <span className="text-xs tabular-nums text-muted-foreground">
                {confirmed}/{fields.length}
              </span>
              {/* Marca visualmente que esta pieza tiene datos adicionales
                  (iniciales/tela.m/observaciones) sin tener que abrirla. */}
              {hasExtra && (
                <span
                  aria-label="Tiene datos adicionales"
                  title="Tiene datos adicionales"
                  className="size-1.5 shrink-0 rounded-full bg-[var(--jh-gold)]"
                />
              )}
            </button>
            <button
              type="button"
              onClick={() => onRemove(item.key)}
              aria-label={`Quitar ${tabLabel}`}
              className="text-muted-foreground opacity-0 transition-opacity group-hover/tab:opacity-100 hover:text-foreground focus-visible:opacity-100"
            >
              <XIcon className="size-3.5" />
            </button>
          </div>
        );
      })}
    </div>
  );
}

function GarmentPanel({
  item,
  fabrics,
  models,
  loading,
  webglSupported,
  activeField,
  confirmedFields,
  onSelectField,
  onFieldValueChange,
  onExtraChange,
  onUpdate,
  onLoadLastMeasurement,
  onModelSelected,
}: {
  item: OrderItemState;
  fabrics: FabricOption[];
  models: GarmentModelOption[];
  loading: boolean;
  webglSupported: boolean;
  activeField: string | null;
  confirmedFields: Set<string>;
  onSelectField: (field: string) => void;
  onFieldValueChange: (field: string, valueCm: number) => void;
  onExtraChange: (fieldId: string, value: string) => void;
  onUpdate: (patch: Partial<OrderItemState>) => void;
  onLoadLastMeasurement: () => void;
  onModelSelected?: () => void;
}) {
  const fields = GARMENT_MEASUREMENT_FIELDS[item.garmentType];
  const pending = fields.filter((f) => !confirmedFields.has(f));
  const specCount = countSpecSelections(parseSpec(item.garmentType, item.spec));
  const specGroupCount = countSpecGroups(item.garmentType);
  const extraFields = GARMENT_EXTRA_FIELDS[item.garmentType];
  const filledExtraCount = extraFields.filter((f) => (item.extra[f.id] ?? "").trim().length > 0).length;

  return (
    <Card>
      <CardContent className="space-y-4 pt-6">
        <div className="space-y-2">
          <Label>Tela</Label>
          <FabricCombobox
            fabrics={fabrics}
            value={item.fabricId}
            onValueChange={(fabricId) => onUpdate({ fabricId })}
            aria-label={`Tela — ${GARMENT_TYPE_LABELS[item.garmentType]}`}
          />
        </div>

        <div className="space-y-2">
          <Label>Modelo</Label>
          {models.length === 0 ? (
            <p className="text-xs text-muted-foreground">
              Sin modelos en el catálogo para esta prenda —{" "}
              <a href="/garment-models/nueva" target="_blank" rel="noreferrer" className="underline">
                agrega uno
              </a>
              .
            </p>
          ) : (
            <Select
              value={item.modelId}
              onValueChange={(value) => {
                const model = models.find((m) => m.id === value);
                onUpdate({
                  modelId: value,
                  spec: item.spec.trim() ? item.spec : (model?.description ?? ""),
                });
                onModelSelected?.();
              }}
              items={models.map((model) => ({ value: model.id, label: model.name }))}
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Selecciona un modelo" />
              </SelectTrigger>
              <SelectContent>
                {models.map((model) => (
                  <SelectItem key={model.id} value={model.id}>
                    {model.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </div>

        {/* Puente hacia el detalle de confección. Sin esto, las opciones de la
            prenda (frente, bolsillos, espalda…) solo se alcanzaban desde un
            icono en la tabla de precios, más abajo: quien estaba midiendo no
            tenía forma de saber que existían. */}
        {onModelSelected && specGroupCount > 0 && (
          <button
            type="button"
            onClick={onModelSelected}
            className="flex w-full items-center justify-between gap-2 rounded-lg border border-border bg-background px-2.5 py-2 text-left transition-colors hover:border-primary/50 hover:bg-primary/5"
          >
            <span className="flex items-center gap-1.5 text-xs">
              <ListChecksIcon
                className={cn("size-3.5", specCount > 0 ? "text-[var(--jh-gold)]" : "text-muted-foreground")}
              />
              Opciones de confección
            </span>
            <span className="shrink-0 text-[11px] tabular-nums text-muted-foreground">
              {specCount > 0 ? `${specCount} de ${specGroupCount} marcadas` : "sin marcar"}
            </span>
          </button>
        )}

        <div className="flex items-center justify-between">
          <Label className="text-xs text-muted-foreground">Medidas</Label>
          <Button type="button" variant="ghost" size="sm" disabled={loading} onClick={onLoadLastMeasurement}>
            <DownloadIcon />
            Cargar última medida
          </Button>
        </div>

        {/* Dice qué falta, no solo cuánto: "faltan 3" obliga a buscarlas una
            por una en la cuadrícula. */}
        {pending.length > 0 ? (
          <p className="text-xs text-muted-foreground">
            Sin confirmar:{" "}
            <span className="text-foreground/80">
              {pending.map((f) => getMeasurementFieldLabel(item.garmentType, f)).join(" · ")}
            </span>
          </p>
        ) : (
          <p className="text-xs text-[#6f9c7d]">Todas las medidas confirmadas.</p>
        )}

        {webglSupported ? (
          <MeasurementFieldChips
            garmentType={item.garmentType}
            fields={fields}
            measurements={item.measurements}
            confirmedFields={confirmedFields}
            activeField={activeField}
            onSelect={onSelectField}
          />
        ) : (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {fields.map((field) => (
              <div key={field} className="space-y-1">
                <Label className="text-xs">{getMeasurementFieldLabel(item.garmentType, field)}</Label>
                <Input
                  type="number"
                  step="0.1"
                  value={item.measurements[field] ?? 0}
                  onChange={(e) => onFieldValueChange(field, Number(e.target.value))}
                />
              </div>
            ))}
          </div>
        )}

        {extraFields.length > 0 && (
          <div className="space-y-3 border-t border-border pt-4">
            <div className="flex items-center gap-2">
              <Label className="text-xs text-muted-foreground">Datos adicionales</Label>
              {filledExtraCount > 0 && (
                <span className="rounded-full bg-[var(--jh-gold)]/15 px-1.5 py-0.5 text-[10px] font-medium text-[var(--jh-gold)]">
                  {filledExtraCount}
                </span>
              )}
            </div>
            {extraFields.map((extraField) =>
              extraField.kind === "textarea" ? (
                <div key={extraField.id} className="space-y-1">
                  <Label className="text-xs">{extraField.label}</Label>
                  <Textarea
                    rows={2}
                    placeholder={extraField.help}
                    value={item.extra[extraField.id] ?? ""}
                    onChange={(e) => onExtraChange(extraField.id, e.target.value)}
                  />
                </div>
              ) : (
                <div key={extraField.id} className="space-y-1">
                  <Label className="text-xs">{extraField.label}</Label>
                  <Input
                    value={item.extra[extraField.id] ?? ""}
                    placeholder={extraField.help}
                    onChange={(e) => onExtraChange(extraField.id, e.target.value)}
                  />
                </div>
              )
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
