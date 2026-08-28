-- Plantillas base de confección por prenda.
--
-- No son un catálogo cerrado: en el sistema anterior, de 462 especificaciones
-- de saco 435 eran distintas entre sí. El sastre siempre ajusta. Estas
-- plantillas solo siembran el detalle de la pieza para no escribirlo desde
-- cero, y salen de los fragmentos más repetidos del histórico importado
-- (bolsillo tapa 167×, solapa clásica 8cm 119×, espalda dos aberturas 117×,
-- espalda lisa 434×, pretina cruzada 90×, bota sencilla 73×).

insert into public.garment_models (garment_type, name, code, description)
values
  ('saco', 'Clásico dos botones', 'SAC-CL2',
   'Frente sencillo, 2 botones, Bolsillo tapa, Solapa clásica 8cm, Espalda dos aberturas'),
  ('saco', 'Clásico una abertura', 'SAC-CL1',
   'Frente sencillo, 2 botones, Bolsillo tapa, Solapa clásica 7cm, Espalda una abertura'),
  ('saco', 'Cruzado', 'SAC-CRZ',
   'Frente cruzado, 6 botones, Bolsillo tapa, Solapa pico, Espalda dos aberturas'),

  ('camisa', 'Cuello Dany', 'CAM-DAN',
   'Cuello Dany, Pespuntes 3/16, Textura normal, Puño 7rc, Bolsillo NO, Espalda lisa, Pechera SI'),
  ('camisa', 'Cuello semifrancés', 'CAM-SEM',
   'Cuello semifrancés, Pespuntes 3/16, Textura normal, Puño 7rc, Bolsillo NO, Espalda lisa, Pechera SI'),
  ('camisa', 'Puño mancorna', 'CAM-MAN',
   'Cuello Dany under, Pespuntes 3/16, Textura normal, Puño 7 mancorna, Bolsillo NO, Espalda lisa, Pechera NO'),

  ('pantalon', 'Clásico sin prenses', 'PAN-CL',
   'Bolsillo sesgado, Pretina cruzada, Sin prenses, Bolsillo relojero, 2 bolsillos traseros, Bota sencilla'),
  ('pantalon', 'Con prenses', 'PAN-PRE',
   'Bolsillo sesgado, Pretina cruzada, Con prenses, Bolsillo relojero, 2 bolsillos traseros, Bota sencilla'),

  ('chaleco', 'Clásico cinco botones', 'CHL-CL5',
   'Frente 5 botones, Escote en V, Espalda en forro con hebilla, Dos bolsillos delanteros')
on conflict (garment_type, name) do nothing;
