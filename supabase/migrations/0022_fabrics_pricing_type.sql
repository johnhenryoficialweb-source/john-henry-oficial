-- Tipo de tela (muestrario) y precios duales COP/USD del catálogo importado.

alter table public.fabrics
  add column if not exists fabric_type text,
  add column if not exists price_cop numeric(12, 2),
  add column if not exists price_usd numeric(12, 2);

-- Upsert por proveedor + código (reemplaza unicidad global solo en code).
alter table public.fabrics drop constraint if exists fabrics_code_key;

create unique index if not exists fabrics_supplier_code_key
  on public.fabrics (supplier, code)
  where supplier is not null and code is not null;
