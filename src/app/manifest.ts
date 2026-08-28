import type { MetadataRoute } from "next";

/**
 * Manifiesto de la PWA.
 *
 * La app instalable es el CMS, no el sitio público: quien instala esto es el
 * equipo de sastrería tomando medidas en sede o en la casa del cliente, no un
 * visitante. Por eso `start_url` apunta a /dashboard — abrir el icono debe
 * dejar al usuario ya dentro de su trabajo, no en la portada de marca
 * (Smart Defaults: nunca hacerle navegar hasta donde el sistema ya sabe que va).
 *
 * `scope` se mantiene en "/" porque el CMS comparte origen con el sitio y usa
 * rutas de primer nivel (/orders, /clients, /login…). Si un enlace saca al
 * usuario del scope, el navegador lo abriría fuera de la ventana instalada.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/dashboard",
    name: "JOHN HENRY · Sastrería",
    short_name: "JOHN HENRY",
    description:
      "Sistema de sastrería JOHN HENRY: citas, clientes, medidas, órdenes y finanzas.",
    lang: "es",
    dir: "ltr",
    start_url: "/dashboard",
    scope: "/",
    display: "standalone",
    orientation: "portrait-primary",
    // El lienzo de arranque y la barra del sistema en el azul de marca: la
    // ventana instalada nunca debe destellar en blanco.
    background_color: "#0d1f3c",
    theme_color: "#0d1f3c",
    categories: ["business", "productivity"],
    icons: [
      {
        src: "/icons/icon-192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icons/icon-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icons/icon-maskable-192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "maskable",
      },
      {
        src: "/icons/icon-maskable-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
    // Accesos directos del menú contextual del icono. Son las tres acciones
    // que el equipo repite a diario; ahorran dos toques cada vez
    // (Velocidad para usuarios frecuentes).
    shortcuts: [
      {
        name: "Nueva orden",
        short_name: "Orden",
        description: "Registrar una orden nueva",
        url: "/orders/nueva",
        icons: [{ src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" }],
      },
      {
        name: "Nueva cita",
        short_name: "Cita",
        description: "Agendar una cita",
        url: "/appointments/nueva",
        icons: [{ src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" }],
      },
      {
        name: "Clientes",
        short_name: "Clientes",
        description: "Buscar un cliente",
        url: "/clients",
        icons: [{ src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" }],
      },
    ],
  };
}
