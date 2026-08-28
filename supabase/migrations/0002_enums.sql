-- Enum types shared across the schema.
-- Native Postgres enums (instead of text + check) so that
-- `supabase gen types typescript` generates real TS union types.

create type public.user_role as enum ('admin', 'staff');

create type public.currency_code as enum ('COP', 'USD');

create type public.garment_type as enum ('saco', 'chaleco', 'camisa', 'pantalon', 'otro');

create type public.appointment_status as enum (
  'pending',
  'confirmed',
  'completed',
  'cancelled',
  'no_show'
);

create type public.appointment_source as enum ('public_form', 'cms');

create type public.order_status as enum (
  'draft',
  'confirmed',
  'in_production',
  'ready_for_delivery',
  'delivered',
  'cancelled'
);

create type public.payment_method as enum ('cash', 'card', 'transfer', 'other');

create type public.measurement_source as enum ('profile', 'order_snapshot');

create type public.measurement_unit as enum ('cm', 'in');
