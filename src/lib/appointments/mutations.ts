import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { createCalendarEvent, updateCalendarEvent, deleteCalendarEvent } from "@/lib/google-calendar/events";
import { sendSystemEmail } from "@/lib/email/send";
import { bookingUrl } from "@/lib/email/links";
import {
  appointmentConfirmationClientEmail,
  appointmentStaffNotificationEmail,
  appointmentCancelledClientEmail,
  appointmentRescheduledClientEmail,
} from "@/lib/email/templates/appointment";
import { formatInTimeZone } from "@/lib/datetime/timezone";
import { LOCATION_NUMBER_LOCALE, type LocationCode } from "@/config/locations";
import {
  SERVICE_TYPE_DURATION_MINUTES,
  SERVICE_TYPE_LABELS,
  SERVICE_TYPE_TO_APPOINTMENT_TYPE,
  type ServiceType,
} from "@/lib/constants";
import type { AppointmentSource } from "@/types/database.types";

export class AppointmentConflictError extends Error {
  constructor() {
    super("El horario seleccionado ya no está disponible.");
    this.name = "AppointmentConflictError";
  }
}

async function hasOverlap(params: {
  locationId: string;
  startsAt: string;
  endsAt: string;
  excludeAppointmentId?: string;
}) {
  const admin = createAdminClient();
  let query = admin
    .from("appointments")
    .select("id")
    .eq("location_id", params.locationId)
    .neq("status", "cancelled")
    .lt("starts_at", params.endsAt)
    .gt("ends_at", params.startsAt);

  if (params.excludeAppointmentId) {
    query = query.neq("id", params.excludeAppointmentId);
  }

  const { data } = await query;
  return (data?.length ?? 0) > 0;
}

async function notifyAppointmentCreated(params: {
  appointmentId: string;
  clientName: string;
  clientPhone: string;
  clientEmail?: string | null;
  locationName: string;
  locationAddress?: string | null;
  timezone: string;
  locale: string;
  serviceLabel: string;
  startsAt: Date;
}) {
  const startsAtLabel = formatInTimeZone(params.startsAt, params.timezone, params.locale);

  const emailData = {
    clientName: params.clientName,
    locationName: params.locationName,
    locationAddress: params.locationAddress,
    serviceLabel: params.serviceLabel,
    startsAtLabel,
  };

  /*
   * Los dos correos salen en paralelo y de forma independiente: que el aviso
   * interno falle no puede dejar al cliente sin su confirmación, que es la que
   * de verdad importa. `sendSystemEmail` no lanza, así que no hace falta
   * envolver esto en try/catch — cada resultado ya queda en la bitácora.
   */
  await Promise.all([
    sendSystemEmail({
      templateKey: "appointment_confirmation",
      to: params.clientEmail,
      appointmentId: params.appointmentId,
      render: (override) => appointmentConfirmationClientEmail(emailData, override),
    }),
    process.env.NOTIFY_STAFF_EMAIL
      ? sendSystemEmail({
          templateKey: "appointment_staff_notification",
          to: process.env.NOTIFY_STAFF_EMAIL,
          appointmentId: params.appointmentId,
          render: (override) =>
            appointmentStaffNotificationEmail(
              { ...emailData, clientPhone: params.clientPhone, clientEmail: params.clientEmail },
              override,
            ),
        })
      : Promise.resolve(),
  ]);
}

export async function createAppointment(input: {
  fullName: string;
  phone: string;
  email?: string;
  documentId?: string;
  notes?: string;
  locationCode: LocationCode;
  serviceType: ServiceType;
  startsAt: string;
  createdVia: AppointmentSource;
}) {
  const admin = createAdminClient();

  const { data: location, error: locationError } = await admin
    .from("locations")
    .select("id, name, address, timezone, google_calendar_id")
    .eq("code", input.locationCode)
    .single();

  if (locationError || !location) {
    throw new Error("Sede no encontrada.");
  }

  const durationMinutes = SERVICE_TYPE_DURATION_MINUTES[input.serviceType];
  const startsAtDate = new Date(input.startsAt);
  const endsAtDate = new Date(startsAtDate.getTime() + durationMinutes * 60_000);

  if (
    await hasOverlap({
      locationId: location.id,
      startsAt: startsAtDate.toISOString(),
      endsAt: endsAtDate.toISOString(),
    })
  ) {
    throw new AppointmentConflictError();
  }

  let { data: client } = await admin
    .from("clients")
    .select("id, full_name, email, phone")
    .eq("home_location_id", location.id)
    .eq("phone", input.phone)
    .is("deleted_at", null)
    .maybeSingle();

  if (!client) {
    const { data: newClient, error: clientError } = await admin
      .from("clients")
      .insert({
        home_location_id: location.id,
        full_name: input.fullName,
        phone: input.phone,
        email: input.email || null,
        document_id: input.documentId || null,
      })
      .select("id, full_name, email, phone")
      .single();

    if (clientError || !newClient) throw new Error("No se pudo crear el cliente.");
    client = newClient;
  }

  const { data: appointment, error: appointmentError } = await admin
    .from("appointments")
    .insert({
      location_id: location.id,
      client_id: client.id,
      appointment_type: SERVICE_TYPE_TO_APPOINTMENT_TYPE[input.serviceType],
      starts_at: startsAtDate.toISOString(),
      ends_at: endsAtDate.toISOString(),
      status: "pending",
      notes: input.notes || null,
      created_via: input.createdVia,
    })
    .select("*")
    .single();

  if (appointmentError || !appointment) throw new Error("No se pudo crear la cita.");

  if (location.google_calendar_id && process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL) {
    try {
      const eventId = await createCalendarEvent({
        calendarId: location.google_calendar_id,
        summary: `Cita: ${client.full_name} — ${SERVICE_TYPE_LABELS[input.serviceType]}`,
        description: `Servicio: ${SERVICE_TYPE_LABELS[input.serviceType]}\nTeléfono: ${client.phone}`,
        startsAt: startsAtDate.toISOString(),
        endsAt: endsAtDate.toISOString(),
        attendeeEmail: client.email ?? undefined,
      });
      if (eventId) {
        await admin.from("appointments").update({ google_calendar_event_id: eventId }).eq("id", appointment.id);
      }
    } catch (error) {
      console.error("[appointments] fallo al crear evento de Google Calendar", error);
    }
  }

  await notifyAppointmentCreated({
    appointmentId: appointment.id,
    clientName: client.full_name,
    clientPhone: client.phone,
    clientEmail: client.email,
    locationName: location.name,
    locationAddress: location.address,
    timezone: location.timezone,
    locale: LOCATION_NUMBER_LOCALE[input.locationCode],
    serviceLabel: SERVICE_TYPE_LABELS[input.serviceType],
    startsAt: startsAtDate,
  });

  return { appointment, client, location };
}

