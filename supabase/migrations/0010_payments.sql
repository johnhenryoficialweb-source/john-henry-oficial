-- Abonos/pagos de una orden. La moneda debe coincidir con la moneda de la
-- orden (validado por trigger validate_payment_currency en 0014).

create table public.payments (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders (id) on delete cascade,
  amount numeric(12, 2) not null check (amount > 0),
  currency public.currency_code not null,
  method public.payment_method not null,
  paid_at timestamptz not null default now(),
  reference text,
  recorded_by uuid references public.staff_users (id),
  notes text,
  created_at timestamptz not null default now()
);

create index idx_payments_order on public.payments (order_id);
