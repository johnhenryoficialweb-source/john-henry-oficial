-- Catálogo de telas. Es un catálogo global compartido entre sedes
-- (decisión explícita: la tela es de marca, no de sede). Si en el futuro
-- se necesita inventario separado por sede, se puede agregar una tabla
-- fabric_stock_by_location sin romper este modelo.

create table public.fabrics (
  id uuid primary key default gen_random_uuid(),
  code text unique,
  name text not null,
  color text,
  composition text,
  supplier text,
  price_per_meter numeric(12, 2),
  price_currency public.currency_code not null default 'USD',
  image_url text,
  stock_meters numeric(10, 2) not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
