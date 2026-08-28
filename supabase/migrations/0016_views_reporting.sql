-- Vistas de reporting financiero consolidado (COP + USD -> USD).
--
-- security_invoker = true es obligatorio: sin esto, las vistas correrían
-- con permisos del owner y saltarían las RLS policies de orders/payments,
-- exponiendo datos de otras sedes a través de la vista.

create or replace view public.v_orders_consolidated as
select
  o.*,
  case
    when o.currency = 'USD' then o.total
    else round(o.total / o.exchange_rate_to_usd, 2)
  end as total_usd
from public.orders o;

alter view public.v_orders_consolidated set (security_invoker = true);

create or replace view public.v_payments_consolidated as
select
  p.*,
  case
    when p.currency = 'USD' then p.amount
    else round(
      p.amount / (select o.exchange_rate_to_usd from public.orders o where o.id = p.order_id),
      2
    )
  end as amount_usd
from public.payments p;

alter view public.v_payments_consolidated set (security_invoker = true);
