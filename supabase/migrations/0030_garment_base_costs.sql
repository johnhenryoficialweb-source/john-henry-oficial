-- Costo base por pieza.
--
-- Cuánto le cuesta a la casa producir una prenda, desglosado en tela + mano de
-- obra + indirectos. Es lo que permite leer margen real por orden en vez de
-- solo facturación.
--
-- El costo se resuelve del más específico al más general:
--   1. modelo + sede   (un cruzado en Bogotá)
--   2. modelo          (un cruzado, en cualquier sede)
--   3. tipo + sede     (cualquier saco en Bogotá)
--   4. tipo            (cualquier saco)
-- y se congela en order_items.unit_cost al crear la pieza, para que subir la
-- tarifa mañana no reescriba el margen de las órdenes de ayer.

create table public.garment_base_costs (
  id uuid primary key default gen_random_uuid(),
  garment_type public.garment_type not null,
  -- null = aplica a todos los modelos de ese tipo de prenda.
  garment_model_id uuid references public.garment_models (id) on delete cascade,
  -- null = aplica a todas las sedes.
  location_id uuid references public.locations (id) on delete cascade,
  currency public.currency_code not null,
  fabric_cost numeric(12, 2) not null default 0 check (fabric_cost >= 0),
  labor_cost numeric(12, 2) not null default 0 check (labor_cost >= 0),
  overhead_cost numeric(12, 2) not null default 0 check (overhead_cost >= 0),
  total_cost numeric(12, 2) generated always as (
    round((fabric_cost + labor_cost + overhead_cost)::numeric, 2)
  ) stored,
  notes text,
  is_active boolean not null default true,
  created_by uuid references public.staff_users (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Un solo costo por combinación de alcance. coalesce con el uuid nulo porque
-- en Postgres `null` no colisiona consigo mismo en un índice único.
create unique index uq_garment_base_costs_scope on public.garment_base_costs (
  garment_type,
  coalesce(garment_model_id, '00000000-0000-0000-0000-000000000000'::uuid),
  coalesce(location_id, '00000000-0000-0000-0000-000000000000'::uuid),
  currency
);

create index idx_garment_base_costs_type on public.garment_base_costs (garment_type);

create trigger trg_set_updated_at before update on public.garment_base_costs
  for each row execute function public.set_updated_at();

-- Costo congelado en la pieza ---------------------------------------------

alter table public.order_items
  add column unit_cost numeric(12, 2) not null default 0
    check (unit_cost >= 0);

alter table public.order_items
  add column line_cost numeric(12, 2) generated always as (
    round((quantity * unit_cost)::numeric, 2)
  ) stored;

comment on column public.order_items.unit_cost is
  'Costo base de producción de una unidad, congelado desde garment_base_costs al crear la pieza.';

create or replace function public.order_items_set_unit_cost()
returns trigger
language plpgsql
as $$
declare
  order_location uuid;
  order_currency public.currency_code;
  resolved_cost numeric(12, 2);
begin
  -- Un costo explícito (import histórico, ajuste manual) manda sobre el catálogo.
  if new.unit_cost is not null and new.unit_cost > 0 then
    return new;
  end if;

  select o.location_id, o.currency into order_location, order_currency
    from public.orders o where o.id = new.order_id;

  select c.total_cost into resolved_cost
    from public.garment_base_costs c
   where c.is_active
     and c.garment_type = new.garment_type
     and c.currency = order_currency
     and (c.garment_model_id is null or c.garment_model_id = new.garment_model_id)
     and (c.location_id is null or c.location_id = order_location)
   order by (c.garment_model_id is not null) desc,
            (c.location_id is not null) desc
   limit 1;

  new.unit_cost := coalesce(resolved_cost, 0);
  return new;
end;
$$;

create trigger trg_order_items_set_unit_cost before insert on public.order_items
  for each row execute function public.order_items_set_unit_cost();

-- RLS ---------------------------------------------------------------------

-- Es información de márgenes: la lee todo el staff (necesita saber el costo al
-- cotizar) pero solo admin la define.
alter table public.garment_base_costs enable row level security;

create policy garment_base_costs_select_all_staff on public.garment_base_costs
  for select using (auth.uid() is not null);

create policy garment_base_costs_write_admin on public.garment_base_costs
  for all using (public.is_admin()) with check (public.is_admin());
