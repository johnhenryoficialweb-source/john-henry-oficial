-- Sedes (Colombia / Panamá). Cada sede define su propia moneda y zona horaria.

create table public.locations (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null,
  country text not null,
  currency public.currency_code not null,
  timezone text not null,
  address text,
  phone text,
  google_calendar_id text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on column public.locations.google_calendar_id is
  'ID del calendario de Google Calendar correspondiente a esta sede.';
