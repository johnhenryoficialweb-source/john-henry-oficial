"use client";

import { useEffect, useState } from "react";
import { RefreshCwIcon } from "lucide-react";
import { Button } from "@/components/ui/button";

/**
 * Acción única de la pantalla /offline.
 *
 * Vigila el evento `online` y reintenta sola: si la red vuelve mientras el
 * usuario mira la pantalla, no tiene que hacer nada. El botón queda para el
 * caso contrario — reintentar a mano cuando el navegador aún cree que hay red.
 */
export function RetryButton() {
  const [retrying, setRetrying] = useState(false);

  useEffect(() => {
    function onOnline() {
      setRetrying(true);
      window.location.reload();
    }
    window.addEventListener("online", onOnline);
    return () => window.removeEventListener("online", onOnline);
  }, []);

  return (
    <Button
      size="lg"
      disabled={retrying}
      onClick={() => {
        setRetrying(true);
        window.location.reload();
      }}
      className="mx-auto"
    >
      <RefreshCwIcon className={retrying ? "animate-spin" : undefined} />
      {retrying ? "Reintentando…" : "Reintentar"}
    </Button>
  );
}
