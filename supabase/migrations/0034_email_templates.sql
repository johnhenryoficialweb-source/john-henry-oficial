-- Correos del sistema: textos editables y bitácora de envíos.
--
-- Hasta acá los correos eran código puro: cambiar "Estimado" por "Apreciado"
-- exigía un despliegue, y saber si un correo llegó exigía entrar a Resend. Las
-- dos cosas dejaban al administrador de la sastrería sin control sobre una
-- superficie que es de marca, no de ingeniería.
--
-- La tabla NO guarda el HTML completo a propósito. La estructura (tablas de
-- datos, totales, el envoltorio navy/oro) vive en código, donde está probada
-- contra Outlook y Gmail; acá solo vive la prosa. Dejar editar el HTML entero
-- convertiría cada corrección de una coma en un riesgo de romper el correo en
-- el cliente de la mitad de los destinatarios.
--
-- Una plantilla sin fila acá usa sus textos por defecto: la tabla es de
-- excepciones, no el catálogo. El catálogo vive en src/lib/email/registry.ts,
-- que es lo que el módulo /correos dibuja.

create table public.email_templates (
  -- Corresponde a EmailTemplateKey en src/lib/email/registry.ts.
  key text primary key,
  subject text,
  heading text,
  intro text,
  outro text,
  cta_label text,
  -- Apagar un correo es una decisión de negocio (ej. no avisar cada cambio de
  -- estado en temporada alta), pero los avisos de cita al cliente no se pueden
  -- apagar desde la interfaz: quien reservó tiene derecho a saber.
  is_enabled boolean not null default true,
  updated_by uuid references public.staff_users (id),
  updated_at timestamptz not null default now()
);

create trigger trg_set_updated_at before update on public.email_templates
  for each row execute function public.set_updated_at();

comment on table public.email_templates is
  'Sobrescrituras de texto por plantilla. Sin fila = se usan los textos por defecto del código.';

/*
 * Bitácora de envíos.
 *
 * Guarda tanto los éxitos como los fallos, y esa es la razón de existir: un
 * correo transaccional falla en silencio por naturaleza —nadie se entera de
 * que la confirmación no llegó hasta que el cliente no aparece a su cita—. Con
 * esto, /correos puede responder "el último aviso de entrega salió hace 3
 * horas" o "los últimos 4 fallaron por restricción de IP en Brevo".
 *
 * No guarda el HTML enviado: son kilobytes por fila que solo repiten lo que la
 * plantilla ya sabe generar, y el asunto más el destinatario alcanzan para
 * rastrear cualquier reclamo.
 */
create table public.email_log (
  id uuid primary key default gen_random_uuid(),
  template_key text not null,
  recipient text not null,
  subject text not null,
  status text not null check (status in ('sent', 'failed', 'skipped')),
  error text,
  provider_message_id text,
  -- Distingue el envío real del botón "enviar prueba" del módulo, para que un
  -- correo de prueba no se lea como evidencia de que el flujo real funciona.
  is_test boolean not null default false,
  order_id uuid references public.orders (id) on delete set null,
  appointment_id uuid references public.appointments (id) on delete set null,
  triggered_by uuid references public.staff_users (id) on delete set null,
  created_at timestamptz not null default now()
);

create index idx_email_log_template on public.email_log (template_key, created_at desc);
create index idx_email_log_created on public.email_log (created_at desc);
create index idx_email_log_status on public.email_log (status, created_at desc)
  where status = 'failed';

-- RLS ------------------------------------------------------------------------

alter table public.email_templates enable row level security;

-- Todo el staff necesita leerlas (el módulo muestra la vista previa a
-- cualquiera), pero editar el texto que sale con la marca es del admin.
create policy email_templates_select_all_staff on public.email_templates
  for select using (auth.uid() is not null);

create policy email_templates_write_admin on public.email_templates
  for all using (public.is_admin()) with check (public.is_admin());

alter table public.email_log enable row level security;

create policy email_log_select_all_staff on public.email_log
  for select using (auth.uid() is not null);

-- La escritura ocurre con service_role desde el servidor (el envío puede
-- originarse en el formulario público de citas, sin sesión de staff), así que
-- no se abre ninguna política de insert para usuarios autenticados.
create policy email_log_insert_admin on public.email_log
  for insert with check (public.is_admin());
