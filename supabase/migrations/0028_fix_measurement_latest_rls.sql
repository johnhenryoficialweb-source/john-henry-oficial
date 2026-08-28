-- Arregla la marca de medida vigente (is_latest).
--
-- `client_measurements` se declaró como log inmutable: RLS activo y a propósito
-- SIN policy de UPDATE (ver 0015). Pero el trigger que desmarca la medida
-- anterior (client_measurements_mark_latest, 0014) hace justamente un UPDATE, y
-- corre con el rol de quien inserta — así que RLS lo bloqueaba en silencio,
-- sin error.
--
-- Resultado: cada cliente terminaba con DOS medidas vigentes de la misma prenda
-- a partir de su segunda orden. Y `getLatestMeasurement` las lee con
-- `maybeSingle()`, que falla cuando hay más de una fila: la precarga de medidas
-- dejaba de funcionar justo para los clientes recurrentes, y sin avisar.
--
-- El trigger mantiene un invariante del sistema, no es una mutación del
-- usuario, así que corresponde SECURITY DEFINER. `search_path` fijo para que no
-- se pueda secuestrar la resolución de nombres.

create or replace function public.client_measurements_mark_latest()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
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

-- Repara lo que quedó mal: deja vigente solo la más reciente de cada
-- (cliente, prenda).
update public.client_measurements m
   set is_latest = false
 where m.source = 'profile'
   and m.is_latest = true
   and exists (
     select 1
       from public.client_measurements newer
      where newer.client_id = m.client_id
        and newer.garment_type = m.garment_type
        and newer.source = 'profile'
        and newer.is_latest = true
        and (newer.taken_at, newer.id) > (m.taken_at, m.id)
   );
