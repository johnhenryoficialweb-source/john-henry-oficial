-- Row Level Security.
--
-- El formulario público de citas nunca usa el cliente anon de Supabase:
-- pasa siempre por route handlers server-side con service_role (ver
-- src/lib/supabase/admin.ts), que ignora RLS. Por eso estas policies solo
-- cubren roles autenticados del CMS (admin / staff) y no necesitan ninguna
-- regla para anon.

-- Helpers en security definer: evitan recursión de RLS al consultar
-- staff_users desde dentro de sus propias policies.
create or replace function public.is_admin()
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1 from public.staff_users
    where id = auth.uid() and role = 'admin' and is_active = true
  );
$$;

create or replace function public.my_location_id()
returns uuid
language sql
security definer
stable
set search_path = public
as $$
  select location_id from public.staff_users
  where id = auth.uid() and is_active = true;
$$;

-- locations
alter table public.locations enable row level security;

create policy locations_select_all_staff on public.locations
  for select using (auth.uid() is not null);

create policy locations_write_admin on public.locations
  for all using (public.is_admin()) with check (public.is_admin());

-- staff_users
alter table public.staff_users enable row level security;

create policy staff_users_select on public.staff_users
  for select using (
    public.is_admin() or id = auth.uid() or location_id = public.my_location_id()
  );

create policy staff_users_insert_admin on public.staff_users
  for insert with check (public.is_admin());

create policy staff_users_update_admin on public.staff_users
  for update using (public.is_admin()) with check (public.is_admin());

create policy staff_users_delete_admin on public.staff_users
  for delete using (public.is_admin());

-- clients
alter table public.clients enable row level security;

create policy clients_select on public.clients
  for select using (
    public.is_admin() or home_location_id = public.my_location_id()
  );

create policy clients_insert on public.clients
  for insert with check (
    public.is_admin() or home_location_id = public.my_location_id()
  );

create policy clients_update on public.clients
  for update using (
    public.is_admin() or home_location_id = public.my_location_id()
  ) with check (
    public.is_admin() or home_location_id = public.my_location_id()
  );

create policy clients_delete_admin on public.clients
  for delete using (public.is_admin());

-- client_measurements (log inmutable: sin policies de update/delete)
alter table public.client_measurements enable row level security;

create policy measurements_select on public.client_measurements
  for select using (
    public.is_admin() or exists (
      select 1 from public.clients c
      where c.id = client_measurements.client_id
        and c.home_location_id = public.my_location_id()
    )
  );

create policy measurements_insert on public.client_measurements
  for insert with check (
    public.is_admin() or exists (
      select 1 from public.clients c
      where c.id = client_measurements.client_id
        and c.home_location_id = public.my_location_id()
    )
  );

-- fabrics (catálogo compartido entre sedes)
alter table public.fabrics enable row level security;

create policy fabrics_select_all_staff on public.fabrics
  for select using (auth.uid() is not null);

create policy fabrics_insert_staff on public.fabrics
  for insert with check (auth.uid() is not null);

create policy fabrics_update_staff on public.fabrics
  for update using (auth.uid() is not null) with check (auth.uid() is not null);

create policy fabrics_delete_admin on public.fabrics
  for delete using (public.is_admin());

-- orders
alter table public.orders enable row level security;

create policy orders_select on public.orders
  for select using (public.is_admin() or location_id = public.my_location_id());

create policy orders_insert on public.orders
  for insert with check (public.is_admin() or location_id = public.my_location_id());

create policy orders_update on public.orders
  for update using (
    public.is_admin() or location_id = public.my_location_id()
  ) with check (
    public.is_admin() or location_id = public.my_location_id()
  );

create policy orders_delete_admin on public.orders
  for delete using (public.is_admin());

-- order_items (heredan el scope de sede de su orden)
alter table public.order_items enable row level security;

create policy order_items_select on public.order_items
  for select using (
    public.is_admin() or exists (
      select 1 from public.orders o
      where o.id = order_items.order_id and o.location_id = public.my_location_id()
    )
  );

create policy order_items_insert on public.order_items
  for insert with check (
    public.is_admin() or exists (
      select 1 from public.orders o
      where o.id = order_items.order_id and o.location_id = public.my_location_id()
    )
  );

create policy order_items_update on public.order_items
  for update using (
    public.is_admin() or exists (
      select 1 from public.orders o
      where o.id = order_items.order_id and o.location_id = public.my_location_id()
    )
  ) with check (
    public.is_admin() or exists (
      select 1 from public.orders o
      where o.id = order_items.order_id and o.location_id = public.my_location_id()
    )
  );

create policy order_items_delete on public.order_items
  for delete using (
    public.is_admin() or exists (
      select 1 from public.orders o
      where o.id = order_items.order_id and o.location_id = public.my_location_id()
    )
  );

-- payments (update/delete solo admin: registro financiero auditable)
alter table public.payments enable row level security;

create policy payments_select on public.payments
  for select using (
    public.is_admin() or exists (
      select 1 from public.orders o
      where o.id = payments.order_id and o.location_id = public.my_location_id()
    )
  );

create policy payments_insert on public.payments
  for insert with check (
    public.is_admin() or exists (
      select 1 from public.orders o
      where o.id = payments.order_id and o.location_id = public.my_location_id()
    )
  );

create policy payments_update_admin on public.payments
  for update using (public.is_admin()) with check (public.is_admin());

create policy payments_delete_admin on public.payments
  for delete using (public.is_admin());

-- appointments
alter table public.appointments enable row level security;

create policy appointments_select on public.appointments
  for select using (public.is_admin() or location_id = public.my_location_id());

create policy appointments_insert on public.appointments
  for insert with check (public.is_admin() or location_id = public.my_location_id());

create policy appointments_update on public.appointments
  for update using (
    public.is_admin() or location_id = public.my_location_id()
  ) with check (
    public.is_admin() or location_id = public.my_location_id()
  );

create policy appointments_delete on public.appointments
  for delete using (public.is_admin() or location_id = public.my_location_id());

-- availability_slots
alter table public.availability_slots enable row level security;

create policy availability_select on public.availability_slots
  for select using (public.is_admin() or location_id = public.my_location_id());

create policy availability_write on public.availability_slots
  for all using (
    public.is_admin() or location_id = public.my_location_id()
  ) with check (
    public.is_admin() or location_id = public.my_location_id()
  );

-- settings
alter table public.settings enable row level security;

create policy settings_select_all_staff on public.settings
  for select using (auth.uid() is not null);

create policy settings_write_admin on public.settings
  for all using (public.is_admin()) with check (public.is_admin());
