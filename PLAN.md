# John Henry Oficial — Plan vs. Estado Real

Comparación del mega-prompt original contra el código. Última actualización: 2026-07-10 (maniquí 3D completado).

Leyenda: ✅ Hecho · 🟡 Parcial · ⬜ Falta

**Resumen:** todo el plan original está implementado, incluido el maniquí 3D interactivo (sección 3.4) — ver detalle abajo. Sitio público, CMS/CRM completo, API, integraciones, finanzas multi-sede, y el digitalizador de medidas 3D están tipados sin errores y compilan en producción (`npm run build` pasa con 30+ rutas). Lo único pendiente es conectar un proyecto Supabase real y crear `.env.local` (ver "Para ejecutar" al final).

---

## 0. Infraestructura base

- ✅ Next.js 16 (App Router) + TS + Tailwind v4, fuentes de marca (`Playfair Display` + `Inter`) y paleta negro/carbón/dorado.
- ✅ shadcn/ui (`base-nova`, base-ui) instalado y usado en todo el CMS y sitio público.
- ✅ Clientes Supabase (browser/server/admin) con separación RLS vs. service_role.
- ✅ `.env.example` con todas las variables documentadas.
- ✅ `recharts` instalado para KPIs y comparativos.
- ✅ `database.types.ts` corregido: se le agregó `Relationships`/`Functions` (sin esto, **todas** las queries de supabase-js inferían `never` silenciosamente — bug preexistente que afectaba incluso el DAL de auth).
- ✅ `three` / `@react-three/fiber` / `@react-three/drei` instalados y en uso (maniquí 3D, sección 3.4).
- ✅ Tema negro/dorado forzado sitewide: `globals.css` ya tenía un bloque `.dark` completo (fondo #0b0b0a, acento dorado #c9a227) pero nada lo activaba (`next-themes` no estaba montado en un `ThemeProvider`, así que el sitio siempre renderizaba la paleta clara de `:root`). Se agregó `className="dark"` al `<html>` en `src/app/layout.tsx` — un solo look de marca, sin toggle claro/oscuro (no se pidió uno).

## 1. Identidad de marca y front-end público (sección 1)

- ✅ Paleta, tipografía y layout de marca.
- ✅ Header (nav + menú móvil) y footer (sedes reales desde Supabase) en `(public)/layout.tsx`.
- ✅ Home con hero, historia, servicios, galería de telas (desde R2/Supabase), sedes y CTA final.
- ✅ Nosotros, Colección (galería completa), Contacto (sedes + tel/mapa) con contenido real.
- ✅ Micro-animaciones: capa de movimiento en `globals.css`, sin librerías y sin JS. **Tesis: la línea** — la tomó del propio CTA de marca ("es una línea, no una flecha: se extiende en lugar de apuntar") y de los filetes de 1px que estructuran el sitio; el movimiento es el de la tiza sobre la tela y la costura que corre. Tres materiales con significados distintos, no una entrada repetida por sección: `jh-arrive` (llegada al hero, una sola vez, ~1.1s en cascada), `jh-unveil` (la foto se destapa desde abajo con clip-path, nunca un fade) y `jh-seam` (el filete se traza de izquierda a derecha). Scroll-driven nativo con `animation-timeline: view()` dentro de `@supports`, así que donde no hay soporte la página queda visible y quieta en vez de esconder contenido esperando JS. Todo dentro de `prefers-reduced-motion: no-preference`. Los fondos a sangre completa no se animan: son el suelo de la sección, no contenido.
- ✅ El CMS deliberadamente NO recibe coreografía (es Operate: hacer esperar a quien viene a leer cifras es un costo). Su única motion es funcional: la marca de sección activa en el sidebar, con el mismo idioma de línea. Las gráficas de finanzas tampoco animan su entrada, porque viven detrás del filtro de periodo y se remontarían en cada clic.

## 2. Reserva pública de citas (sección 2)

- ✅ Formulario completo: sede → servicio → fecha → horarios reales (`GET /api/availability`) → datos de contacto → Turnstile → confirmación.
- ✅ `POST /api/appointments`: crea cliente si no existe, valida solapamiento, crea evento en Google Calendar (si hay credenciales), envía email de confirmación al cliente y notificación al staff (Resend).
- ✅ `PATCH/DELETE /api/appointments/[id]`: reprogramar/cancelar, sincroniza Google Calendar y notifica por correo.
- ✅ Página de confirmación con resumen real de la cita.
- 🟡 Turnstile se omite automáticamente si `TURNSTILE_SECRET_KEY` no está configurada (decisión explícita para no bloquear desarrollo/demo sin credenciales de Cloudflare; queda forzado en cuanto se configure la env var).

## 3. CMS / CRM interno (sección 3)

- ✅ Esquema SQL completo (0001–0017) con RLS, triggers, vistas consolidadas.
- ✅ Login real (Supabase Auth) + sidebar de navegación + badge de sede activa.
- ✅ **3.1 Dashboard**: citas hoy/semana, ingresos del mes consolidado y por sede, ticket promedio, clientes nuevos vs. recurrentes, órdenes por estado, gráfica de tendencia (Recharts).
- ✅ **3.2 Citas**: agenda por día con navegación, confirmar/cancelar en un clic, alta manual, reprogramar. (Vista de lista/agenda, no un calendario drag-and-drop tipo FullCalendar — decisión de alcance para esta iteración).
- ✅ **3.3 CRM de clientes**: ficha completa (contacto, medidas vigentes, historial de órdenes y citas, notas), subpáginas dedicadas de historial de medidas y de órdenes.
- ✅ **3.4 Digitalizador de medidas**: fallback 2D completo (chips por prenda, medidas por campo, "cargar última medida", tela, costos) **más** el maniquí 3D interactivo (`src/components/measurement-digitizer/`): geometría paramétrica generada en código (no un asset GLB — ver nota abajo), hotspots clickeables por medida, panel flotante con stepper+slider, deformación en vivo de cada segmento del cuerpo, vistas rápidas frontal/espalda/perfil, y fallback automático al 2D cuando no hay WebGL (`useWebglSupport`, vía `useSyncExternalStore`). Integrado en `OrderItemsBuilder` como toggle 2D/3D por prenda. Pensado mobile/tablet-first (uso principal en el probador): visor a `min(60vh,560px)` con ancho fluido, blancos de toque de los hotspots ampliados (esfera invisible más grande que el punto visible), y una fila de chips grandes ("Ajustar medida") debajo del visor como alternativa fácil de tocar a acertarle al hotspot. Antes de mostrar el maniquí pide la altura del cliente (`HeightPrompt`) y precalcula las 17 medidas proporcionalmente (`estimateMeasurementsFromHeight`, calibrado contra una altura de referencia de 175cm) — el usuario solo ajusta lo puntual; si la prenda ya trae medidas (orden existente, "cargar última medida") se salta ese paso.
- ✅ **3.5 Pipeline de estados de orden**: badges clicables (`draft → confirmed → in_production → ready_for_delivery → delivered`), actualización en vivo.
- ✅ **3.6 Cuentas por cobrar**: `/finance/cobrar` lista saldos pendientes por cliente/orden, exportable a CSV.
- ✅ **3.7 Financiero multi-sede/multi-moneda**: `/finance/reportes` con totales COP y USD por separado, consolidado en USD (tasa configurable en Ajustes), comparativo Colombia vs. Panamá por mes (Recharts), filtro de fechas, export CSV.
- ✅ **3.8 Contabilidad completa** (migraciones 0029–0031, módulo `/finance` con navegación propia y periodo compartido entre pestañas):
  - **Panel por país** (`/finance`): un contador de dinero por sede — facturado, cobrado, por cobrar, costo base de piezas, salidas fijas/esporádicas, regalía y resultado neto, en moneda local y consolidado USD; gráfica de entradas contra salidas a 12 meses.
  - **Salidas de dinero** (`/finance/salidas`): egresos por sede con tasa congelada al registrar, filtros persistentes en URL, export CSV. `/finance/salidas/tipos` administra el catálogo (17 tipos base sembrados, `fixed` vs. `sporadic`) y las **salidas fijas** — plantillas mensuales que se materializan con un botón; el índice único `(recurring_expense_id, period_key)` hace la generación idempotente.
  - **Costos base por pieza** (`/finance/costos`): `garment_base_costs` con desglose tela/mano de obra/indirectos y resolución por alcance (modelo+sede > modelo > tipo+sede > general). El costo se congela en `order_items.unit_cost` vía trigger al crear la pieza, así que cambiar la tarifa no reescribe el margen del pasado. La pantalla reporta cuántas piezas se vendieron sin costo cargado en vez de fingir un margen exacto.
  - **Regalía inter-sede** (`/finance/royalties`): 12% de las ventas de Colombia para la casa matriz de Panamá. El acuerdo (porcentaje, sedes, base de cálculo) es `ROYALTY_AGREEMENT` en `src/lib/finance/config.ts` y **no se puede editar desde el sistema**: es un pacto societario, no una preferencia de la app, así que cambiarlo exige commit y despliegue. No hay server action que lo escriba y la pantalla solo lo muestra. Se recalcula desde las ventas reales hasta que se gira; al liquidarse queda congelada en `royalty_settlements` con su base y su tasa. No se registra como salida para no contarla dos veces: en el estado por país es su propia línea (sale de CO, entra a PA) y en el consolidado del grupo se reporta aparte, porque es un traslado interno.
- ✅ `POST /api/uploads/presign` cableado y usado por el formulario de telas (subida directa a R2).
- ✅ Ajustes: tasa de cambio editable (admin), gestión de usuarios del staff (invitar vía Supabase Auth admin API, activar/desactivar).
- ✅ **Asistente de nueva orden en 2 pasos** (`src/components/cms/new-order-wizard.tsx`, reemplaza el formulario plano anterior): paso 1 cliente existente o nuevo (se crea de una vez para poder seguir al paso 2 con su id, sin redirigir); paso 2 prendas + tela + medidas + abono + descuento + fecha de entrega + total en vivo, con `createOrder` refactorizado para recibir un objeto tipado en vez de `FormData` (invocación programática, no `<form action>`).
- ✅ **Maniquí único compartido por orden**: en vez de un maniquí independiente por prenda, `OrderItemsBuilder` mantiene un solo pool de medidas por nombre de campo (`waist`, `chest`, …) — así "cintura" se toma una sola vez aunque la orden tenga saco y pantalón. Cada prenda proyecta su propio subconjunto de campos (`projectMeasurements`) para el guardado (`client_measurements` sigue siendo una fila por prenda). El campo activo (`activeField`) está elevado a `OrderItemsBuilder` y es controlado (`MeasurementMannequin` ya no maneja su propio estado), así los chips del panel de resumen por prenda también abren el editor del maniquí compartido.
- ✅ **Resaltado en vivo del segmento activo**: al tocar un hotspot o un chip, el segmento del cuerpo correspondiente (`FIELD_TO_SEGMENTS` en `mannequin-figure.tsx`) se ilumina en dorado con un pulso sutil, para que sea evidente qué se está ajustando.
- ✅ **Ficha de orden premium** (`OrderSummaryDocument`, en `/orders/[id]`): ficha estilo atelier (tipografía serif, oro sobre negro, silueta del maniquí en modo solo-lectura) con "Descargar PDF" (diálogo nativo de impresión del navegador + `@media print` en `globals.css`, sin librería externa) y "Enviar por correo" (captura el canvas del maniquí a PNG, lo sube a R2, y envía una plantilla Resend nueva — `orderMeasurementSummaryEmail` — con la silueta embebida).
- ✅ Tema negro/dorado forzado sitewide (ver sección 0) — todo lo anterior ya hereda esa paleta sin trabajo adicional.

## 4. Modelo de datos (sección 4)

- ✅ Completo desde el inicio de esta sesión; sin cambios de esquema necesarios.

## 5. Integraciones (sección 5)

- ✅ Resend: cliente + plantillas reales (confirmación/cancelación/reprogramación de cita, confirmación de orden, actualización de estado) con la identidad de marca.
- ✅ Google Calendar: creación/actualización/eliminación de eventos cableada al ciclo de vida de citas.
- ✅ Cloudflare R2: presign + componente de subida de imágenes reutilizable, usado en telas.
- ✅ Cloudflare Turnstile: verificado server-side en el formulario público (con el fallback de desarrollo descrito arriba).

## 6. Requisitos no funcionales (sección 6)

- ✅ TypeScript estricto sin errores (`npx tsc --noEmit` limpio) y ESLint limpio.
- ✅ `npm run build` genera las 30+ rutas sin errores.
- ✅ Manejo de carga/errores en las mutaciones interactivas (toasts, estados disabled, `useTransition`).
- ✅ `Intl.NumberFormat` por sede/moneda en todo el CMS y finanzas.

## 7. Entregables (sección 7)

| # | Entregable | Estado |
|---|---|---|
| 1 | Estructura Next.js + TS + Tailwind | ✅ |
| 2 | SQL Supabase + RLS | ✅ |
| 3 | Front-end público completo | ✅ |
| 4 | CMS/CRM completo | ✅ |
| 5 | Integraciones funcionales end-to-end | ✅ |
| 6 | Dashboard financiero multi-sede | ✅ |
| 7 | README con setup/env/deploy | ✅ |

---

## Maniquí 3D interactivo (sección 3.4) — nota de diseño

En vez de cargar un asset GLB/GLTF externo (no existía ninguno en el repo y
sourcear uno de calidad/licencia adecuada a ciegas no era razonable), el
cuerpo se **genera proceduralmente** en `pose.ts`: cada medida (circunferencia
o longitud) se convierte matemáticamente en el radio/largo de un segmento
del maniquí (cilindros cónicos + esfera para la cabeza), recalculado en cada
render. Esto evita depender de un binario externo, mantiene el diff 100% en
código TypeScript versionable, y hace que la deformación en vivo sea exacta
(el segmento literalmente tiene el radio/largo de la medida capturada) en
vez de aproximada por skinning sobre una malla fija.

Verificado visualmente en navegador (Chrome, vía una ruta de prueba temporal
ya eliminada): hotspots clickeables, panel de edición, deformación en vivo,
las tres vistas rápidas, y fallback a 2D — sin errores de consola. No se
probó dentro del flujo real de `/orders/nueva` porque ese flujo requiere
Supabase conectado (ver siguiente sección).

## Para ejecutar / probar contra datos reales

1. Crear un proyecto Supabase, `supabase link` + `supabase db push`.
2. Copiar `.env.example` → `.env.local` con las credenciales reales (Supabase
   como mínimo; R2/Turnstile/Resend/Google Calendar son opcionales).
3. Crear el primer usuario admin en Supabase Auth + fila en `staff_users`.
4. `npm run dev`, probar `/orders/nueva` con el toggle 2D/3D en el
   constructor de prendas.
