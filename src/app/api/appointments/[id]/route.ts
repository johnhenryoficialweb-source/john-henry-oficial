import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { getStaffSession } from "@/lib/auth/roles";
import { rescheduleAppointment, cancelAppointment, AppointmentConflictError } from "@/lib/appointments/mutations";
import { createClient } from "@/lib/supabase/server";

const patchSchema = z.object({
  startsAt: z.iso.datetime().optional(),
  status: z.enum(["pending", "confirmed", "completed", "cancelled", "no_show"]).optional(),
});

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getStaffSession();
  if (!session) return NextResponse.json({ error: "No autorizado." }, { status: 401 });

  const { id } = await params;
  const body = await request.json().catch(() => null);
  const parsed = patchSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Datos inválidos." }, { status: 400 });
  }

  try {
    if (parsed.data.startsAt) {
      await rescheduleAppointment(id, parsed.data.startsAt);
    } else if (parsed.data.status) {
      const supabase = await createClient();
      const { error } = await supabase.from("appointments").update({ status: parsed.data.status }).eq("id", id);
      if (error) throw error;
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    if (error instanceof AppointmentConflictError) {
      return NextResponse.json({ error: error.message }, { status: 409 });
    }
    console.error("[api/appointments/:id] error al actualizar cita", error);
    return NextResponse.json({ error: "No se pudo actualizar la cita." }, { status: 500 });
  }
}

export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getStaffSession();
  if (!session) return NextResponse.json({ error: "No autorizado." }, { status: 401 });

  const { id } = await params;

  try {
    await cancelAppointment(id);
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("[api/appointments/:id] error al cancelar cita", error);
    return NextResponse.json({ error: "No se pudo cancelar la cita." }, { status: 500 });
  }
}
