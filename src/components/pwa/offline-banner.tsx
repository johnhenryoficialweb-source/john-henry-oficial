"use client";

import { WifiOffIcon } from "lucide-react";
import { usePwa } from "@/components/pwa/pwa-provider";

/**
 * Aviso persistente de pérdida de red.
 *
 * Es la diferencia entre "el sistema está lento" y "no hay señal": sin esto, el
 * usuario intenta guardar una orden, no pasa nada, y culpa al sistema
 * (Retroalimentación inmediata). Se ancla abajo para no tapar el encabezado ni
 * la acción principal, y respeta el área segura del gesto de inicio en iOS.
 */
export function OfflineBanner() {
  const { isOnline } = usePwa();

  if (isOnline) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed inset-x-0 bottom-0 z-50 flex items-center justify-center gap-2 border-t border-[var(--jh-gold-mid)]/25 bg-[var(--jh-black)] px-4 py-2.5 pb-[max(0.625rem,env(safe-area-inset-bottom))] text-[var(--jh-ivory)] print:hidden"
    >
      <WifiOffIcon aria-hidden className="size-3.5 shrink-0 text-[var(--jh-gold-mid)]" />
      <p className="text-xs">
        Sin conexión.{" "}
        <span className="text-[var(--jh-ivory)]/60">
          Puede seguir leyendo lo que ya está en pantalla; no se guardarán
          cambios hasta que vuelva la red.
        </span>
      </p>
    </div>
  );
}
