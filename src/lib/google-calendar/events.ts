import "server-only";
import { createGoogleCalendarClient } from "./client";

export interface CalendarEventInput {
  calendarId: string;
  summary: string;
  description?: string;
  startsAt: string;
  endsAt: string;
  attendeeEmail?: string;
}

export async function createCalendarEvent(input: CalendarEventInput) {
  const calendar = createGoogleCalendarClient();

  const { data } = await calendar.events.insert({
    calendarId: input.calendarId,
    requestBody: {
      summary: input.summary,
      description: input.description,
      start: { dateTime: input.startsAt },
      end: { dateTime: input.endsAt },
      attendees: input.attendeeEmail ? [{ email: input.attendeeEmail }] : undefined,
    },
  });

  return data.id;
}

export async function updateCalendarEvent(
  calendarId: string,
  eventId: string,
  input: Partial<CalendarEventInput>,
) {
  const calendar = createGoogleCalendarClient();

  await calendar.events.patch({
    calendarId,
    eventId,
    requestBody: {
      summary: input.summary,
      description: input.description,
      start: input.startsAt ? { dateTime: input.startsAt } : undefined,
      end: input.endsAt ? { dateTime: input.endsAt } : undefined,
    },
  });
}

export async function deleteCalendarEvent(calendarId: string, eventId: string) {
  const calendar = createGoogleCalendarClient();
  await calendar.events.delete({ calendarId, eventId });
}
