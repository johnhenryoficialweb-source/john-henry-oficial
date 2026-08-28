-- Clientes de la sastrería. Cada cliente pertenece a una sede principal
-- (home_location_id), lo que determina qué staff puede verlo por RLS.
-- Caso borde de un cliente que pide una orden en otra sede se resuelve
-- manualmente por un admin (transferencia de sede o registro separado).

create table public.clients (
  id uuid primary key default gen_random_uuid(),
  home_location_id uuid not null references public.locations (id),
  full_name text not null,
  email text,
  phone text not null,
  document_id text,
  notes text,
  created_by uuid references public.staff_users (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (home_location_id, phone)
);

create index idx_clients_location on public.clients (home_location_id);
