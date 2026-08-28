-- Contenido de marca de relleno: catálogo de telas y primera línea de sacos.
--
-- Las imágenes son fotografía de relleno de Unsplash mientras se construye el
-- archivo propio de producto y proceso (la prioridad visual pendiente de la
-- marca). Las URLs son estables y se reemplazan una a una cuando entre la
-- fotografía real, sin tocar el resto del registro.
--
-- Los nombres de tela son evocadores y las composiciones son razonables pero
-- FICTICIAS — son datos de ejemplo para poblar el catálogo, no referencias
-- reales de proveedor. Revisar antes de producción.

insert into public.fabrics (code, name, color, composition, supplier, price_per_meter, price_currency, stock_meters)
values
  ('VBC-1401', 'Marino Profundo',   'Azul marino',   'Lana virgen 100% · Super 130s',              'Vitale Barberis Canonico', 92.00,  'USD', 48.0),
  ('VBC-1408', 'Grafito Nocturno',  'Gris carbón',   'Lana virgen 100% · Super 150s',              'Vitale Barberis Canonico', 118.00, 'USD', 36.5),
  ('LP-2203',  'Ceniza de Invierno','Gris medio',    'Lana 96% · Cachemira 4%',                    'Loro Piana',               186.00, 'USD', 22.0),
  ('LP-2210',  'Tabaco Seco',       'Camel',         'Lana 90% · Cachemira 10%',                   'Loro Piana',               204.00, 'USD', 18.0),
  ('DR-0917',  'Negro Permanente',  'Negro',         'Lana virgen 100% · Super 140s',              'Drago',                    104.00, 'USD', 41.0),
  ('DR-0925',  'Azul Medianoche',   'Azul noche',    'Lana 99% · Elastano 1%',                     'Drago',                    98.00,  'USD', 33.0),
  ('RG-3302',  'Oliva Callado',     'Verde oliva',   'Lana virgen 100% · Super 120s',              'Reda',                     86.00,  'USD', 27.5),
  ('RG-3311',  'Lino de Panamá',    'Beige natural', 'Lino 55% · Lana 45%',                        'Reda',                     74.00,  'USD', 30.0),
  ('CE-4405',  'Espiga de Bogotá',  'Gris espiga',   'Lana virgen 100% · Tejido espiga',           'Cerruti',                  112.00, 'USD', 19.0),
  ('CE-4412',  'Franela Templada',  'Azul acero',    'Lana 100% · Franela peinada',                'Cerruti',                  96.00,  'USD', 25.0)
on conflict (code) do nothing;

-- Imágenes de textura. Se aplican por separado para que el `on conflict do
-- nothing` de arriba no impida corregir una URL en un catálogo ya sembrado.
update public.fabrics set image_url = 'https://images.unsplash.com/photo-1643313262988-cdc5f50c6019?w=900&q=85&auto=format&fit=crop' where code = 'VBC-1401' and image_url is null;
update public.fabrics set image_url = 'https://images.unsplash.com/photo-1532526674046-5b3f6d7d2ab1?w=900&q=85&auto=format&fit=crop' where code = 'VBC-1408' and image_url is null;
update public.fabrics set image_url = 'https://images.unsplash.com/photo-1643313262763-4056bfa99dd7?w=900&q=85&auto=format&fit=crop' where code = 'LP-2203'  and image_url is null;
update public.fabrics set image_url = 'https://images.unsplash.com/photo-1602706294170-1fed8eecd9f9?w=900&q=85&auto=format&fit=crop' where code = 'LP-2210'  and image_url is null;
update public.fabrics set image_url = 'https://images.unsplash.com/photo-1636716018019-569382b46111?w=900&q=85&auto=format&fit=crop' where code = 'DR-0917'  and image_url is null;
update public.fabrics set image_url = 'https://images.unsplash.com/photo-1643313262988-cdc5f50c6019?w=900&q=85&auto=format&fit=crop' where code = 'DR-0925'  and image_url is null;
update public.fabrics set image_url = 'https://images.unsplash.com/photo-1671624756418-22126da50dc3?w=900&q=85&auto=format&fit=crop' where code = 'RG-3302'  and image_url is null;
update public.fabrics set image_url = 'https://images.unsplash.com/photo-1643313260651-9c335822ecde?w=900&q=85&auto=format&fit=crop' where code = 'RG-3311'  and image_url is null;
update public.fabrics set image_url = 'https://images.unsplash.com/photo-1636716018960-eb737dccb185?w=900&q=85&auto=format&fit=crop' where code = 'CE-4405'  and image_url is null;
update public.fabrics set image_url = 'https://images.unsplash.com/photo-1643313262763-4056bfa99dd7?w=900&q=85&auto=format&fit=crop' where code = 'CE-4412'  and image_url is null;
