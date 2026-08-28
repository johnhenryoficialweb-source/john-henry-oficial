"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2Icon, SaveIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { formatCurrency } from "@/lib/currency/exchange";
import { GARMENT_TYPE_LABELS } from "@/lib/constants";
import { saveBaseCost } from "@/app/(cms)/(protected)/finance/actions";
import type { CurrencyCode, GarmentType } from "@/types/database.types";

const COST_GARMENT_TYPES: GarmentType[] = ["saco", "pantalon", "camisa", "chaleco", "otro"];
const ALL = "__all__";

/**
 * Carga del costo base de una pieza.
 *
 * El desglose (tela / mano de obra / indirectos) no es burocracia: es lo que
 * permite después saber si el margen se está yendo en material o en taller. El
 * total se arma en vivo mientras se escribe (regla UX #6).
 */
export function BaseCostForm({
  models,
  locations,
  existing,
}: {
  models: { id: string; name: string; garmentType: GarmentType }[];
  locations: { id: string; name: string; currency: CurrencyCode }[];
  existing: {
    garmentType: GarmentType;
    garmentModelId: string | null;
    locationId: string | null;
    currency: CurrencyCode;
    fabricCost: number;
    laborCost: number;
    overheadCost: number;
  }[];
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const [garmentType, setGarmentType] = useState<GarmentType>("saco");
  const [modelId, setModelId] = useState(ALL);
  const [locationId, setLocationId] = useState(locations[0]?.id ?? ALL);
  const [globalCurrency, setGlobalCurrency] = useState<CurrencyCode>("USD");
  const [fabricCost, setFabricCost] = useState("");
  const [laborCost, setLaborCost] = useState("");
  const [overheadCost, setOverheadCost] = useState("");

  const availableModels = useMemo(
    () => models.filter((model) => model.garmentType === garmentType),
    [models, garmentType],
  );

  const currency: CurrencyCode =
    locationId === ALL
      ? globalCurrency
      : (locations.find((l) => l.id === locationId)?.currency ?? globalCurrency);

  const asNumber = (value: string) => Number(value.replace(/[^\d.,-]/g, "").replace(",", ".")) || 0;
  const total = asNumber(fabricCost) + asNumber(laborCost) + asNumber(overheadCost);

  // Si ya hay un costo para este alcance exacto, se está editando, no creando.
  const current = existing.find(
    (row) =>
      row.garmentType === garmentType &&
      row.garmentModelId === (modelId === ALL ? null : modelId) &&
      row.locationId === (locationId === ALL ? null : locationId) &&
      row.currency === currency,
  );

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    formData.set("garmentType", garmentType);
    formData.set("garmentModelId", modelId === ALL ? "" : modelId);
    formData.set("locationId", locationId === ALL ? "" : locationId);
    formData.set("currency", currency);

    startTransition(async () => {
      try {
        await saveBaseCost(formData);
        toast.success(
          `${current ? "Costo actualizado" : "Costo cargado"} · ${GARMENT_TYPE_LABELS[garmentType]} ${formatCurrency(total, currency)}`,
        );
        setFabricCost("");
        setLaborCost("");
        setOverheadCost("");
        router.refresh();
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "No se pudo guardar el costo base.");
      }
    });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <div className="grid gap-4 sm:grid-cols-3">
        <div className="space-y-2">
          <Label htmlFor="cost-garment-type">Prenda</Label>
          <Select
            value={garmentType}
            onValueChange={(value) => {
              setGarmentType(String(value) as GarmentType);
              setModelId(ALL);
            }}
            items={COST_GARMENT_TYPES.map((type) => ({ value: type, label: GARMENT_TYPE_LABELS[type] }))}
          >
            <SelectTrigger id="cost-garment-type" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {COST_GARMENT_TYPES.map((type) => (
                <SelectItem key={type} value={type}>
                  {GARMENT_TYPE_LABELS[type]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="cost-model">Modelo</Label>
          <Select
            value={modelId}
            onValueChange={(value) => setModelId(String(value))}
            items={[
              { value: ALL, label: "Todos los modelos" },
              ...availableModels.map((model) => ({ value: model.id, label: model.name })),
            ]}
          >
            <SelectTrigger id="cost-model" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>Todos los modelos</SelectItem>
              {availableModels.map((model) => (
                <SelectItem key={model.id} value={model.id}>
                  {model.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="cost-location">Sede</Label>
          <Select
            value={locationId}
            onValueChange={(value) => setLocationId(String(value))}
            items={[
              ...locations.map((location) => ({
                value: location.id,
                label: `${location.name} (${location.currency})`,
              })),
              { value: ALL, label: "Todas las sedes" },
            ]}
          >
            <SelectTrigger id="cost-location" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {locations.map((location) => (
                <SelectItem key={location.id} value={location.id}>
                  {location.name} ({location.currency})
                </SelectItem>
              ))}
              <SelectItem value={ALL}>Todas las sedes</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {locationId === ALL && (
        <div className="space-y-2">
          <Label htmlFor="cost-currency">Moneda del costo global</Label>
          <Select
            value={globalCurrency}
            onValueChange={(value) => setGlobalCurrency(String(value) as CurrencyCode)}
            items={[
              { value: "USD", label: "USD" },
              { value: "COP", label: "COP" },
            ]}
          >
            <SelectTrigger id="cost-currency" className="w-[160px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="USD">USD</SelectItem>
              <SelectItem value="COP">COP</SelectItem>
            </SelectContent>
          </Select>
          <p className="text-xs text-muted-foreground">
            Un costo global solo aplica a órdenes en esa misma moneda.
          </p>
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-4">
        <div className="space-y-2">
          <Label htmlFor="fabricCost">Tela e insumos</Label>
          <Input
            id="fabricCost"
            name="fabricCost"
            inputMode="decimal"
            placeholder="0"
            value={fabricCost}
            onChange={(event) => setFabricCost(event.target.value)}
            className="tabular-nums"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="laborCost">Mano de obra</Label>
          <Input
            id="laborCost"
            name="laborCost"
            inputMode="decimal"
            placeholder="0"
            value={laborCost}
            onChange={(event) => setLaborCost(event.target.value)}
            className="tabular-nums"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="overheadCost">Indirectos</Label>
          <Input
            id="overheadCost"
            name="overheadCost"
            inputMode="decimal"
            placeholder="0"
            value={overheadCost}
            onChange={(event) => setOverheadCost(event.target.value)}
            className="tabular-nums"
          />
        </div>
        <div className="space-y-2">
          <Label>Costo por pieza</Label>
          <div className="flex h-9 items-center rounded-xs border border-dashed px-3 font-medium tabular-nums">
            {formatCurrency(total, currency)}
          </div>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <Button type="submit" disabled={isPending || total <= 0}>
          {isPending ? <Loader2Icon className="animate-spin" /> : <SaveIcon />}
          {current ? "Actualizar costo" : "Guardar costo"}
        </Button>
        {current && (
          <p className="text-xs text-muted-foreground">
            Ya existe un costo para este alcance ({formatCurrency(
              current.fabricCost + current.laborCost + current.overheadCost,
              current.currency,
            )}
            ). Guardar lo reemplaza — las órdenes ya creadas conservan el costo con el que se
            registraron.
          </p>
        )}
      </div>
    </form>
  );
}
