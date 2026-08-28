import { SiteHeader } from "@/components/public/site-header";
import { SiteFooter } from "@/components/public/site-footer";

// El footer y varias páginas leen sedes/telas desde Supabase (contenido
// editable desde el CMS); se renderiza por request en vez de generarse
// estático en build para no servir datos obsoletos ni requerir credenciales
// de Supabase en tiempo de build.
export const dynamic = "force-dynamic";

export default function PublicLayout({ children }: { children: React.ReactNode }) {
  return (
    // `font-display` explícito: el `<html>` cae en `font-sans` (Inter) para el
    // CMS, y sin esto cualquier texto del sitio público sin clase propia se
    // renderiza en una sans moderna — prohibida en superficie de marca.
    <div className="dark flex min-h-screen flex-col bg-background font-display text-foreground">
      <SiteHeader />
      <main className="flex-1">{children}</main>
      <SiteFooter />
    </div>
  );
}