export async function rescheduleAppointment(appointmentId: string, newStartsAtIso: string) {
  const admin = createAdminClient();

  const { data: appointment } = await admin
    .from("appointments")
    .select("*, clients(full_name, email), locations(name, address, timezone, code, google_calendar_id)")
    .eq("id", appointmentId)
    .single();

  if (!appointment) throw new Error("Cita no encontrada.");

  const originalDurationMs = new Date(appointment.ends_at).getTime() - new Date(appointment.starts_at).getTime();
  const newStartsAt = new Date(newStartsAtIso);
  const newEndsAt = new Date(newStartsAt.getTime() + originalDurationMs);

  if (
    await hasOverlap({
      locationId: appointment.location_id,
      startsAt: newStartsAt.toISOString(),
      endsAt: newEndsAt.toISOString(),
      excludeAppointmentId: appointmentId,
    })
  ) {
    throw new AppointmentConflictError();
  }

  await admin
    .from("appointments")
    .update({ starts_at: newStartsAt.toISOString(), ends_at: newEndsAt.toISOString(), status: "confirmed" })
    .eq("id", appointmentId);

  const location = appointment.locations as unknown as {
    name: string;
    address: string | null;
    timezone: string;
    code: LocationCode;
    google_calendar_id: string | null;
  };
  const client = appointment.clients as unknown as { full_name: string; email: string | null };

  if (appointment.google_calendar_event_id && location.google_calendar_id) {
    try {
      await updateCalendarEvent(location.google_calendar_id, appointment.google_calendar_event_id, {
        startsAt: newStartsAt.toISOString(),
        endsAt: newEndsAt.toISOString(),
      });
    } catch (error) {
      console.error("[appointments] fallo al actualizar evento de Google Calendar", error);
    }
  }

  await sendSystemEmail({
    templateKey: "appointment_rescheduled",
    to: client.email,
    appointmentId,
    render: (override) =>
      appointmentRescheduledClientEmail(
        {
          clientName: client.full_name,
          locationName: location.name,
          locationAddress: location.address,
          serviceLabel: appointment.appointment_type,
          startsAtLabel: formatInTimeZone(
            newStartsAt,
            location.timezone,
            LOCATION_NUMBER_LOCALE[location.code],
          ),
        },
        override,
      ),
  });

  return { startsAt: newStartsAt, endsAt: newEndsAt };
}

export async function cancelAppointment(appointmentId: string) {
  const admin = createAdminClient();

  const { data: appointment } = await admin
    .from("appointments")
    .select("*, clients(full_name, email), locations(name, timezone, code, google_calendar_id)")
    .eq("id", appointmentId)
    .single();

  if (!appointment) throw new Error("Cita no encontrada.");

  await admin.from("appointments").update({ status: "cancelled" }).eq("id", appointmentId);

  const location = appointment.locations as unknown as {
    name: string;
    timezone: string;
    code: LocationCode;
    google_calendar_id: string | null;
  };
  const client = appointment.clients as unknown as { full_name: string; email: string | null };

  if (appointment.google_calendar_event_id && location.google_calendar_id) {
    try {
      await deleteCalendarEvent(location.google_calendar_id, appointment.google_calendar_event_id);
    } catch (error) {
      console.error("[appointments] fallo al eliminar evento de Google Calendar", error);
    }
  }

  await sendSystemEmail({
    templateKey: "appointment_cancelled",
    to: client.email,
    appointmentId,
    render: (override) =>
      appointmentCancelledClientEmail(
        {
          clientName: client.full_name,
          locationName: location.name,
          serviceLabel: appointment.appointment_type,
          startsAtLabel: formatInTimeZone(
            new Date(appointment.starts_at),
            location.timezone,
            LOCATION_NUMBER_LOCALE[location.code],
          ),
        },
        override,
        { bookingUrl: bookingUrl() },
      ),
  });
}
