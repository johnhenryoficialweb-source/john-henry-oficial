import "server-only";
import { google } from "googleapis";

/**
 * Cliente autenticado de Google Calendar vía service account.
 *
 * Nota (roadmap Fase 2): domain-wide delegation requiere Google Workspace.
 * Si la sastrería usa una cuenta de Gmail personal en vez de Workspace, esta
 * autenticación deberá cambiar a OAuth2 con refresh token delegado del Sr.
 * Henry — se decide al planificar la integración real de citas.
 */
export function createGoogleCalendarClient() {
  const auth = new google.auth.JWT({
    email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
    key: process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY?.replace(/\\n/g, "\n"),
    scopes: ["https://www.googleapis.com/auth/calendar"],
  });

  return google.calendar({ version: "v3", auth });
}
