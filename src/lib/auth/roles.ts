import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { UserRole } from "@/types/database.types";

export interface StaffSession {
  userId: string;
  email: string;
  role: UserRole;
  locationId: string | null;
  fullName: string;
}

/**
 * Data Access Layer: única fuente de verdad para saber quién es el usuario
 * autenticado del CMS y a qué sede pertenece. `proxy.ts` solo hace un check
 * optimista (redirige si no hay sesión); esta función hace el check real
 * contra Supabase y debe invocarse en Server Components, Server Actions y
 * Route Handlers antes de leer o mutar datos.
 */
export const getStaffSession = cache(async (): Promise<StaffSession | null> => {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  const { data: staffUser } = await supabase
    .from("staff_users")
    .select("location_id, role, full_name, email, is_active")
    .eq("id", user.id)
    .single();

  if (!staffUser || !staffUser.is_active) return null;

  return {
    userId: user.id,
    email: staffUser.email,
    role: staffUser.role,
    locationId: staffUser.location_id,
    fullName: staffUser.full_name,
  };
});

export async function requireStaffSession(): Promise<StaffSession> {
  const session = await getStaffSession();
  if (!session) {
    // error=staff evita ambigüedad: Auth puede existir sin fila en staff_users.
    redirect("/login?error=staff");
  }
  return session;
}

export async function requireAdminSession(): Promise<StaffSession> {
  const session = await requireStaffSession();
  if (session.role !== "admin") redirect("/dashboard");
  return session;
}
