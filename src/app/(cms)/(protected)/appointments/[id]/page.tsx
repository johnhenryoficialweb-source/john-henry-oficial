import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { APPOINTMENT_STATUS_LABELS } from "@/lib/constants";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { AppointmentQuickActions } from "@/components/cms/appointment-quick-actions";
import { RescheduleAppointmentForm } from "@/components/cms/reschedule-appointment-form";
import { ArrowLeftIcon } from "lucide-react";

export default async function AppointmentDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: appointment } = await supabase
    .from("appointments")
    .select("*, clients(id, full_name, phone, email), locations(name, address)")
    .eq("id", id)
    .single();

  if (!appointment) notFound();

  const client = appointment.clients as unknown as { id: string; full_name: string; phone: string; email: string | null };
  const location = appointment.locations as unknown as { name: string; address: string | null };

  return (
    <div className="max-w-lg space-y-6">
      <Link href="/appointments" className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeftIcon className="size-4" />
        Volver a citas
      </Link>

      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-heading text-2xl">
            {new Date(appointment.starts_at).toLocaleString("es-CO", { dateStyle: "full", timeStyle: "short" })}
          </h1>
          <p className="text-sm text-muted-foreground">
            <Link href={`/clients/${client.id}`} className="hover:text-accent">
              {client.full_name}
            </Link>{" "}
            · {client.phone} · {location.name}
          </p>
        </div>
        <Badge variant="secondary">{APPOINTMENT_STATUS_LABELS[appointment.status]}</Badge>
      </div>

      <Card>
        <CardContent className="flex items-center justify-between pt-6">
          <div>
            <p className="text-sm font-medium">Acciones rápidas</p>
            <p className="text-xs text-muted-foreground">Confirmar o cancelar esta cita.</p>
          </div>
          <AppointmentQuickActions appointmentId={appointment.id} status={appointment.status} />
        </CardContent>
      </Card>

      {appointment.status !== "cancelled" && appointment.status !== "completed" && (
        <Card>
          <CardContent className="pt-6">
            <RescheduleAppointmentForm appointmentId={appointment.id} />
          </CardContent>
        </Card>
      )}

      {appointment.notes && (
        <div>
          <h2 className="mb-1 text-sm font-medium">Notas</h2>
          <p className="text-sm text-muted-foreground">{appointment.notes}</p>
        </div>
      )}
    </div>
  );
}
