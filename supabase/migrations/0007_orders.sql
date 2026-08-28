-- Órdenes. La moneda y la tasa de cambio se fijan al crear la orden
-- (ver trigger orders_set_currency_and_rate en 0014) para que el reporte
-- consolidado no se distorsione si la tasa cambia después.

create sequence public.order_number_seq;

create table public.orders (
  id uuid primary key default gen_random_uuid(),
  order_number text unique,
  location_id uuid not null references public.locations (id),
  client_id uuid not null references public.clients (id),
  currency public.currency_code,
  exchange_rate_to_usd numeric(14, 6) not null default 1,
  status public.order_status not null default 'draft',
  expected_delivery_date date,
  assigned_staff_id uuid references public.staff_users (id),
  subtotal numeric(12, 2) not null default 0,
  discount numeric(12, 2) not null default 0,
  total numeric(12, 2) not null default 0,
  notes text,
  created_by uuid references public.staff_users (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint orders_amounts_non_negative
    check (subtotal >= 0 and discount >= 0 and total >= 0),
  constraint orders_exchange_rate_positive
    check (exchange_rate_to_usd > 0)
);

create index idx_orders_location_status on public.orders (location_id, status);
create index idx_orders_client on public.orders (client_id);

comment on column public.orders.exchange_rate_to_usd is
  'Unidades de la moneda de la orden equivalentes a 1 USD, congeladas al crear la orden.';
