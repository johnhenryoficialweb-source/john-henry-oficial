-- Citas. google_calendar_event_id permite sincronizar reprogramaciones y
-- cancelaciones con el evento correspondiente en Google Calendar en vez de
-- recrearlo. El flujo público (Turnstile + service_role) inserta con
-- created_via = 'public_form'; el CMS inserta con 'cms'.

create table public.appointments (
  id uuid primary key default gen_random_uuid(),
  location_id uuid not null references public.locations (id),
  client_id uuid not null references public.clients (id),
  staff_user_id uuid references public.staff_users (id),
  appointment_type text not null default 'consulta'
    check (appointment_type in ('medidas', 'prueba', 'entrega', 'consulta', 'otro')),
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  status public.appointment_status not null default 'pending',
  notes text,
  google_calendar_event_id text,
  created_via public.appointment_source not null default 'cms',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint appointments_time_order check (ends_at > starts_at)
);

create index idx_appointments_location_time on public.appointments (location_id, starts_at);
create index idx_appointments_client on public.appointments (client_id);
