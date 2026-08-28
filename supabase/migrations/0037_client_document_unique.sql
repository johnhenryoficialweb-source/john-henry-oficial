-- La cédula identifica a una persona: no puede repetirse.
--
-- El documento es el único dato del cliente que no cambia. El teléfono se
-- cambia, el nombre entra escrito de tres formas distintas ("JUAN FELIPE
-- ARDILA" / "Juan F. Ardila B."), y por eso el directorio acumuló la misma
-- persona varias veces. Si la cédula también puede repetirse no resuelve nada:
-- sigue habiendo dos fichas del mismo señor, cada una con la mitad de sus
-- medidas y de su historial.
--
-- La unicidad es GLOBAL, no por sede. Un documento identifica a una persona, no
-- a una persona-en-Bogotá. Consecuencia deliberada: el atajo de registrar dos
-- veces al cliente que compra en las dos sedes (ver la nota en 0005) deja de
-- funcionar cuando ambas fichas llevan cédula; lo correcto pasa a ser transferir
-- la sede del cliente.

-- 1. Normalizar lo que ya está guardado ------------------------------------
--
-- El histórico importado trae el documento como venía escrito: con puntos,
-- espacios o guiones. La aplicación ahora lo guarda sin separadores, así que sin
-- este paso "1.020.304" y "1020304" convivirían como dos cédulas distintas y el
-- índice único no vería el duplicado que sí existe.

update public.clients
set document_id = nullif(upper(regexp_replace(document_id, '[^[:alnum:]]', '', 'g')), '')
where document_id is not null;

-- 2. Descartar lo que no es un documento -----------------------------------
--
-- El import trajo relleno en la columna: ocho clientes con cédula "0" y dos con
-- "101". No son documentos ni son duplicados que alguien pueda "resolver"
-- eligiendo la ficha correcta — ninguna de las dos fichas tiene la cédula
-- verdadera. Mandarlos a revisión a mano sería pedir que se decida cuál de dos
-- valores falsos se queda.
--
-- Peor que bloquear la migración: un documento basura rompe justo lo que la
-- cédula viene a dar. Buscar "0" devolvería ocho clientes distintos, y el aviso
-- de duplicado saltaría cada vez que alguien escriba un número corto.
--
-- El corte son 6 caracteres. Abajo de eso no cabe ningún documento real del
-- negocio: la cédula colombiana tiene 8-10 dígitos, la panameña normalizada
-- ronda 7 ("8-888-8888" → "88888888", "PE-12-345" → "PE12345") y un pasaporte
-- va de 6 a 9. Se descarta el relleno sin tocar nada que pueda ser cierto; el
-- dato original sigue en el backup si alguno hiciera falta.

do $$
declare
  discarded text;
  discarded_count int;
begin
  select count(*), string_agg(distinct doc, ', ' order by doc)
    into discarded_count, discarded
  from (
    select document_id as doc
      from public.clients
     where document_id is not null
       and (length(document_id) < 6 or document_id ~ '^0+$')
  ) as junk;

  if discarded_count > 0 then
    raise notice
      'Se descartaron % documento(s) que no pueden ser una cédula (valores: %). Las fichas de los clientes no se tocan; solo se vacía ese campo.',
      discarded_count, discarded;

    update public.clients
       set document_id = null
     where document_id is not null
       and (length(document_id) < 6 or document_id ~ '^0+$');
  end if;
end $$;

-- 3. Fallar con un mensaje que se pueda accionar ---------------------------
--
-- Sin esto la migración muere con un "duplicate key value violates unique
-- constraint" que no dice cuál cédula ni cuántos clientes. El bloque de abajo
-- nombra los documentos repetidos para poder ir a arreglarlos al CMS y volver a
-- correr la migración.

do $$
declare
  duplicates text;
  duplicate_count int;
begin
  select count(*), string_agg(entry, e'\n  · ' order by entry)
    into duplicate_count, duplicates
  from (
    select document_id || ' → ' || count(*)::text || ' clientes: '
             || string_agg(full_name, ', ' order by full_name) as entry
      from public.clients
     where document_id is not null
       and deleted_at is null
     group by document_id
    having count(*) > 1
  ) as repeated;

  if duplicate_count > 0 then
    raise exception using
      errcode = 'unique_violation',
      message = format(
        'Hay %s documento(s) repetido(s); la cédula no puede ser única hasta resolverlos.',
        duplicate_count
      ),
      detail = e'  · ' || duplicates,
      hint = 'Abre cada cliente en /clients y deja la cédula solo en la ficha correcta (o unifica las fichas). Después vuelve a correr la migración.';
  end if;
end $$;

-- 4. La restricción --------------------------------------------------------
--
-- Parcial en dos sentidos, ambos intencionales:
--   · `document_id is not null` — la cédula sigue siendo opcional. Exigirla
--     frenaría el registro en mostrador, donde muchas veces todavía no está.
--     Lo que se prohíbe es repetirla, no omitirla.
--   · `deleted_at is null` — un cliente en la papelera no bloquea su propia
--     cédula. Misma política que el teléfono en 0026. Restaurarlo cuando otra
--     ficha ya tomó ese documento sí falla, y `restoreClient` lo explica.

create unique index if not exists clients_document_id_active_idx
  on public.clients (document_id)
  where document_id is not null and deleted_at is null;

comment on column public.clients.document_id is
  'Cédula o documento, sin separadores y en mayúsculas. Único entre clientes activos: identifica a la persona.';


