-- Usuarios del CMS, vinculados 1:1 a auth.users.
-- No hay auto-signup: un admin crea el usuario en Supabase Auth y luego
-- inserta la fila correspondiente aquí con el mismo id (ver README).

create table public.staff_users (
  id uuid primary key references auth.users (id) on delete cascade,
  location_id uuid references public.locations (id),
  role public.user_role not null default 'staff',
  full_name text not null,
  email text not null unique,
  phone text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint staff_location_required_unless_admin
    check (role = 'admin' or location_id is not null)
);

create index idx_staff_users_location on public.staff_users (location_id);
