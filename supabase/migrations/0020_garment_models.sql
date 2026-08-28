-- Catálogo de modelos/estilos por tipo de prenda (ej. Saco: Cruzado, Recto,
-- Slim). Es un catálogo global compartido entre sedes, igual que fabrics —
-- el modelo es de marca, no de sede.

create table public.garment_models (
  id uuid primary key default gen_random_uuid(),
  garment_type public.garment_type not null,
  name text not null,
  code text,
  description text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (garment_type, name)
);

create index idx_garment_models_type on public.garment_models (garment_type);

-- garment_models (catálogo compartido entre sedes)
alter table public.garment_models enable row level security;

create policy garment_models_select_all_staff on public.garment_models
  for select using (auth.uid() is not null);

create policy garment_models_insert_staff on public.garment_models
  for insert with check (auth.uid() is not null);

create policy garment_models_update_staff on public.garment_models
  for update using (auth.uid() is not null) with check (auth.uid() is not null);

create policy garment_models_delete_admin on public.garment_models
  for delete using (public.is_admin());
