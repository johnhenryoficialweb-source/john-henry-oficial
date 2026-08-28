"use client";

import { useState } from "react";
import Image from "next/image";
import { toast } from "sonner";
import { ImageUpIcon, Loader2Icon, XIcon } from "lucide-react";
import { Button } from "@/components/ui/button";

/**
 * Sube un archivo directo a Cloudflare R2 vía URL prefirmada (POST
 * /api/uploads/presign) y expone la URL pública resultante en un input
 * oculto, para que el formulario padre la envíe junto al resto de campos.
 */
export function ImageUploadField({
  name,
  prefix,
  label,
  defaultUrl,
}: {
  name: string;
  prefix: "fabrics" | "clients" | "orders" | "gallery" | "site";
  label: string;
  defaultUrl?: string | null;
}) {
  const [url, setUrl] = useState<string | null>(defaultUrl ?? null);
  const [isUploading, setIsUploading] = useState(false);

  async function handleFileChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    try {
      const presignRes = await fetch("/api/uploads/presign", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prefix, fileName: file.name, contentType: file.type }),
      });

      if (!presignRes.ok) throw new Error("No se pudo preparar la subida.");
      const { uploadUrl, publicUrl } = await presignRes.json();

      const uploadRes = await fetch(uploadUrl, {
        method: "PUT",
        headers: { "Content-Type": file.type },
        body: file,
      });
      if (!uploadRes.ok) throw new Error("No se pudo subir la imagen.");

      setUrl(publicUrl);
      toast.success("Imagen subida");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Error al subir la imagen.");
    } finally {
      setIsUploading(false);
    }
  }

  return (
    <div className="space-y-2">
      <label className="text-sm font-medium">{label}</label>
      <input type="hidden" name={name} value={url ?? ""} />
      <div className="flex items-center gap-3">
        {url ? (
          <div className="relative size-20 overflow-hidden rounded-md border">
            <Image src={url} alt="" fill className="object-cover" unoptimized />
            <button
              type="button"
              onClick={() => setUrl(null)}
              className="absolute top-0.5 right-0.5 rounded-full bg-black/60 p-0.5 text-white"
            >
              <XIcon className="size-3" />
            </button>
          </div>
        ) : (
          <div className="flex size-20 items-center justify-center rounded-md border border-dashed text-muted-foreground">
            <ImageUpIcon className="size-5" />
          </div>
        )}
        <Button type="button" variant="outline" size="sm" disabled={isUploading} render={<label />}>
          {isUploading && <Loader2Icon className="animate-spin" />}
          {url ? "Cambiar" : "Subir imagen"}
          <input type="file" accept="image/*" className="hidden" onChange={handleFileChange} />
        </Button>
      </div>
    </div>
  );
}
