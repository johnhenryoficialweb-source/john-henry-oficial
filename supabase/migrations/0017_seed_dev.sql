-- Seed de desarrollo. NO ejecutar en producción sin revisar (sedes fijas
-- y tasa de cambio de ejemplo).

insert into public.locations (code, name, country, currency, timezone)
values
  ('CO', 'John Henry - Bogotá', 'Colombia', 'COP', 'America/Bogota'),
  ('PA', 'John Henry - Panamá', 'Panamá', 'USD', 'America/Panama')
on conflict (code) do nothing;

insert into public.settings (key, value, description)
values (
  'exchange_rate_usd_cop',
  jsonb_build_object('rate', 4000, 'as_of', current_date),
  'Tasa de cambio USD->COP usada para el reporte financiero consolidado.'
)
on conflict (key) do nothing;

-- El primer usuario staff_users se crea manualmente después de dar de alta
-- el auth.users correspondiente (ver README, sección "Crear primer usuario
-- admin"), porque no hay auto-signup público en este sistema.
