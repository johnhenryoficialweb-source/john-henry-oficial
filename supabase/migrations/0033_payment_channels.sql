-- Medios de cobro y su comisión.
--
-- `payments.method` (efectivo/tarjeta/transferencia/otro) dice cómo pagó el
-- cliente, pero no por dónde entró la plata ni cuánto se quedó el intermediario.
-- Un cobro de $1.000.000 por datáfono no son $1.000.000 en la cuenta: son
-- $1.000.000 menos la comisión del adquirente. Sin esta distinción el panel
-- reporta un cobrado que nunca llegó completo, y el costo de las pasarelas
-- —que en un negocio con ticket alto es de los egresos más grandes— queda
-- invisible.
--
-- El porcentaje se configura por canal en /settings/medios-pago, pero cada
-- pago CONGELA la comisión con la que se registró, misma política que la tasa
-- de cambio en orders y expenses: renegociar el datáfono el año entrante no
-- puede reescribir lo que costó cobrar el año pasado.

create table public.payment_channels (
  id uuid primary key default gen_random_uuid(),
  code text unique,
  name text not null,
  -- Mapea al enum existente para que el histórico y los reportes por método
  -- sigan funcionando sin traducciones especiales.
  method public.payment_method not null default 'card',
  fee_percent numeric(5, 2) not null default 0
    check (fee_percent >= 0 and fee_percent <= 100),
  -- Costo fijo por transacción, en la moneda del pago. Algunas pasarelas
  -- cobran porcentaje + fijo.
  fee_fixed numeric(12, 2) not null default 0 check (fee_fixed >= 0),
  -- null = disponible en todas las sedes.
  location_id uuid references public.locations (id) on delete cascade,
  notes text,
  is_active boolean not null default true,
  sort_order int not null default 100,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index idx_payment_channels_active on public.payment_channels (is_active, sort_order);

create trigger trg_set_updated_at before update on public.payment_channels
  for each row execute function public.set_updated_at();

comment on column public.payment_channels.fee_percent is
  'Porcentaje que retiene el datáfono o la pasarela. Se congela en cada pago al registrarlo.';

alter table public.payments
  add column if not exists channel_id uuid references public.payment_channels (id),
  add column if not exists fee_percent numeric(5, 2) not null default 0
    check (fee_percent >= 0 and fee_percent <= 100),
  add column if not exists fee_amount numeric(12, 2) not null default 0
    check (fee_amount >= 0);

-- Lo que de verdad entra a la caja después de la comisión.
alter table public.payments
  add column if not exists net_amount numeric(12, 2)
    generated always as (amount - fee_amount) stored;

create index if not exists idx_payments_channel on public.payments (channel_id);

/*
 * Congela la comisión del canal en el pago.
 *
 * Solo en INSERT: un pago ya registrado no debe recalcular su comisión cuando
 * el admin cambie el porcentaje del canal, porque el dinero retenido ya
 * ocurrió. Si quien registra manda `fee_percent` explícito (una comisión
 * negociada distinta, o la digitalización de un cobro viejo), ese valor manda
 * sobre el del canal.
 */
create or replace function public.payments_set_channel_fee()
returns trigger
language plpgsql
as $$
declare
  channel record;
begin
  if new.channel_id is null then
    return new;
  end if;

  select method, fee_percent, fee_fixed into channel
    from public.payment_channels where id = new.channel_id;

  if not found then
    return new;
  end if;

  -- El canal es la fuente de verdad del método: evita un pago marcado
  -- "efectivo" cobrado por datáfono.
  new.method := channel.method;

  if coalesce(new.fee_percent, 0) = 0 then
    new.fee_percent := channel.fee_percent;
  end if;

  if coalesce(new.fee_amount, 0) = 0 then
    new.fee_amount := least(
      round(new.amount * new.fee_percent / 100 + channel.fee_fixed, 2),
      new.amount
    );
  end if;

  return new;
end;
$$;

create trigger trg_payments_set_channel_fee before insert on public.payments
  for each row execute function public.payments_set_channel_fee();

-- RLS ---------------------------------------------------------------------

-- Catálogo compartido entre sedes: lo consulta todo el staff (lo necesita para
-- registrar un cobro), lo edita solo el admin — es un dato con efecto contable.
alter table public.payment_channels enable row level security;

create policy payment_channels_select_all_staff on public.payment_channels
  for select using (auth.uid() is not null);

create policy payment_channels_write_admin on public.payment_channels
  for all using (public.is_admin()) with check (public.is_admin());

-- Catálogo inicial ---------------------------------------------------------
--
-- Se siembran en 0%: el porcentaje real lo pone el admin en Ajustes. Sembrar
-- un 3,5% de ejemplo sería inventar un número que después nadie revisa y que
-- terminaría restando plata que nunca se cobró.

insert into public.payment_channels (code, name, method, fee_percent, sort_order, notes) values
  ('cash',     'Efectivo',              'cash',     0, 10,  'Sin intermediarios: no causa comisión.'),
  ('transfer', 'Transferencia bancaria','transfer', 0, 20,  'Configura un porcentaje solo si el banco cobra por recibir.'),
  ('datafono', 'Datáfono',              'card',     0, 30,  'Terminal físico. Configura el porcentaje que retiene el adquirente.'),
  ('gateway',  'Pasarela / link de pago','other',   0, 40,  'Cobros en línea. Suelen cobrar porcentaje + fijo por transacción.')
on conflict (code) do nothing;

/*
 * Los pagos que ya existen se asocian al canal equivalente a su método.
 *
 * No cambia un solo peso: los canales sembrados están en 0%, así que
 * fee_amount sigue en cero y el neto sigue siendo igual al monto. Lo único que
 * gana el histórico es poder leerse con el mismo vocabulario que los cobros
 * nuevos.
 */
update public.payments p
set channel_id = c.id
from public.payment_channels c
where p.channel_id is null
  and c.code = case p.method
    when 'cash' then 'cash'
    when 'transfer' then 'transfer'
    when 'card' then 'datafono'
    else 'gateway'
  end;
