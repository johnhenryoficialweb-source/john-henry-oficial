"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import { toast } from "sonner";

/**
 * Evento propietario de Chromium. No está en lib.dom, y es la única forma de
 * controlar *cuándo* se ofrece instalar: sin `preventDefault()` el navegador
 * decide por su cuenta y el usuario recibe un banner fuera de contexto.
 */
interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

interface PwaState {
  /** Hay una invitación de instalación disponible (Chromium/Android/desktop). */
  canInstall: boolean;
  /** iOS no expone `beforeinstallprompt`: solo queda explicar el gesto a mano. */
  isIos: boolean;
  /** Ya se está ejecutando dentro de la ventana instalada. */
  isStandalone: boolean;
  /** Estado de red observado por el navegador. */
  isOnline: boolean;
  /** Dispara el diálogo nativo. Devuelve si el usuario aceptó. */
  promptInstall: () => Promise<boolean>;
}

const PwaContext = createContext<PwaState | null>(null);

const STANDALONE_QUERY = "(display-mode: standalone)";

/**
 * Estas tres lecturas son estado del navegador, no de React: se leen con
 * `useSyncExternalStore` para que el servidor renderice el valor neutro y el
 * cliente corrija en la propia hidratación, sin un render extra en cascada.
 */
function subscribeConnection(onChange: () => void) {
  window.addEventListener("online", onChange);
  window.addEventListener("offline", onChange);
  return () => {
    window.removeEventListener("online", onChange);
    window.removeEventListener("offline", onChange);
  };
}

function subscribeDisplayMode(onChange: () => void) {
  const query = window.matchMedia(STANDALONE_QUERY);
  query.addEventListener("change", onChange);
  return () => query.removeEventListener("change", onChange);
}

/** La plataforma no cambia en vivo: no hay nada a lo que suscribirse. */
function subscribeNever() {
  return () => {};
}

function readStandalone() {
  return (
    window.matchMedia(STANDALONE_QUERY).matches ||
    // Safari iOS no implementa display-mode; usa esta bandera heredada.
    (window.navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}

function readIsIos() {
  const ua = window.navigator.userAgent;
  return (
    /iPad|iPhone|iPod/.test(ua) ||
    // iPadOS se anuncia como Mac; el táctil lo delata.
    (/Macintosh/.test(ua) && window.navigator.maxTouchPoints > 1)
  );
}

// En el servidor se asume lo optimista y lo neutro: hay red, es un navegador
// normal y no está instalado. Ninguna de las tres suposiciones pinta algo que
// luego moleste si se corrige.
const serverTrue = () => true;
const serverFalse = () => false;

export function usePwa(): PwaState {
  const context = useContext(PwaContext);
  if (!context) {
    throw new Error("usePwa debe usarse dentro de <PwaProvider>.");
  }
  return context;
}

/**
 * Registra el service worker y centraliza el estado de la PWA.
 *
 * Vive en el layout raíz para que tanto el sitio público como el CMS compartan
 * un solo worker y un solo estado de conexión — el usuario no debería notar
 * dónde termina una superficie y empieza la otra (Consistencia absoluta).
 */
export function PwaProvider({ children }: { children: React.ReactNode }) {
  const [installEvent, setInstallEvent] = useState<BeforeInstallPromptEvent | null>(null);

  const isOnline = useSyncExternalStore(
    subscribeConnection,
    () => window.navigator.onLine,
    serverTrue,
  );
  const isStandalone = useSyncExternalStore(subscribeDisplayMode, readStandalone, serverFalse);
  const isIos = useSyncExternalStore(subscribeNever, readIsIos, serverFalse);

  // Una recarga por actualización, no un bucle si el worker cambia dos veces.
  const reloadingRef = useRef(false);

  // ---- Instalación ------------------------------------------------------
  useEffect(() => {
    function onBeforeInstallPrompt(event: Event) {
      event.preventDefault();
      setInstallEvent(event as BeforeInstallPromptEvent);
    }

    function onInstalled() {
      setInstallEvent(null);
      toast.success("JOHN HENRY quedó instalado", {
        description: "Ábralo desde el icono, como cualquier otra app.",
      });
    }

    window.addEventListener("beforeinstallprompt", onBeforeInstallPrompt);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onBeforeInstallPrompt);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  // ---- Service worker ---------------------------------------------------
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;
    // En desarrollo un worker activo enmascara cambios de código; se registra
    // solo en el build real.
    if (process.env.NODE_ENV !== "production") return;

    let cancelled = false;

    async function register() {
      try {
        const registration = await navigator.serviceWorker.register("/sw.js", { scope: "/" });
        if (cancelled) return;

        registration.addEventListener("updatefound", () => {
          const installing = registration.installing;
          if (!installing) return;

          installing.addEventListener("statechange", () => {
            // `controller` presente ⇒ ya había una versión sirviendo: esto es
            // una actualización, no la primera instalación.
            if (installing.state !== "installed" || !navigator.serviceWorker.controller) return;

            toast("Hay una versión nueva del sistema", {
              description: "Se aplica al recargar. Nada de lo abierto se pierde.",
              duration: Infinity,
              action: {
                label: "Actualizar",
                onClick: () => installing.postMessage({ type: "SKIP_WAITING" }),
              },
            });
          });
        });
      } catch {
        // Un worker que no registra degrada la app a web normal. No es un
        // fallo que el usuario deba ver ni pueda resolver.
      }
    }

    navigator.serviceWorker.addEventListener("controllerchange", () => {
      if (reloadingRef.current) return;
      reloadingRef.current = true;
      window.location.reload();
    });

    register();
    return () => {
      cancelled = true;
    };
  }, []);

  const promptInstall = useCallback(async () => {
    if (!installEvent) return false;
    await installEvent.prompt();
    const { outcome } = await installEvent.userChoice;
    // El evento es de un solo uso: consumido, ya no sirve.
    setInstallEvent(null);
    return outcome === "accepted";
  }, [installEvent]);

  const value = useMemo<PwaState>(
    () => ({
      canInstall: installEvent !== null,
      isIos,
      isStandalone,
      isOnline,
      promptInstall,
    }),
    [installEvent, isIos, isStandalone, isOnline, promptInstall],
  );

  return <PwaContext.Provider value={value}>{children}</PwaContext.Provider>;
}
