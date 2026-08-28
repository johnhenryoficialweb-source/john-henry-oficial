-- Historial de medidas del cliente. Es un log versionado (append-only),
-- no una tabla mutable:
--   - source = 'profile'        -> medida reutilizable de la ficha del cliente.
--                                   is_latest marca cuál es la vigente por
--                                   cliente + tipo de prenda.
--   - source = 'order_snapshot' -> copia congelada de una medida 'profile'
--                                   en el momento de crear una orden, ligada
--                                   a esa orden (order_id).
--
-- Convención de "values" (jsonb) por garment_type, documentada en
-- src/lib/constants.ts (no se fuerza por constraint para no bloquear la
-- evolución del digitalizador 3D en la Fase 4):
--   saco:     chest, waist, hip, shoulder_width, sleeve_length, back_length,
--             neck, cross_back
--   chaleco:  chest, waist, length, shoulder_width
--   camisa:   neck, chest, waist, sleeve_length, cuff, shirt_length,
--             shoulder_width
--   pantalon: waist, hip, inseam, outseam, rise, thigh, knee, hem

create table public.client_measurements (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients (id) on delete cascade,
  garment_type public.garment_type not null,
  values jsonb not null default '{}'::jsonb,
  unit public.measurement_unit not null default 'cm',
  notes text,
  source public.measurement_source not null default 'profile',
  order_id uuid references public.orders (id) on delete set null,
  is_latest boolean not null default true,
  taken_by uuid references public.staff_users (id),
  taken_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  constraint measurement_order_consistency check (
    (source = 'profile' and order_id is null)
    or (source = 'order_snapshot' and order_id is not null)
  )
);

create index idx_measurements_client_garment_latest
  on public.client_measurements (client_id, garment_type, is_latest);
