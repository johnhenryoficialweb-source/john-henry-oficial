-- Configuración de disponibilidad por sede: reglas semanales recurrentes
-- (day_of_week) + excepciones puntuales/feriados (specific_date,
-- is_blocked = true). El endpoint GET /api/availability calcula huecos
-- libres = ventanas recurrentes - bloqueos - citas existentes que se solapan.

create table public.availability_slots (
  id uuid primary key default gen_random_uuid(),
  location_id uuid not null references public.locations (id),
  staff_user_id uuid references public.staff_users (id),
  day_of_week smallint check (day_of_week between 0 and 6),
  specific_date date,
  start_time time not null,
  end_time time not null,
  slot_duration_minutes int not null default 60,
  is_blocked boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint availability_recurring_xor_specific check (
    (day_of_week is not null and specific_date is null)
    or (day_of_week is null and specific_date is not null)
  ),
  constraint availability_time_order check (end_time > start_time)
);

create index idx_availability_location on public.availability_slots (location_id);
