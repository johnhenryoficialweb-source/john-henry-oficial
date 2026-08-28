"use client";

import { useState } from "react";
import { DownloadIcon, PlusSquareIcon, ShareIcon } from "lucide-react";
import { usePwa } from "@/components/pwa/pwa-provider";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

/**
 * Invitación a instalar el sistema. Aparece solo cuando instalar es posible y
 * todavía no se hizo — nunca como banner permanente ni como interrupción: es
 * una acción secundaria en el header, subordinada a lo que el usuario vino a
 * hacer (Una acción principal por pantalla).
 *
 * En iOS no existe API de instalación, así que el mismo botón abre las
 * instrucciones del gesto real de Safari en vez de desaparecer sin explicación.
 */
export function InstallButton({ className }: { className?: string }) {
  const { canInstall, isIos, isStandalone, promptInstall } = usePwa();
  const [showIosHelp, setShowIosHelp] = useState(false);

  // Ya está instalado, o el navegador no ofrece instalación de ninguna forma.
  if (isStandalone) return null;
  if (!canInstall && !isIos) return null;

  return (
    <>
      <Button
        variant="ghost"
        size="sm"
        className={className}
        onClick={() => (isIos && !canInstall ? setShowIosHelp(true) : promptInstall())}
      >
        <DownloadIcon />
        Instalar app
      </Button>

      <Dialog open={showIosHelp} onOpenChange={setShowIosHelp}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Instalar en este iPhone o iPad</DialogTitle>
            <DialogDescription>
              Queda como una app más: icono propio, pantalla completa, sin la
              barra de Safari.
            </DialogDescription>
          </DialogHeader>

          <ol className="space-y-4 text-sm">
            <li className="flex items-start gap-3">
              <ShareIcon className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
              <span>
                Toque <strong className="font-medium">Compartir</strong> en la
                barra de Safari.
              </span>
            </li>
            <li className="flex items-start gap-3">
              <PlusSquareIcon className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
              <span>
                Elija{" "}
                <strong className="font-medium">
                  Añadir a pantalla de inicio
                </strong>
                .
              </span>
            </li>
          </ol>

          <p className="text-xs text-muted-foreground">
            Debe hacerse desde Safari. Chrome en iOS no puede instalar apps.
          </p>

          <DialogFooter>
            <DialogClose render={<Button variant="outline" />}>Entendido</DialogClose>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
