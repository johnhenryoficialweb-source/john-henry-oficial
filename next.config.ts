import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /*
   * En desarrollo el servidor se anuncia como `localhost`, así que una petición
   * que llega por `127.0.0.1` cuenta como origen cruzado: Next bloquea el HMR y,
   * lo que de verdad estorba, rechaza las Server Actions — el login falla con un
   * "Failed to fetch" que no dice por qué. Son la misma máquina; declararlo lo
   * resuelve. Solo aplica a `next dev`: en producción esta opción se ignora.
   */
  allowedDevOrigins: ["127.0.0.1"],
  images: {
    // Fotografía de relleno mientras se construye el archivo propio de
    // producto y proceso — la prioridad visual pendiente de la marca.
    remotePatterns: [{ protocol: "https", hostname: "images.unsplash.com" }],
  },
  async headers() {
    return [
      {
        // El service worker no puede cachearse en el navegador: es el archivo
        // que decide cuándo se actualiza todo lo demás. Si queda pegado, un
        // dispositivo puede quedarse en una versión vieja para siempre.
        source: "/sw.js",
        headers: [
          { key: "Cache-Control", value: "public, max-age=0, must-revalidate" },
          { key: "Service-Worker-Allowed", value: "/" },
          { key: "Content-Type", value: "application/javascript; charset=utf-8" },
        ],
      },
      {
        source: "/manifest.webmanifest",
        headers: [{ key: "Cache-Control", value: "public, max-age=0, must-revalidate" }],
      },
    ];
  },
  async redirects() {
    // El mapa del sitio sigue la jerarquía de visibilidad de la marca:
    // ready-to-wear es la cara pública; el oficio sustituye a "nosotros"
    // (la marca habla de oficio, no de corporativo).
    return [
      { source: "/nosotros", destination: "/el-oficio", permanent: true },
      { source: "/coleccion", destination: "/ready-to-wear", permanent: true },
      { source: "/contacto", destination: "/citas", permanent: true },
    ];
  },
};

export default nextConfig;
