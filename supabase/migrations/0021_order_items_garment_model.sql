-- Cada pieza puede llevar, además de su tela, un modelo/estilo del catálogo
-- garment_models (ej. "Cruzado" vs "Recto" en un saco). Nullable: piezas
-- existentes y prendas sin modelo definido en el catálogo quedan sin asignar.

alter table public.order_items
  add column garment_model_id uuid references public.garment_models (id);
