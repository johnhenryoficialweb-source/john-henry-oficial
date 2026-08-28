"use client";

import { useEffect, useMemo, useState } from "react";
import { unstable_rethrow } from "next/navigation";
import { toast } from "sonner";
import { CheckIcon, CopyPlusIcon, ListChecksIcon, PlusIcon, XIcon } from "lucide-react";
import { ClientCombobox, type ClientOption } from "@/components/cms/client-combobox";
import { FabricCombobox } from "@/components/cms/fabric-combobox";
import {
  MEASURABLE_GARMENTS,
  OrderItemsBuilder,
  createOrderItem,
  duplicateOrderItem,
  type FabricOption,
  type GarmentModelOption,
  type OrderItemState,
} from "@/components/cms/order-items-builder";
import { GarmentSpecEditor } from "@/components/cms/garment-spec-editor";
import {
  createClientInline,
  type DocumentOwner,
} from "@/app/(cms)/(protected)/clients/actions";
import { DocumentIdField } from "@/components/cms/document-id-field";
import { createOrder } from "@/app/(cms)/(protected)/orders/actions";
import { formatCurrency } from "@/lib/currency/exchange";
import { cn } from "@/lib/utils";
import {
  channelFee,
  channelFeeLabel,
  fallbackMethodOf,
  isFallbackChannel,
  resolveChannels,
  type PaymentChannelOption,
} from "@/lib/finance/labels";
import { GARMENT_TYPE_LABELS, formatGarmentExtraNotes } from "@/lib/constants";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { CurrencyCode, GarmentType } from "@/types/database.types";

type LocationOption = { id: string; name: string; currency: string; code?: string };
type Step = 1 | 2;

const STEP_LABELS: Record<Step, string> = {
  1: "Cliente",
  2: "Prendas y confirmación",
};

