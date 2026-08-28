-- Funciones y triggers de negocio.

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger trg_set_updated_at before update on public.locations
  for each row execute function public.set_updated_at();
create trigger trg_set_updated_at before update on public.staff_users
  for each row execute function public.set_updated_at();
create trigger trg_set_updated_at before update on public.clients
  for each row execute function public.set_updated_at();
create trigger trg_set_updated_at before update on public.fabrics
  for each row execute function public.set_updated_at();
create trigger trg_set_updated_at before update on public.orders
  for each row execute function public.set_updated_at();
create trigger trg_set_updated_at before update on public.order_items
  for each row execute function public.set_updated_at();
create trigger trg_set_updated_at before update on public.appointments
  for each row execute function public.set_updated_at();
create trigger trg_set_updated_at before update on public.availability_slots
  for each row execute function public.set_updated_at();

-- Número de orden autogenerado: JH-<código de sede>-<secuencia>.
create or replace function public.generate_order_number()
returns trigger
language plpgsql
as $$
declare
  loc_code text;
  seq_val bigint;
begin
  if new.order_number is not null then
    return new;
  end if;

  select code into loc_code from public.locations where id = new.location_id;
  seq_val := nextval('public.order_number_seq');
  new.order_number := 'JH-' || coalesce(loc_code, 'XX') || '-' || lpad(seq_val::text, 6, '0');
  return new;
end;
$$;

create trigger trg_generate_order_number before insert on public.orders
  for each row execute function public.generate_order_number();

-- Fija la moneda de la orden según la sede, y congela la tasa de cambio
-- vigente en settings.exchange_rate_usd_cop en el momento de creación.
create or replace function public.orders_set_currency_and_rate()
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

create trigger trg_orders_set_currency_and_rate before insert on public.orders
  for each row execute function public.orders_set_currency_and_rate();

-- Al insertar una medida 'profile', desmarca la anterior vigente del mismo
-- cliente + tipo de prenda como no-latest.
create or replace function public.client_measurements_mark_latest()
returns trigger
language plpgsql
as $$
begin
  if new.source = 'profile' then
    update public.client_measurements
      set is_latest = false
      where client_id = new.client_id
        and garment_type = new.garment_type
        and source = 'profile'
        and is_latest = true
        and id <> new.id;
  end if;
  return new;
end;
$$;

create trigger trg_measurements_mark_latest after insert on public.client_measurements
  for each row execute function public.client_measurements_mark_latest();

-- Recalcula subtotal/total de la orden cuando cambian sus order_items.
create or replace function public.orders_recalc_totals()
returns trigger
language plpgsql
as $$
declare
  target_order_id uuid;
  new_subtotal numeric(12, 2);
begin
  target_order_id := coalesce(new.order_id, old.order_id);

  select coalesce(sum(line_total), 0) into new_subtotal
    from public.order_items where order_id = target_order_id;

  update public.orders
    set subtotal = new_subtotal,
        total = greatest(new_subtotal - discount, 0)
    where id = target_order_id;

  return null;
end;
$$;

create trigger trg_order_items_recalc
  after insert or update or delete on public.order_items
  for each row execute function public.orders_recalc_totals();

-- Recalcula el total de la orden si se edita el descuento a nivel de orden.
create or replace function public.orders_recalc_total_on_discount()
returns trigger
language plpgsql
as $$
begin
  if new.discount is distinct from old.discount then
    new.total := greatest(new.subtotal - new.discount, 0);
  end if;
  return new;
end;
$$;

create trigger trg_orders_recalc_total_on_discount before update on public.orders
  for each row execute function public.orders_recalc_total_on_discount();

-- Un pago debe estar en la misma moneda que la orden a la que pertenece.
create or replace function public.validate_payment_currency()
returns trigger
language plpgsql
as $$
declare
  order_currency public.currency_code;
begin
  select currency into order_currency from public.orders where id = new.order_id;
  if new.currency is distinct from order_currency then
    raise exception 'El pago debe estar en la misma moneda de la orden (%).', order_currency;
  end if;
  return new;
end;
$$;

create trigger trg_validate_payment_currency before insert or update on public.payments
  for each row execute function public.validate_payment_currency();

-- El garment_type de un order_item debe coincidir con el de la medida
-- referenciada, si tiene una.
create or replace function public.validate_order_item_garment_type()
returns trigger
language plpgsql
as $$
declare
  m_garment public.garment_type;
begin
  if new.measurement_id is not null then
    select garment_type into m_garment
      from public.client_measurements where id = new.measurement_id;
    if m_garment is distinct from new.garment_type then
      raise exception 'El tipo de prenda de la medida (%) no coincide con el item (%).', m_garment, new.garment_type;
    end if;
  end if;
  return new;
end;
$$;

create trigger trg_validate_order_item_garment_type before insert or update on public.order_items
  for each row execute function public.validate_order_item_garment_type();
