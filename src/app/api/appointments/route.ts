import { NextResponse, type NextRequest } from "next/server";
import { appointmentRequestSchema } from "@/lib/validations/appointment";
import { verifyTurnstileToken } from "@/lib/turnstile/verify";
import { getStaffSession } from "@/lib/auth/roles";
import { createAppointment, AppointmentConflictError } from "@/lib/appointments/mutations";

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  const parsed = appointmentRequestSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Datos inválidos." }, { status: 400 });
  }

  const staffSession = await getStaffSession();

  if (!staffSession && process.env.TURNSTILE_SECRET_KEY) {
    // Ruta pública (formulario de citas del sitio): requiere Turnstile
    // cuando está configurado. Sin la env var (p. ej. en desarrollo local
    // sin credenciales de Cloudflare), se omite para no bloquear el flujo.
    if (!parsed.data.turnstileToken) {
      return NextResponse.json({ error: "Verificación anti-bots requerida." }, { status: 400 });
    }

    const ip = request.headers.get("x-forwarded-for") ?? undefined;
    const isHuman = await verifyTurnstileToken(parsed.data.turnstileToken, ip);
    if (!isHuman) {
      return NextResponse.json({ error: "No se pudo verificar que eres humano." }, { status: 400 });
    }
  }

  try {
    const { appointment } = await createAppointment({
      fullName: parsed.data.fullName,
      phone: parsed.data.phone,
      email: parsed.data.email || undefined,
      documentId: parsed.data.documentId || undefined,
      notes: parsed.data.notes || undefined,
      locationCode: parsed.data.locationCode,
      serviceType: parsed.data.serviceType,
      startsAt: parsed.data.startsAt,
      createdVia: staffSession ? "cms" : "public_form",
    });

    return NextResponse.json({ appointment }, { status: 201 });
  } catch (error) {
    if (error instanceof AppointmentConflictError) {
      return NextResponse.json({ error: error.message }, { status: 409 });
    }
    console.error("[api/appointments] error al crear cita", error);
    return NextResponse.json({ error: "No se pudo crear la cita." }, { status: 500 });
  }
}
