-- Saca el acuerdo de regalía de la base de datos.
--
-- 0031 sembraba settings.royalty como configuración editable. Se revirtió esa
-- decisión: el porcentaje y las sedes del acuerdo son un pacto societario y su
-- única fuente de verdad es ROYALTY_AGREEMENT en src/lib/finance/config.ts,
-- donde cambiarlos deja rastro en el repositorio y exige un despliegue.
--
-- Esta migración solo aplica a bases donde 0031 ya se corrió con el insert
-- original; en una base nueva no encuentra nada que borrar y no hace daño.
-- Sin este delete, la fila quedaría como una perilla muerta que nadie lee pero
-- que aparenta ser el interruptor del acuerdo.

delete from public.settings where key = 'royalty';
