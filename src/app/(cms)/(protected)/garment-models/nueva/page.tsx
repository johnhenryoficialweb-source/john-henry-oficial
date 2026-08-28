import Link from "next/link";
import { createGarmentModel } from "../actions";
import { GARMENT_TYPE_LABELS } from "@/lib/constants";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ArrowLeftIcon } from "lucide-react";
import type { GarmentType } from "@/types/database.types";

const MODEL_GARMENT_TYPES: GarmentType[] = ["saco", "pantalon", "camisa", "chaleco"];

export default function NuevoModeloPage() {
  return (
    <div className="max-w-lg space-y-6">
      <Link
        href="/garment-models"
        className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeftIcon className="size-4" />
        Volver a modelos
      </Link>

      <div>
        <h1 className="font-heading text-2xl">Nuevo modelo</h1>
        <p className="text-sm text-muted-foreground">
          Agrega un modelo/estilo al catálogo compartido entre sedes.
        </p>
      </div>

      <Card>
        <CardContent className="pt-6">
          <form action={createGarmentModel} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="garmentType">Tipo de prenda</Label>
              <Select
                name="garmentType"
                defaultValue="saco"
                items={MODEL_GARMENT_TYPES.map((type) => ({
                  value: type,
                  label: GARMENT_TYPE_LABELS[type],
                }))}
              >
                <SelectTrigger id="garmentType" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {MODEL_GARMENT_TYPES.map((type) => (
                    <SelectItem key={type} value={type}>
                      {GARMENT_TYPE_LABELS[type]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="name">Nombre</Label>
              <Input id="name" name="name" required placeholder="Cruzado, Recto, Slim…" />
            </div>

            <div className="space-y-2">
              <Label htmlFor="code">Código / referencia (opcional)</Label>
              <Input id="code" name="code" />
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Descripción (opcional)</Label>
              <Textarea id="description" name="description" rows={3} placeholder="Solapas, botonadura, corte, etc." />
            </div>

            <Button type="submit" className="w-full">
              Guardar modelo
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
