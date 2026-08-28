-- Quién recibe la orden de trabajo.
--
-- La orden de trabajo es el documento con el que el sastre corta: lleva
-- prendas, especificación y medidas, y NO lleva datos de contacto del cliente.
-- Sale por correo al crear y al confirmar la orden, y hay que saber a quién.
--
-- Se modela como tabla y no como una variable de entorno con dos correos
-- porque los destinatarios son gente que rota: entra un sastre, sale otro, la
-- sede de Panamá tiene el suyo. Un cambio de personal no puede exigir un
-- despliegue.
--
-- `role` incluye 'fabric_supplier' desde ya aunque todavía no se use: es el
-- caso que viene —mandarle la orden a quien vende la tela para gestionar la
-- compra— y dejar el hueco abierto cuesta una línea hoy y una migración
-- después.

create table public.workshop_recipients (
  id uuid primary key default gen_random_uuid(),
  -- null = recibe las órdenes de todas las sedes.
  location_id uuid references public.locations (id) on delete cascade,
  role text not null check (role in ('tailor', 'sales', 'fabric_supplier')),
  name text not null,
  email text not null,
  notes text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint workshop_recipients_email_format check (email like '%_@_%._%')
);

-- Un mismo correo no debe recibir el mismo documento dos veces por estar
-- registrado dos veces en la misma sede y rol.
create unique index idx_workshop_recipients_unique
  on public.workshop_recipients (coalesce(location_id, '00000000-0000-0000-0000-000000000000'::uuid), role, lower(email));

create index idx_workshop_recipients_active
  on public.workshop_recipients (is_active, location_id);

create trigger trg_set_updated_at before update on public.workshop_recipients
  for each row execute function public.set_updated_at();

comment on table public.workshop_recipients is
  'Destinatarios de la orden de trabajo (sastre, vendedor, proveedor de tela) por sede.';

comment on column public.workshop_recipients.location_id is
  'null = recibe las órdenes de trabajo de todas las sedes.';

-- RLS ------------------------------------------------------------------------

alter table public.workshop_recipients enable row level security;

-- Todo el staff los consulta (la ficha de la orden muestra a quién se envió),
-- pero solo el admin decide quién recibe un documento con las medidas de un
-- cliente.
create policy workshop_recipients_select_all_staff on public.workshop_recipients
  for select using (auth.uid() is not null);

create policy workshop_recipients_write_admin on public.workshop_recipients
  for all using (public.is_admin()) with check (public.is_admin());
