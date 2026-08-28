-- Papelera de clientes: borrado lógico con recuperación.
-- El teléfono único por sede solo aplica a clientes activos (no en papelera).

alter table public.clients
  add column if not exists deleted_at timestamptz,
  add column if not exists deleted_by uuid references public.staff_users (id);

create index if not exists idx_clients_deleted_at
  on public.clients (deleted_at)
  where deleted_at is not null;

alter table public.clients
  drop constraint if exists clients_home_location_id_phone_key;

create unique index if not exists clients_home_location_phone_active_idx
  on public.clients (home_location_id, phone)
  where deleted_at is null;
