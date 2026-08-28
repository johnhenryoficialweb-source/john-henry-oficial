import Link from "next/link";
import { requireAdminSession } from "@/lib/auth/roles";
import { createClient } from "@/lib/supabase/server";
import { inviteStaffUser, toggleStaffActive } from "../actions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ToggleStaffActiveButton } from "@/components/cms/toggle-staff-active-button";
import { ArrowLeftIcon } from "lucide-react";

export default async function StaffUsersPage() {
  await requireAdminSession();
  const supabase = await createClient();

  const [{ data: staff }, { data: locations }] = await Promise.all([
    supabase.from("staff_users").select("*, locations(name)").order("created_at", { ascending: false }),
    supabase.from("locations").select("id, code, name").eq("is_active", true),
  ]);

  return (
    <div className="max-w-2xl space-y-6">
      <Link href="/settings" className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeftIcon className="size-4" />
        Volver a ajustes
      </Link>

      <div>
        <h1 className="font-heading text-2xl">Usuarios del staff</h1>
        <p className="text-sm text-muted-foreground">Invita nuevos usuarios y administra el acceso al CMS.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Invitar usuario</CardTitle>
        </CardHeader>
        <CardContent>
          <form action={inviteStaffUser} className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="fullName">Nombre completo</Label>
              <Input id="fullName" name="fullName" required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">Correo</Label>
              <Input id="email" name="email" type="email" required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="role">Rol</Label>
              <Select
                name="role"
                defaultValue="staff"
                items={[
                  { value: "staff", label: "Staff" },
                  { value: "admin", label: "Administrador" },
                ]}
              >
                <SelectTrigger id="role" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="staff">Staff</SelectItem>
                  <SelectItem value="admin">Administrador</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="locationCode">Sede</Label>
              <Select
                name="locationCode"
                items={(locations ?? []).map((loc) => ({ value: loc.code, label: loc.name }))}
              >
                <SelectTrigger id="locationCode" className="w-full">
                  <SelectValue placeholder="Solo para staff" />
                </SelectTrigger>
                <SelectContent>
                  {locations?.map((loc) => (
                    <SelectItem key={loc.id} value={loc.code}>
                      {loc.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button type="submit" className="sm:col-span-2">
              Enviar invitación
            </Button>
          </form>
        </CardContent>
      </Card>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Nombre</TableHead>
            <TableHead>Rol</TableHead>
            <TableHead>Sede</TableHead>
            <TableHead>Estado</TableHead>
            <TableHead />
          </TableRow>
        </TableHeader>
        <TableBody>
          {(staff ?? []).map((s) => {
            const location = s.locations as unknown as { name: string } | null;
            return (
              <TableRow key={s.id}>
                <TableCell>
                  <p className="font-medium">{s.full_name}</p>
                  <p className="text-xs text-muted-foreground">{s.email}</p>
                </TableCell>
                <TableCell>{s.role === "admin" ? "Administrador" : "Staff"}</TableCell>
                <TableCell>{location?.name ?? "—"}</TableCell>
                <TableCell>
                  <Badge variant={s.is_active ? "secondary" : "outline"}>{s.is_active ? "Activo" : "Inactivo"}</Badge>
                </TableCell>
                <TableCell>
                  <ToggleStaffActiveButton
                    isActive={s.is_active}
                    onToggle={async (next) => {
                      "use server";
                      await toggleStaffActive(s.id, next);
                    }}
                  />
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}
