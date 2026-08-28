-- Papelera de órdenes: borrado lógico con recuperación.
--
-- Mismo patrón que la papelera de clientes (0026) y por la misma razón, que
-- aquí pesa más: una orden cuelga medidas, pagos y correos ya enviados, y
-- `order_items` y `payments` borran en cascada desde ella. Un DELETE real se
-- lleva el rastro de plata que entró y no hay forma de reconstruirlo. Con
-- `deleted_at` la orden sale de los listados y de los reportes, pero el
-- histórico financiero sigue existiendo por si el borrado fue un error.
--
-- Las medidas del cliente NO cuelgan de la orden: viven en
-- `client_measurements` contra el cliente. Mandar una orden a la papelera no
-- toca una sola medida — que es justo la condición para poder limpiar el
-- histórico importado sin perder lo único que de verdad es irrecuperable.

alter table public.orders
  add column if not exists deleted_at timestamptz,
  add column if not exists deleted_by uuid references public.staff_users (id);

create index if not exists idx_orders_deleted_at
  on public.orders (deleted_at)
  where deleted_at is not null;

comment on column public.orders.deleted_at is
  'Papelera: la orden deja de contar en listados y reportes, pero sus pagos y su historial siguen existiendo.';
