-- Elimina telas ficticias de ejemplo (0018_seed_brand_content) antes del catálogo real.

delete from public.fabrics
where code in (
  'VBC-1401',
  'VBC-1408',
  'LP-2203',
  'LP-2210',
  'DR-0917',
  'DR-0925',
  'RG-3302',
  'RG-3311',
  'CE-4405',
  'CE-4412'
);
