-- Configuración general clave/valor (tasa de cambio, textos de correo, etc.).

create table public.settings (
  key text primary key,
  value jsonb not null,
  description text,
  updated_by uuid references public.staff_users (id),
  updated_at timestamptz not null default now()
);
