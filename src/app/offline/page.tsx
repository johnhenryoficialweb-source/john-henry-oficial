import type { Metadata } from "next";
import { JhMark } from "@/components/brand/jh-mark";
import { RetryButton } from "@/components/pwa/retry-button";

/**
 * Pantalla que el service worker sirve cuando una navegación no alcanza la red.
 *
 * Es estática a propósito (sin datos, sin sesión): tiene que existir en disco
 * antes de que se caiga la conexión. Y no dice solo "sin conexión" — dice qué
 * sigue funcionando y ofrece la acción de salida.
 */
export const metadata: Metadata = {
  title: "Sin conexión | JOHN HENRY",
  robots: { index: false, follow: false },
};

export default function OfflinePage() {
  return (
    <main className="flex min-h-screen flex-1 items-center justify-center bg-[var(--jh-navy)] px-6 py-24">
      <div className="w-full max-w-md space-y-10 text-center">
        <JhMark
          className="mx-auto size-10 text-[var(--jh-gold)]"
          title="JOHN HENRY"
        />

        <div className="space-y-4">
          <p className="font-institutional text-[10px] tracking-[0.42em] text-[var(--jh-gold-mid)]/70 uppercase">
            Sin conexión
          </p>
          <h1 className="font-display text-3xl leading-tight font-light text-[var(--jh-ivory)]">
            El dispositivo perdió la red.
          </h1>
          <p className="font-display text-base leading-relaxed text-[var(--jh-ivory)]/60">
            Nada de lo que estaba haciendo se perdió por esto. En cuanto vuelva
            la señal, la pantalla se recarga y todo sigue donde estaba.
          </p>
        </div>

        <RetryButton />

        <p className="font-display text-sm text-[var(--jh-ivory)]/40">
          Si está en sede, revise el Wi-Fi. Con datos móviles el sistema
          funciona igual.
        </p>
      </div>
    </main>
  );
}
