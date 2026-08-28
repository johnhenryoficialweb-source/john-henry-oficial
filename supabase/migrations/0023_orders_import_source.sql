-- Clave de idempotencia para imports históricos (re-ejecutar sin duplicar órdenes).

alter table public.orders
  add column if not exists import_source_key text;

create unique index if not exists orders_import_source_key_idx
  on public.orders (import_source_key)
  where import_source_key is not null;
