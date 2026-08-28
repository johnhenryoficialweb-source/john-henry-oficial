-- Claves de origen para el import del sistema legacy.
--
-- `orders` ya tenía la suya (0023). Faltaban clientes y medidas: sin ellas el
-- import se veía obligado a emparejar por (sede, teléfono), que no sirve cuando
-- 21 clientes no tienen teléfono y 10 lo tienen repetido. Con la clave de
-- origen el import es re-ejecutable sin duplicar nada.

alter table public.clients
  add column if not exists import_source_key text;

create unique index if not exists clients_import_source_key_idx
  on public.clients (import_source_key)
  where import_source_key is not null;

alter table public.client_measurements
  add column if not exists import_source_key text;

create unique index if not exists client_measurements_import_source_key_idx
  on public.client_measurements (import_source_key)
  where import_source_key is not null;
