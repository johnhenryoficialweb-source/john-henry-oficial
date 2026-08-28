import { z } from "zod";
import { SERVICE_TYPES } from "@/lib/constants";

export const appointmentRequestSchema = z.object({
  fullName: z.string().trim().min(2, "El nombre es muy corto."),
  phone: z.string().trim().min(7, "Ingresa un teléfono válido."),
  email: z.email("Ingresa un correo válido.").optional().or(z.literal("")),
  documentId: z.string().trim().optional(),
  notes: z.string().trim().max(500, "La nota es muy larga.").optional(),
  locationCode: z.enum(["CO", "PA"], { error: "Selecciona una sede." }),
  serviceType: z.enum(SERVICE_TYPES, {
    error: "Selecciona un tipo de servicio.",
  }),
  startsAt: z.iso.datetime({ message: "Selecciona fecha y hora." }),
  // Ausente cuando la cita la crea un miembro autenticado del staff desde el CMS.
  turnstileToken: z.string().optional(),
});

export type AppointmentRequest = z.infer<typeof appointmentRequestSchema>;
