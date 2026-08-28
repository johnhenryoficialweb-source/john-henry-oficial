-- Salidas de dinero (egresos) por sede.
--
-- Dos naturalezas de salida, según la categoría:
--   'fixed'    → recurrentes y previsibles (arriendo, nómina, servicios).
--                Se declaran una vez en recurring_expenses y se materializan
--                mes a mes en expenses.
--   'sporadic' → puntuales (compra de telas, mantenimiento, viáticos).
--
-- Igual que orders, cada salida congela su tasa de cambio al registrarse
-- (trigger expenses_set_currency_and_rate) para que el consolidado en USD no
-- se distorsione si la tasa cambia después.

create type public.expense_kind as enum ('fixed', 'sporadic');

create table public.expense_categories (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  code text unique,
  kind public.expense_kind not null default 'sporadic',
  description text,
  is_active boolean not null default true,
  sort_order int not null default 100,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index idx_expense_categories_kind on public.expense_categories (kind, sort_order);

-- Plantillas de salidas fijas. No son dinero que ya salió: son el compromiso
-- mensual del que se generan las filas reales de expenses.
create table public.recurring_expenses (
  id uuid primary key default gen_random_uuid(),
  location_id uuid not null references public.locations (id) on delete cascade,
  category_id uuid not null references public.expense_categories (id),
  description text not null,
  amount numeric(12, 2) not null check (amount > 0),
  currency public.currency_code not null,
  -- Se limita a 28 para que exista en todos los meses sin lógica de calendario.
  day_of_month int not null default 1 check (day_of_month between 1 and 28),
  method public.payment_method not null default 'transfer',
  vendor text,
  notes text,
  is_active boolean not null default true,
  starts_on date not null default current_date,
  ends_on date,
  created_by uuid references public.staff_users (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint recurring_expenses_period_valid check (ends_on is null or ends_on >= starts_on)
);

create index idx_recurring_expenses_location on public.recurring_expenses (location_id, is_active);

create table public.expenses (
  id uuid primary key default gen_random_uuid(),
  location_id uuid not null references public.locations (id),
  category_id uuid references public.expense_categories (id),
  description text not null,
  amount numeric(12, 2) not null check (amount > 0),
  currency public.currency_code not null,
  exchange_rate_to_usd numeric(14, 6) not null default 1
    check (exchange_rate_to_usd > 0),
  expense_date date not null default current_date,
  method public.payment_method not null default 'cash',
  vendor text,
  reference text,
  notes text,
  recurring_expense_id uuid references public.recurring_expenses (id) on delete set null,
  -- 'YYYY-MM' del periodo cubierto cuando la salida viene de una plantilla fija.
  period_key text,
  recorded_by uuid references public.staff_users (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index idx_expenses_location_date on public.expenses (location_id, expense_date desc);
create index idx_expenses_category on public.expenses (category_id);

-- Hace idempotente la generación mensual de salidas fijas: correr "generar
-- salidas del mes" dos veces no duplica nada.
create unique index uq_expenses_recurring_period
  on public.expenses (recurring_expense_id, period_key)
  where recurring_expense_id is not null;

create trigger trg_set_updated_at before update on public.expense_categories
  for each row execute function public.set_updated_at();
create trigger trg_set_updated_at before update on public.recurring_expenses
  for each row execute function public.set_updated_at();
create trigger trg_set_updated_at before update on public.expenses
  for each row execute function public.set_updated_at();

-- Misma política que orders: la moneda la define la sede y la tasa se congela
-- al registrar el movimiento.
create or replace function public.expenses_set_currency_and_rate()
returns trigger
language plpgsql
as $$
declare
  loc_currency public.currency_code;
  current_rate numeric;
begin
  if new.currency is null then
    select currency into loc_currency from public.locations where id = new.location_id;
    new.currency := loc_currency;
  end if;

  if new.currency = 'USD' then
    new.exchange_rate_to_usd := 1;
  elsif new.exchange_rate_to_usd is null or new.exchange_rate_to_usd = 1 then
    select (value ->> 'rate')::numeric into current_rate
      from public.settings where key = 'exchange_rate_usd_cop';
    new.exchange_rate_to_usd := coalesce(current_rate, 4000);
  end if;

  return new;
end;
$$;

create trigger trg_expenses_set_currency_and_rate before insert on public.expenses
  for each row execute function public.expenses_set_currency_and_rate();

-- Vista consolidada en USD, misma convención que v_orders_consolidated.
create or replace view public.v_expenses_consolidated as
select
  e.*,
  case
    when e.currency = 'USD' then e.amount
    else round(e.amount / e.exchange_rate_to_usd, 2)
  end as amount_usd
from public.expenses e;

alter view public.v_expenses_consolidated set (security_invoker = true);

-- RLS ---------------------------------------------------------------------

-- expense_categories: catálogo compartido; solo admin lo edita.
alter table public.expense_categories enable row level security;

create policy expense_categories_select_all_staff on public.expense_categories
  for select using (auth.uid() is not null);

create policy expense_categories_write_admin on public.expense_categories
  for all using (public.is_admin()) with check (public.is_admin());

-- recurring_expenses: compromiso de una sede; solo admin lo define.
alter table public.recurring_expenses enable row level security;

create policy recurring_expenses_select on public.recurring_expenses
  for select using (public.is_admin() or location_id = public.my_location_id());

create policy recurring_expenses_write_admin on public.recurring_expenses
  for all using (public.is_admin()) with check (public.is_admin());

-- expenses: el staff de la sede registra y corrige; borrar es solo de admin
-- (registro financiero auditable, igual que payments).
alter table public.expenses enable row level security;

create policy expenses_select on public.expenses
  for select using (public.is_admin() or location_id = public.my_location_id());

create policy expenses_insert on public.expenses
  for insert with check (public.is_admin() or location_id = public.my_location_id());

create policy expenses_update on public.expenses
  for update using (
    public.is_admin() or location_id = public.my_location_id()
  ) with check (
    public.is_admin() or location_id = public.my_location_id()
  );

create policy expenses_delete_admin on public.expenses
  for delete using (public.is_admin());

-- Catálogo inicial de tipos de salida ------------------------------------

insert into public.expense_categories (name, code, kind, description, sort_order) values
  ('Arriendo',                    'rent',           'fixed',    'Canon mensual del local o taller.', 10),
  ('Nómina',                      'payroll',        'fixed',    'Sueldos y prestaciones del equipo.', 20),
  ('Servicios públicos',          'utilities',      'fixed',    'Energía, agua, gas.', 30),
  ('Internet y telefonía',        'telecom',        'fixed',    'Conectividad y líneas móviles.', 40),
  ('Seguros',                     'insurance',      'fixed',    'Pólizas del local, inventario y equipo.', 50),
  ('Software y suscripciones',    'software',       'fixed',    'Herramientas digitales de operación.', 60),
  ('Contabilidad y legal',        'professional',   'fixed',    'Honorarios de contador y asesoría legal.', 70),
  ('Impuestos y tasas',           'taxes',          'fixed',    'Obligaciones tributarias periódicas.', 80),
  ('Compra de telas e insumos',   'materials',      'sporadic', 'Telas, forros, botones, entretelas.', 110),
  ('Taller y confección externa', 'outsourcing',    'sporadic', 'Pagos a sastres y talleres externos.', 120),
  ('Mantenimiento y adecuaciones','maintenance',    'sporadic', 'Reparaciones del local, máquinas y mobiliario.', 130),
  ('Publicidad y marketing',      'marketing',      'sporadic', 'Pauta, contenido, material promocional.', 140),
  ('Transporte y envíos',         'logistics',      'sporadic', 'Mensajería, domicilios, importaciones.', 150),
  ('Viáticos y viajes',           'travel',         'sporadic', 'Desplazamientos entre sedes y visitas.', 160),
  ('Comisiones bancarias',        'bank_fees',      'sporadic', 'Costos de datáfono, transferencias y pasarelas.', 170),
  ('Papelería y oficina',         'office',         'sporadic', 'Insumos administrativos.', 180),
  ('Otras salidas',               'other',          'sporadic', 'Movimientos que no encajan en las demás categorías.', 900)
on conflict (name) do nothing;
