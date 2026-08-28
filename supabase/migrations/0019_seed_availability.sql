-- Disponibilidad base por sede.
--
-- Sin filas en `availability_slots` el calendario público deshabilita TODOS los
-- días — correctamente, porque no hay ningún cupo que ofrecer. El sitio se ve
-- roto sin estarlo. Esta es la configuración mínima para que el sistema de
-- citas funcione.
--
-- Son ventanas recurrentes por día de la semana (day_of_week: 0 = domingo).
-- El endpoint resta bloqueos y citas ya tomadas. Ajustar desde el CMS cuando
-- el horario real de cada sede difiera de este.
--
-- Duración de 60 minutos: la consulta privada no se despacha en media hora.

insert into public.availability_slots (location_id, day_of_week, start_time, end_time, slot_duration_minutes)
select l.id, d.dow, d.start_time, d.end_time, 60
from public.locations l
cross join (values
  (1, time '09:00', time '18:00'),  -- lunes
  (2, time '09:00', time '18:00'),
  (3, time '09:00', time '18:00'),
  (4, time '09:00', time '18:00'),
  (5, time '09:00', time '18:00'),  -- viernes
  (6, time '10:00', time '14:00')   -- sábado, jornada corta
) as d(dow, start_time, end_time)
where l.is_active
  and not exists (
    select 1 from public.availability_slots a
    where a.location_id = l.id and a.day_of_week = d.dow
  );

-- El nombre de la sede se muestra en selectores dentro del propio sistema de
-- JOHN HENRY: repetir la marca en cada opción es ruido. La sede es la ciudad.
update public.locations set name = 'Bogotá'           where code = 'CO';
update public.locations set name = 'Ciudad de Panamá' where code = 'PA';
