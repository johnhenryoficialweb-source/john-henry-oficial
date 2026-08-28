import { Toaster } from "@/components/ui/sonner";

/**
 * Shell compartido del CMS (dark mode por defecto, orientado a
 * productividad). El guard de autenticación real vive en
 * (protected)/layout.tsx: /login debe quedar fuera de esa protección para
 * no generar un loop de redirección.
 */
export default function CmsLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="dark min-h-screen bg-background text-foreground">
      {children}
      <Toaster />
    </div>
  );
}