export function NewOrderWizard({
  clients,
  fabrics,
  garmentModels,
  locations,
  channels,
  defaultClient,
  defaultLocationId,
}: {
  clients: ClientOption[];
  fabrics: FabricOption[];
  garmentModels: GarmentModelOption[];
  locations: LocationOption[];
  /** Medios de cobro con su comisión, para el abono inicial. */
  channels: PaymentChannelOption[];
  defaultClient?: ClientOption | null;
  defaultLocationId?: string;
}) {
  const [step, setStep] = useState<Step>(defaultClient ? 2 : 1);
  const [clientMode, setClientMode] = useState<"existing" | "new">("existing");
  const [existingClient, setExistingClient] = useState<ClientOption | null>(defaultClient ?? null);
  const [newClient, setNewClient] = useState({
    fullName: "",
    phone: "",
    email: "",
    documentId: "",
    homeLocationId: defaultLocationId ?? locations[0]?.id ?? "",
  });

  const [items, setItems] = useState<OrderItemState[]>([]);
  /**
   * Vive acá (no dentro de OrderItemsBuilder) para que agregar una prenda
   * desde la tarjeta de Precios siembre la misma estimación por altura que
   * los botones "+ prenda" de arriba — un solo dato de altura para toda la
   * orden, sin importar desde dónde se agregue la pieza.
   */
  const [heightCm, setHeightCm] = useState<number | null>(null);
  const [addingGarment, setAddingGarment] = useState<GarmentType | null>(null);
  /** Solo una pieza abierta a la vez: el detalle es alto y con dos abiertas
   *  la tabla deja de leerse como una tabla. */
  const [expandedSpecKey, setExpandedSpecKey] = useState<string | null>(null);
  /**
   * Smart default: si ya hay cliente (por URL o porque se acaba de crear
   * uno nuevo), la sede arranca en SU sede de origen — no en la de la
   * sesión — para que la moneda de la orden coincida con la del cliente sin
   * que el sastre tenga que acordarse de cambiarla.
   */
  const [locationId, setLocationId] = useState(() => {
    if (defaultClient?.home_location_id && locations.some((l) => l.id === defaultClient.home_location_id)) {
      return defaultClient.home_location_id;
    }
    return defaultLocationId ?? locations[0]?.id ?? "";
  });
  const [expectedDeliveryDate, setExpectedDeliveryDate] = useState("");
  const [advancePayment, setAdvancePayment] = useState(0);
  // Medios base mientras no haya canales configurados: el tipo de pago del
  // abono se registra igual, solo que sin comisión.
  const payChannels = resolveChannels(channels);
  const [advanceChannelId, setAdvanceChannelId] = useState(() => payChannels[0]?.id ?? "");
  const [discount, setDiscount] = useState(0);
  const [creatingClient, setCreatingClient] = useState(false);
  // La cédula no puede repetirse: con choque, el paso 1 no avanza.
  const [documentConflict, setDocumentConflict] = useState<DocumentOwner | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const currentClientId = existingClient?.id ?? null;
  const selectedLocation = locations.find((l) => l.id === locationId);
  const clientHomeLocation = existingClient?.home_location_id
    ? locations.find((l) => l.id === existingClient.home_location_id)
    : null;

  // La moneda sigue la sede de origen del cliente (CO → COP, PA → USD). Si aún
  // no hay sede sincronizada, cae en la sede de la orden o en el código de país.
  const currency = useMemo((): CurrencyCode => {
    if (clientHomeLocation?.currency) return clientHomeLocation.currency as CurrencyCode;
    if (existingClient?.location_code === "CO") return "COP";
    if (existingClient?.location_code === "PA") return "USD";
    return (selectedLocation?.currency ?? "USD") as CurrencyCode;
  }, [clientHomeLocation, existingClient?.location_code, selectedLocation]);

  const priceStep = currency === "COP" ? 1 : 0.01;
  const currencyLabel = currency === "COP" ? "COP" : "USD";

  // Mantener la sede de la orden alineada con la del cliente para que precios,
  // totales y la orden guardada usen la misma moneda.
  useEffect(() => {
    const homeId = existingClient?.home_location_id;
    if (!homeId || !locations.some((l) => l.id === homeId)) return;
    setLocationId(homeId);
  }, [existingClient?.id, existingClient?.home_location_id, locations]);

  /**
   * Único punto de entrada para fijar el cliente existente de la orden:
   * además de guardarlo, adopta su sede de origen como sede de la orden (y
   * por lo tanto su moneda), sin bloquear que el sastre la cambie luego con
   * el selector de Sede de la tarjeta de confirmación.
   */
  function selectExistingClient(client: ClientOption | null) {
    setExistingClient(client);
    if (client?.home_location_id && locations.some((l) => l.id === client.home_location_id)) {
      setLocationId(client.home_location_id);
    }
  }

  const expandedItem = items.find((i) => i.key === expandedSpecKey) ?? null;

  const subtotal = useMemo(
    () => items.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0),
    [items]
  );
  const total = Math.max(subtotal - discount, 0);
  const advanceChannel = payChannels.find((option) => option.id === advanceChannelId) ?? null;
  const advanceFee = advanceChannel ? channelFee(advanceChannel, advancePayment) : 0;

  const step1Valid =
    clientMode === "existing"
      ? !!existingClient
      : newClient.fullName.trim().length > 0 &&
        newClient.phone.trim().length > 0 &&
        !!newClient.homeLocationId &&
        !documentConflict;

  async function handleContinueFromStep1() {
    if (!step1Valid) return;

    if (clientMode === "existing") {
      setStep(2);
      return;
    }

    setCreatingClient(true);
    try {
      const client = await createClientInline({
        fullName: newClient.fullName,
        phone: newClient.phone,
        email: newClient.email,
        documentId: newClient.documentId,
        homeLocationId: newClient.homeLocationId,
      });
      setExistingClient(client);
      setLocationId(newClient.homeLocationId);
      toast.success("Cliente creado");
      setStep(2);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "No se pudo crear el cliente.");
    } finally {
      setCreatingClient(false);
    }
  }

  async function addGarmentFromPricing(garmentType: GarmentType) {
    setAddingGarment(garmentType);
    try {
      const item = await createOrderItem(garmentType, currentClientId, heightCm);
      setItems((prev) => [...prev, item]);
    } finally {
      setAddingGarment(null);
    }
  }

  async function handleCreateOrder() {
    if (!currentClientId || !locationId) {
      toast.error("Falta el cliente o la sede.");
      return;
    }
    if (items.length === 0) {
      toast.error("Agrega al menos una prenda a la orden.");
      return;
    }

    setSubmitting(true);
    try {
      // createOrder redirige a /orders/[id] al terminar (nunca retorna en
      // el caso de éxito) — el control de flujo real es ese throw interno.
      await createOrder({
        clientId: currentClientId,
        locationId,
        expectedDeliveryDate,
        advancePayment,
        advanceChannelId:
          advanceChannelId && !isFallbackChannel(advanceChannelId) ? advanceChannelId : null,
        advanceMethod:
          advanceChannelId && isFallbackChannel(advanceChannelId)
            ? fallbackMethodOf(advanceChannelId)
            : null,
        discount,
        items: items.map((item) => ({
          garmentType: item.garmentType,
          fabricId: item.fabricId,
          garmentModelId: item.modelId,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          measurements: item.measurements,
          measurementUnit: item.measurementUnit,
          // El detalle de confección manda; los campos extra (iniciales,
          // material) se anexan debajo para no perderlos.
          notes: [item.spec.trim(), formatGarmentExtraNotes(item.garmentType, item.extra)]
            .filter(Boolean)
            .join("\n"),
        })),
      });
    } catch (error) {
      unstable_rethrow(error);
      toast.error(error instanceof Error ? error.message : "No se pudo crear la orden.");
      setSubmitting(false);
    }
  }

  return (
    <div className="space-y-6">
      <WizardHeader step={step} />

      {step === 1 && (
        <Card>
          <CardContent className="space-y-4 pt-6">
            <div className="flex gap-1 rounded-lg bg-muted p-0.5">
              <Button
                type="button"
                size="sm"
                className="flex-1"
                variant={clientMode === "existing" ? "default" : "ghost"}
                onClick={() => setClientMode("existing")}
              >
                Cliente existente
              </Button>
              <Button
                type="button"
                size="sm"
                className="flex-1"
                variant={clientMode === "new" ? "default" : "ghost"}
                onClick={() => setClientMode("new")}
              >
                Cliente nuevo
              </Button>
            </div>

            {clientMode === "existing" ? (
              <div className="space-y-2">
                <Label>Buscar cliente</Label>
                <ClientCombobox
                  name="clientId"
                  clients={clients}
                  defaultClient={existingClient}
                  onSelect={selectExistingClient}
                />
              </div>
            ) : (
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="newFullName">Nombre completo</Label>
                  <Input
                    id="newFullName"
                    value={newClient.fullName}
                    onChange={(e) => setNewClient((c) => ({ ...c, fullName: e.target.value }))}
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="newPhone">Teléfono</Label>
                    <Input
                      id="newPhone"
                      value={newClient.phone}
                      onChange={(e) => setNewClient((c) => ({ ...c, phone: e.target.value }))}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="newEmail">Correo (opcional)</Label>
                    <Input
                      id="newEmail"
                      type="email"
                      value={newClient.email}
                      onChange={(e) => setNewClient((c) => ({ ...c, email: e.target.value }))}
                    />
                  </div>
                </div>
                <DocumentIdField
                  id="newDocumentId"
                  label="Cédula o documento (opcional)"
                  value={newClient.documentId}
                  onChange={(value) => setNewClient((c) => ({ ...c, documentId: value }))}
                  onConflictChange={setDocumentConflict}
                />
                <div className="space-y-2">
                  <Label htmlFor="newHomeLocation">Sede</Label>
                  <Select
                    value={newClient.homeLocationId || null}
                    onValueChange={(v) => setNewClient((c) => ({ ...c, homeLocationId: v ?? "" }))}
                    items={locations.map((loc) => ({ value: loc.id, label: loc.name }))}
                  >
                    <SelectTrigger id="newHomeLocation" className="w-full">
                      <SelectValue placeholder="Selecciona una sede" />
                    </SelectTrigger>
                    <SelectContent>
                      {locations.map((loc) => (
                        <SelectItem key={loc.id} value={loc.id}>
                          {loc.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            )}

            <Button
              type="button"
              className="w-full"
              size="lg"
              disabled={!step1Valid || creatingClient}
              onClick={handleContinueFromStep1}
            >
              {creatingClient ? "Creando cliente…" : "Continuar"}
            </Button>
          </CardContent>
        </Card>
      )}

      {step === 2 && (
        <div className="space-y-6">
          <div className="flex items-center justify-between rounded-lg border border-border bg-muted/40 px-3 py-2">
            <p className="text-sm">
              Cliente: <span className="font-medium">{existingClient?.full_name}</span>{" "}
              <span className="text-muted-foreground">
                · {existingClient?.phone}
                {clientHomeLocation && <> · Sede de origen: {clientHomeLocation.name}</>}
              </span>
            </p>
            <Button type="button" variant="ghost" size="sm" onClick={() => setStep(1)}>
              Cambiar
            </Button>
          </div>

          <OrderItemsBuilder
            fabrics={fabrics}
            models={garmentModels}
            clientId={currentClientId}
            items={items}
            onChange={setItems}
            heightCm={heightCm}
            onHeightChange={setHeightCm}
            onItemModelSelected={setExpandedSpecKey}
          />

          <Card>
            <CardContent className="space-y-3 pt-6">
              <div>
                <p className="font-heading text-lg">Precios</p>
                <p className="text-xs text-muted-foreground">
                  Montos en {currencyLabel}. El sastre define tela, cantidad y costo por prenda una
                  vez confirmadas las medidas. Un mismo cliente puede llevar varias piezas de
                  cualquier tipo, cada una con su propia tela, modelo y precio — usa &ldquo;Duplicar
                  con otra tela&rdquo; en vez de subir la cantidad cuando las piezas no son idénticas.
                </p>
              </div>

              {items.length > 0 && (
                /* overflow-x-auto + min-w fijo: con telas de nombre largo la fila
                   no tiene espacio de sobra para comprimirse sin volverse
                   ilegible, así que en pantallas angostas se scrollea en vez de
                   traslaparse. */
                /* pb-3: en macOS la barra de scroll flota ENCIMA del contenido,
                   y sin ese colchón tapaba los botones de acción de la fila —
                   el de "detalle de confección" quedaba imposible de pulsar. */
                <div className="-mx-1 overflow-x-auto px-1 pb-3">
                  <div className="min-w-[46rem] space-y-1.5">
                    <div className="grid grid-cols-[5rem_minmax(7rem,1fr)_minmax(7rem,1fr)_3.5rem_5rem_5rem_5rem] gap-2 px-0.5 text-[11px] tracking-[0.04em] text-muted-foreground uppercase">
                      <span>Prenda</span>
                      <span>Tela</span>
                      <span>Modelo</span>
                      <span>Cant.</span>
                      <span>Costo ({currencyLabel})</span>
                      <span className="text-right">Total ({currencyLabel})</span>
                      <span className="sr-only">Acciones</span>
                    </div>
                    {items.map((item) => {
                      const modelsForItem = garmentModels.filter((m) => m.garment_type === item.garmentType);
                      const expanded = expandedSpecKey === item.key;
                      return (
                      <div key={item.key} className="space-y-1.5">
                      <div
                        className="grid grid-cols-[5rem_minmax(7rem,1fr)_minmax(7rem,1fr)_3.5rem_5rem_5rem_5rem] items-center gap-2 text-sm"
                      >
                        <span className="truncate">{GARMENT_TYPE_LABELS[item.garmentType]}</span>
                        <div className="min-w-0">
                          <FabricCombobox
                            fabrics={fabrics}
                            value={item.fabricId}
                            onValueChange={(fabricId) =>
                              setItems((prev) =>
                                prev.map((i) => (i.key === item.key ? { ...i, fabricId } : i))
                              )
                            }
                            aria-label={`Tela — ${GARMENT_TYPE_LABELS[item.garmentType]}`}
                          />
                        </div>
                        <div className="min-w-0">
                          <Select
                            value={item.modelId}
                            onValueChange={(value) => {
                              setItems((prev) =>
                                prev.map((i) => {
                                  if (i.key !== item.key) return i;
                                  const base = modelsForItem.find((m) => m.id === value)?.description ?? "";
                                  // El modelo solo SIEMBRA el detalle. Si el sastre
                                  // ya escribió algo no se pisa: ese texto es el
                                  // pedido concreto y el modelo apenas la plantilla.
                                  return { ...i, modelId: value, spec: i.spec.trim() ? i.spec : base };
                                })
                              );
                              setExpandedSpecKey(item.key);
                            }}
                            items={modelsForItem.map((model) => ({ value: model.id, label: model.name }))}
                          >
                            <SelectTrigger
                              className="w-full min-w-0"
                              aria-label={`Modelo — ${GARMENT_TYPE_LABELS[item.garmentType]}`}
                            >
                              <SelectValue placeholder="Selecciona un modelo" className="truncate" />
                            </SelectTrigger>
                            <SelectContent>
                              {modelsForItem.map((model) => (
                                <SelectItem key={model.id} value={model.id}>
                                  {model.name}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <Input
                          type="number"
                          min={1}
                          value={item.quantity}
                          onChange={(e) =>
                            setItems((prev) =>
                              prev.map((i) => (i.key === item.key ? { ...i, quantity: Number(e.target.value) } : i))
                            )
                          }
                          aria-label={`Cantidad — ${GARMENT_TYPE_LABELS[item.garmentType]}`}
                        />
                        <Input
                          type="number"
                          min={0}
                          step={priceStep}
                          value={item.unitPrice}
                          onChange={(e) =>
                            setItems((prev) =>
                              prev.map((i) =>
                                i.key === item.key ? { ...i, unitPrice: Number(e.target.value) } : i
                              )
                            )
                          }
                          aria-label={`Costo por pieza (${currencyLabel}) — ${GARMENT_TYPE_LABELS[item.garmentType]}`}
                        />
                        <span className="text-right tabular-nums text-muted-foreground">
                          {formatCurrency(item.quantity * item.unitPrice, currency)}
                        </span>
                        <div className="flex items-center justify-end gap-0.5">
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon-sm"
                            title={expanded ? "Ocultar detalle" : "Detalle de confección"}
                            aria-expanded={expanded}
                            aria-label={`Detalle de confección — ${GARMENT_TYPE_LABELS[item.garmentType]}`}
                            onClick={() => setExpandedSpecKey(expanded ? null : item.key)}
                          >
                            <ListChecksIcon className={item.spec.trim() ? "text-[var(--jh-gold)]" : undefined} />
                          </Button>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon-sm"
                            title="Duplicar con otra tela"
                            aria-label={`Duplicar ${GARMENT_TYPE_LABELS[item.garmentType]} con otra tela`}
                            onClick={() => setItems((prev) => [...prev, duplicateOrderItem(item)])}
                          >
                            <CopyPlusIcon />
                          </Button>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon-sm"
                            title="Quitar pieza"
                            aria-label={`Quitar ${GARMENT_TYPE_LABELS[item.garmentType]}`}
                            onClick={() => setItems((prev) => prev.filter((i) => i.key !== item.key))}
                          >
                            <XIcon />
                          </Button>
                        </div>
                      </div>

                      {/* Una línea del detalle cuando está plegado: si el detalle
                          solo se viera al abrirlo, revisar el pedido completo
                          obligaría a abrir pieza por pieza. */}
                      {!expanded && item.spec.trim() && (
                        <button
                          type="button"
                          onClick={() => setExpandedSpecKey(item.key)}
                          className="block w-full truncate px-0.5 text-left text-xs text-muted-foreground hover:text-foreground"
                        >
                          {item.spec}
                        </button>
                      )}
                      </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/*
               * El detalle va fuera de la tabla, no dentro de la fila: la tabla
               * vive en un contenedor con scroll horizontal de 52rem de ancho
               * mínimo, y ahí dentro el panel se cortaba y arrastraba la barra
               * de scroll. Acá ocupa el ancho real de la tarjeta.
               */}
              {expandedItem && (
                <GarmentSpecEditor
                  key={expandedItem.key}
                  garmentType={expandedItem.garmentType}
                  clientId={currentClientId}
                  spec={expandedItem.spec}
                  measurements={expandedItem.measurements}
                  models={garmentModels.filter((m) => m.garment_type === expandedItem.garmentType)}
                  modelId={expandedItem.modelId}
                  onModelSelect={(modelId, description) =>
                    setItems((prev) =>
                      prev.map((i) => {
                        if (i.key !== expandedItem.key) return i;
                        // Igual que en el selector de la fila: el modelo siembra
                        // el detalle, pero nunca pisa lo que ya se escribió.
                        return { ...i, modelId, spec: i.spec.trim() ? i.spec : description };
                      })
                    )
                  }
                  onSpecChange={(spec) =>
                    setItems((prev) =>
                      prev.map((i) => (i.key === expandedItem.key ? { ...i, spec } : i))
                    )
                  }
                />
              )}

              {/* Agregar prenda sin salir de Precios: cada botón crea una
                  pieza nueva de ese tipo (con la misma lógica de precarga que
                  los botones de arriba en la sección de medidas) y aparece
                  acá y como pestaña nueva arriba. */}
              <div className="flex flex-wrap gap-2 pt-1">
                {MEASURABLE_GARMENTS.map((garment) => (
                  <Button
                    key={garment}
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={addingGarment !== null}
                    onClick={() => addGarmentFromPricing(garment)}
                  >
                    <PlusIcon />
                    {addingGarment === garment ? "Agregando…" : GARMENT_TYPE_LABELS[garment]}
                  </Button>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="space-y-4 pt-6">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="locationId">Sede</Label>
                  <Select
                    value={locationId || null}
                    onValueChange={(v) => setLocationId(v ?? "")}
                    items={locations.map((loc) => ({ value: loc.id, label: `${loc.name} (${loc.currency})` }))}
                  >
                    <SelectTrigger id="locationId" className="w-full">
                      <SelectValue placeholder="Selecciona una sede" />
                    </SelectTrigger>
                    <SelectContent>
                      {locations.map((loc) => (
                        <SelectItem key={loc.id} value={loc.id}>
                          {loc.name} ({loc.currency})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="expectedDeliveryDate">Fecha estimada de entrega</Label>
                  <Input
                    id="expectedDeliveryDate"
                    type="date"
                    value={expectedDeliveryDate}
                    onChange={(e) => setExpectedDeliveryDate(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="advancePayment">Abono ({currencyLabel}, opcional)</Label>
                  <Input
                    id="advancePayment"
                    type="number"
                    min={0}
                    step={priceStep}
                    value={advancePayment}
                    onChange={(e) => setAdvancePayment(Number(e.target.value))}
                  />
                  {/* El medio solo aparece cuando hay abono: sin plata que
                      cobrar, preguntar por dónde entró es ruido. */}
                  {advancePayment > 0 && (
                    <div className="flex flex-wrap gap-1.5 pt-1">
                      {payChannels.map((option) => (
                        <button
                          key={option.id}
                          type="button"
                          onClick={() => setAdvanceChannelId(option.id)}
                          aria-pressed={advanceChannelId === option.id}
                          className={cn(
                            "rounded-full border px-3 py-1 text-xs font-medium transition-colors",
                            advanceChannelId === option.id
                              ? "border-accent bg-accent text-accent-foreground"
                              : "border-border text-muted-foreground hover:border-accent/40 hover:text-foreground",
                          )}
                        >
                          {option.name}
                          {option.feePercent > 0 || option.feeFixed > 0 ? (
                            <span className="opacity-70"> · {channelFeeLabel(option)}</span>
                          ) : null}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="discount">Descuento ({currencyLabel}, opcional)</Label>
                  <Input
                    id="discount"
                    type="number"
                    min={0}
                    step={priceStep}
                    value={discount}
                    onChange={(e) => setDiscount(Number(e.target.value))}
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="space-y-1.5 pt-6">
              <div className="flex justify-between text-sm text-muted-foreground">
                <span>Subtotal ({items.length} prenda{items.length === 1 ? "" : "s"})</span>
                <span className="tabular-nums">{formatCurrency(subtotal, currency)}</span>
              </div>
              {discount > 0 && (
                <div className="flex justify-between text-sm text-muted-foreground">
                  <span>Descuento</span>
                  <span className="tabular-nums">-{formatCurrency(discount, currency)}</span>
                </div>
              )}
              {advancePayment > 0 && (
                <div className="flex justify-between text-sm text-muted-foreground">
                  <span>Abono</span>
                  <span className="tabular-nums">{formatCurrency(advancePayment, currency)}</span>
                </div>
              )}
              {advanceFee > 0 && (
                <div className="flex justify-between text-sm text-muted-foreground">
                  <span>Comisión del medio de cobro</span>
                  <span className="tabular-nums">
                    -{formatCurrency(advanceFee, currency)} · neto{" "}
                    {formatCurrency(advancePayment - advanceFee, currency)}
                  </span>
                </div>
              )}
              <div className="flex justify-between border-t border-border pt-1.5 text-base font-semibold">
                <span>Total</span>
                <span className="tabular-nums">{formatCurrency(total, currency)}</span>
              </div>
            </CardContent>
          </Card>

          <Button
            type="button"
            className="w-full"
            size="lg"
            disabled={submitting || items.length === 0}
            onClick={handleCreateOrder}
          >
            {submitting ? "Creando orden…" : "Crear orden"}
          </Button>
        </div>
      )}
    </div>
  );
}

function WizardHeader({ step }: { step: Step }) {
  const percent = step === 1 ? 50 : 100;
  return (
    <div className="space-y-2">
      <div>
        <h1 className="font-heading text-2xl">Nueva orden</h1>
        <p className="text-sm text-muted-foreground">
          Paso {step} de 2 · {STEP_LABELS[step]}
        </p>
      </div>
      <div className="flex items-center gap-2">
        <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
          <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${percent}%` }} />
        </div>
        <div className="flex items-center gap-1 text-xs text-muted-foreground">
          {step > 1 && <CheckIcon className="size-3.5 text-primary" />}
          {percent}%
        </div>
      </div>
    </div>
  );
}
