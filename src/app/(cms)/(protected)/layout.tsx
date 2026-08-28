import { requireStaffSession } from "@/lib/auth/roles";
import { createClient } from "@/lib/supabase/server";
import { CmsSidebar } from "@/components/cms/sidebar";
import { InstallButton } from "@/components/pwa/install-button";
import { SidebarInset, SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";

export default async function ProtectedCmsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await requireStaffSession();

  let locationName: string | null = null;
  if (session.locationId) {
    const supabase = await createClient();
    const { data } = await supabase
      .from("locations")
      .select("name")
      .eq("id", session.locationId)
      .single();
    locationName = data?.name ?? null;
  }

  return (
    <SidebarProvider>
      <CmsSidebar session={session} />
      <SidebarInset>
        <header className="flex h-14 shrink-0 items-center gap-2 border-b px-4 print:hidden">
          <SidebarTrigger />
          <Separator orientation="vertical" className="h-4" />
          <Badge variant="outline" className="font-normal">
            {locationName ?? "Todas las sedes"}
          </Badge>
          {/* Acción secundaria, alineada al margen opuesto: solo se materializa
              si el dispositivo puede instalar y aún no lo hizo. */}
          <InstallButton className="ml-auto text-muted-foreground" />
        </header>
        <main className="flex-1 p-6 print:p-0">{children}</main>
      </SidebarInset>
    </SidebarProvider>
  );
}
