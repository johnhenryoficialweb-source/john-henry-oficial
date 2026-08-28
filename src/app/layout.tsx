import type { Metadata, Viewport } from "next";
import { Cormorant_Garamond, Cinzel, Inter } from "next/font/google";
import { Toaster } from "@/components/ui/sonner";
import { PwaProvider } from "@/components/pwa/pwa-provider";
import { OfflineBanner } from "@/components/pwa/offline-banner";
import "./globals.css";

// La voz de la marca. El nombre, los titulares, el posicionamiento.
// Peso 300 (Light) — nunca negrita, nunca condensada.
const cormorantGaramond = Cormorant_Garamond({
  variable: "--font-display",
  subsets: ["latin"],
  weight: ["300", "400"],
  style: ["normal", "italic"],
});

// El contexto institucional. Siempre mayúsculas, siempre subordinada.
const cinzel = Cinzel({
  variable: "--font-institutional",
  subsets: ["latin"],
  weight: ["400", "600"],
});

// Sans de apoyo, no de marca: CMS interno y microcopy legal únicamente.
const inter = Inter({
  variable: "--font-sans",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "JOHN HENRY | Sastrería Privada",
  description:
    "Sastrería privada, hecha a medida. La consulta llega a usted. Bogotá y Ciudad de Panamá.",
  applicationName: "JOHN HENRY",
  // El `<link rel="manifest">` lo inyecta Next automáticamente desde
  // src/app/manifest.ts; aquí solo va lo que esa ruta no cubre.
  appleWebApp: {
    capable: true,
    title: "JOHN HENRY",
    // Barra de estado opaca oscura: el marfil sobre navy no tolera la barra
    // clara por defecto de iOS.
    statusBarStyle: "black",
  },
  /*
   * El campo `icons` REEMPLAZA la convención de archivo de Next: mientras
   * aquí solo estaba el icono de iOS, el HTML no emitía ningún
   * `<link rel="icon">` y la pestaña del navegador caía en el globo genérico
   * pese a existir src/app/icon.svg. Por eso se declara todo junto.
   *
   * Tres formatos por cobertura, no por gusto: .ico para la pestaña y para
   * quien lo pide a ciegas en la raíz (buscadores, lectores RSS), .svg para
   * pantallas de alta densidad, y el PNG grande para Android y accesos
   * directos de escritorio. Todos salen del mismo isotipo
   * (npm run pwa:icons).
   */
  icons: {
    icon: [
      { url: "/favicon.ico", sizes: "48x48", type: "image/x-icon" },
      { url: "/icon.svg", type: "image/svg+xml" },
      { url: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
    ],
    shortcut: "/favicon.ico",
    apple: [{ url: "/icons/apple-touch-icon.png", sizes: "180x180", type: "image/png" }],
  },
  // Safari convierte números en enlaces telefónicos y rompe la retícula
  // tipográfica (precios, medidas, cédulas).
  formatDetection: { telephone: false },
  other: {
    // Next emite el nombre estandarizado (`mobile-web-app-capable`). El
    // prefijado sigue siendo el que leen los iOS anteriores a 15.4, que todavía
    // hay en sede.
    "apple-mobile-web-app-capable": "yes",
  },
};

export const viewport: Viewport = {
  // El azul de marca en la barra del sistema de la ventana instalada.
  themeColor: "#0d1f3c",
  colorScheme: "dark",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="es"
      suppressHydrationWarning
      className={`dark ${cormorantGaramond.variable} ${cinzel.variable} ${inter.variable} h-full antialiased`}
    >
      <body suppressHydrationWarning className="min-h-full flex flex-col font-sans">
        <PwaProvider>
          {children}
          <OfflineBanner />
          <Toaster />
        </PwaProvider>
      </body>
    </html>
  );
}
