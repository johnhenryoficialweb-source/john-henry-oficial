"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  CalendarDaysIcon,
  LayoutDashboardIcon,
  LogOutIcon,
  MailIcon,
  ScissorsIcon,
  ShirtIcon,
  SwatchBookIcon,
  UsersIcon,
  WalletIcon,
  SettingsIcon,
} from "lucide-react";
import { JhMark } from "@/components/brand/jh-mark";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";
import type { StaffSession } from "@/lib/auth/roles";

const NAV_ITEMS = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboardIcon },
  { href: "/appointments", label: "Citas", icon: CalendarDaysIcon },
  { href: "/clients", label: "Clientes", icon: UsersIcon },
  { href: "/fabrics", label: "Telas", icon: SwatchBookIcon },
  { href: "/garment-models", label: "Modelos", icon: ShirtIcon },
  { href: "/orders", label: "Órdenes", icon: ScissorsIcon },
  { href: "/finance", label: "Finanzas", icon: WalletIcon },
  { href: "/correos", label: "Correos", icon: MailIcon },
  { href: "/settings", label: "Ajustes", icon: SettingsIcon },
];

export function CmsSidebar({ session }: { session: StaffSession }) {
  const pathname = usePathname();
  const router = useRouter();

  async function handleLogout() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  return (
    <Sidebar collapsible="icon" className="print:hidden">
      <SidebarHeader className="px-3 py-4">
        <Link href="/dashboard" className="flex items-center gap-2.5">
          {/* El isotipo — no las letras "JH" sueltas, que no son el nombre de
              la marca ni su símbolo. Al colapsar el sidebar queda solo él,
              que es exactamente para lo que existe el isotipo. */}
          <JhMark className="size-5 shrink-0 text-[var(--jh-gold)]" title="JOHN HENRY" />
          <span className="font-display text-sm tracking-[0.2em] text-sidebar-foreground/80 uppercase group-data-[collapsible=icon]:hidden">
            John Henry
          </span>
        </Link>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              {NAV_ITEMS.map((item) => {
                const isActive = pathname === item.href || pathname.startsWith(`${item.href}/`);
                return (
                  <SidebarMenuItem key={item.href}>
                    <SidebarMenuButton
                      render={<Link href={item.href} />}
                      isActive={isActive}
                      tooltip={item.label}
                      className="relative"
                    >
                      {/*
                        El CMS no lleva coreografía — es una herramienta, y
                        hacer esperar a quien viene a leer cifras es un costo,
                        no un detalle. La única motion acá es funcional: la
                        marca de sede activa crece desde el centro al cambiar
                        de sección, con el mismo idioma de línea del sitio
                        público, para que el salto de una pantalla a otra no
                        obligue a releer el menú.
                      */}
                      <span
                        aria-hidden
                        className={cn(
                          "absolute top-1/2 left-0 h-4 w-px -translate-y-1/2 bg-[var(--jh-gold)]",
                          "transition-transform duration-300 ease-jh motion-reduce:transition-none",
                          isActive ? "scale-y-100" : "scale-y-0",
                        )}
                      />
                      <item.icon />
                      <span>{item.label}</span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter className="gap-2 px-3 pb-4">
        <div
          className={cn(
            "rounded-md border border-sidebar-border bg-sidebar-accent/40 px-3 py-2 text-xs",
            "group-data-[collapsible=icon]:hidden",
          )}
        >
          <p className="truncate font-medium">{session.fullName}</p>
          <p className="text-sidebar-foreground/60">
            {session.role === "admin" ? "Administrador" : "Staff"}
          </p>
        </div>
        <Button variant="ghost" size="sm" className="justify-start gap-2" onClick={handleLogout}>
          <LogOutIcon className="size-4" />
          <span className="group-data-[collapsible=icon]:hidden">Cerrar sesión</span>
        </Button>
      </SidebarFooter>
    </Sidebar>
  );
}
