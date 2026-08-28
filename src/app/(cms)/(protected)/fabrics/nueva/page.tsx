import Link from "next/link";
import { createFabric } from "../actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { ImageUploadField } from "@/components/shared/image-upload-field";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ArrowLeftIcon } from "lucide-react";

export default function NuevaTelaPage() {
  return (
    <div className="max-w-lg space-y-6">
      <Link href="/fabrics" className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeftIcon className="size-4" />
        Volver a telas
      </Link>

      <div>
        <h1 className="font-heading text-2xl">Nueva tela</h1>
        <p className="text-sm text-muted-foreground">Agrega una tela al catálogo compartido entre sedes.</p>
      </div>

      <Card>
        <CardContent className="pt-6">
          <form action={createFabric} className="space-y-4">
            <ImageUploadField name="imageUrl" prefix="fabrics" label="Foto de la tela" />

            <div className="space-y-2">
              <Label htmlFor="name">Nombre</Label>
              <Input id="name" name="name" required placeholder="Lana italiana Vitale Barberis" />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="code">Código / referencia</Label>
                <Input id="code" name="code" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="color">Color</Label>
                <Input id="color" name="color" />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="composition">Composición</Label>
              <Input id="composition" name="composition" placeholder="100% lana merino" />
            </div>

            <div className="space-y-2">
              <Label htmlFor="supplier">Proveedor</Label>
              <Input id="supplier" name="supplier" />
            </div>

            <div className="space-y-2">
              <Label htmlFor="fabricType">Tipo / muestrario</Label>
              <Input id="fabricType" name="fabricType" placeholder="ALBINI, VBC S'110…" />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="priceCop">Precio COP / metro</Label>
                <Input id="priceCop" name="priceCop" type="number" step="1" min="0" placeholder="14780" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="priceUsd">Precio USD / metro</Label>
                <Input id="priceUsd" name="priceUsd" type="number" step="0.0001" min="0" placeholder="4.48" />
              </div>
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div className="col-span-2 space-y-2">
                <Label htmlFor="pricePerMeter">Costo por metro (legacy)</Label>
                <Input id="pricePerMeter" name="pricePerMeter" type="number" step="0.01" min="0" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="priceCurrency">Moneda</Label>
                <Select
                  name="priceCurrency"
                  defaultValue="USD"
                  items={[
                    { value: "USD", label: "USD" },
                    { value: "COP", label: "COP" },
                  ]}
                >
                  <SelectTrigger id="priceCurrency" className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="USD">USD</SelectItem>
                    <SelectItem value="COP">COP</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="stockMeters">Metros en stock</Label>
              <Input id="stockMeters" name="stockMeters" type="number" step="0.01" min="0" defaultValue="0" />
            </div>

            <Button type="submit" className="w-full">
              Guardar tela
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
