-- Piezas de una orden. Múltiples unidades del mismo tipo de prenda con tela
-- distinta = una fila por unidad (quantity = 1, fabric_id distinto).
-- quantity > 1 solo se usa cuando fabric_id y measurement_id son idénticos
-- para agrupar unidades iguales.

create table public.order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders (id) on delete cascade,
  garment_type public.garment_type not null,
  fabric_id uuid references public.fabrics (id),
  measurement_id uuid references public.client_measurements (id),
  quantity int not null default 1,
  unit_price numeric(12, 2) not null default 0,
  item_discount numeric(12, 2) not null default 0,
  line_total numeric(12, 2) generated always as (
    round((quantity * unit_price - item_discount)::numeric, 2)
  ) stored,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint order_items_quantity_positive check (quantity > 0),
  constraint order_items_amounts_non_negative
    check (unit_price >= 0 and item_discount >= 0)
);

create index idx_order_items_order on public.order_items (order_id);
