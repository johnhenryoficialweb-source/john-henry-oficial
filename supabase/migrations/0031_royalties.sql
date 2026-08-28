-- Regalía inter-sede.
--
-- Panamá es la casa matriz de John Henry: un porcentaje de lo que se vende en
-- Colombia le pertenece. El acuerdo (porcentaje, sedes, base de cálculo) NO
-- vive en la base de datos: es una constante en src/lib/finance/config.ts
-- (ROYALTY_AGREEMENT). Es un pacto societario, no una preferencia editable —
-- cambiarlo debe exigir commit y despliegue, no una sesión del CMS.
--
-- La regalía se acumula sola (se calcula sobre orders/payments del periodo);
-- esta tabla existe para dejar constancia de la liquidación: cuánto se causó
-- en un mes, con qué tasa se convirtió, y si ya se giró o sigue pendiente.
-- No se registra como expense para no contarla dos veces: en el estado por
-- país aparece como su propia línea (sale de Colombia, entra a Panamá).

create type public.royalty_status as enum ('pending', 'paid');

create table public.royalty_settlements (
  id uuid primary key default gen_random_uuid(),
  -- Periodo liquidado, normalmente un mes calendario.
  period_start date not null,
  period_end date not null,
  source_location_id uuid not null references public.locations (id),
  beneficiary_location_id uuid not null references public.locations (id),
  percent numeric(5, 2) not null check (percent >= 0 and percent <= 100),
  -- Ventas del periodo sobre las que se calculó, en la moneda de la sede origen.
  base_amount numeric(14, 2) not null default 0 check (base_amount >= 0),
  base_currency public.currency_code not null,
  exchange_rate_to_usd numeric(14, 6) not null default 1
    check (exchange_rate_to_usd > 0),
  amount numeric(14, 2) not null default 0 check (amount >= 0),
  amount_usd numeric(14, 2) not null default 0 check (amount_usd >= 0),
  status public.royalty_status not null default 'pending',
  paid_at timestamptz,
  reference text,
  notes text,
  created_by uuid references public.staff_users (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint royalty_settlements_period_valid check (period_end >= period_start),
  constraint royalty_settlements_paid_has_date
    check (status <> 'paid' or paid_at is not null),
  unique (source_location_id, period_start)
);

create index idx_royalty_settlements_period on public.royalty_settlements (period_start desc);

create trigger trg_set_updated_at before update on public.royalty_settlements
  for each row execute function public.set_updated_at();

-- RLS ---------------------------------------------------------------------

-- Acuerdo entre sedes: lo ve el admin y la sede involucrada (origen o
-- beneficiaria), y solo el admin lo liquida.
alter table public.royalty_settlements enable row level security;

create policy royalty_settlements_select on public.royalty_settlements
  for select using (
    public.is_admin()
    or source_location_id = public.my_location_id()
    or beneficiary_location_id = public.my_location_id()
  );

create policy royalty_settlements_write_admin on public.royalty_settlements
  for all using (public.is_admin()) with check (public.is_admin());

-- Sin fila en settings a propósito: el acuerdo se lee de ROYALTY_AGREEMENT en
-- el código. Dejar acá una copia editable invitaría a cambiar el porcentaje por
-- la puerta de atrás y a que las dos fuentes se contradigan.
