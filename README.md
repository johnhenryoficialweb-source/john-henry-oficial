# John Henry Oficial

Repositorio: [github.com/johnhenryoficialweb-source/john-henry-oficial](https://github.com/johnhenryoficialweb-source/john-henry-oficial)

Sistema completo (sitio público + CMS/CRM interno) para una sastrería de alta costura con sedes en Colombia y Panamá. Next.js 16 (App Router) + TypeScript + Tailwind v4 + Supabase.

Ver `PLAN.md` para el estado detallado de cada módulo frente al plan original.

## Requisitos

- Node.js 20+
- Un proyecto de [Supabase](https://supabase.com)
- (Opcional para producción) Cuenta de Cloudflare R2, Cloudflare Turnstile, Brevo y un service account de Google Calendar

## Setup

1. Instala dependencias:

   ```bash
   npm install
   ```

2. Copia `.env.example` a `.env.local` y completa las variables:

   ```bash
   cp .env.example .env.local
   ```

   - `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY` / `SUPABASE_SERVICE_ROLE_KEY`: del panel de tu proyecto Supabase (Settings → API).
   - `R2_*`: credenciales de tu bucket de Cloudflare R2 (para fotos de telas y clientes).
   - `TURNSTILE_*`: site key / secret key de Cloudflare Turnstile. Si se dejan vacías en desarrollo, el formulario público de citas omite la verificación anti-bots (no debe quedar así en producción).
   - `BREVO_API_KEY` y `EMAIL_FROM_*`: llave de Brevo y remitente de los correos transaccionales. Si la cuenta de Brevo tiene activada la restricción "Authorised IPs", hay que desactivarla o autorizar las IP de salida del servidor: mientras esté activa, Brevo rechaza todos los envíos con 401.
   - `GOOGLE_SERVICE_ACCOUNT_*`: credenciales del service account con acceso a los calendarios de cada sede (opcional; si faltan, el sistema sigue funcionando pero no crea eventos en Google Calendar).

3. Aplica el esquema de base de datos. Con el [CLI de Supabase](https://supabase.com/docs/guides/cli) enlazado a tu proyecto:

   ```bash
   supabase link --project-ref <tu-project-ref>
   supabase db push
   ```

   Esto ejecuta en orden todas las migraciones en `supabase/migrations/` (extensiones, enums, tablas, triggers de negocio, RLS y vistas de reporting). `0017_seed_dev.sql` crea las dos sedes (CO/PA) y la tasa de cambio inicial.

4. Genera los tipos reales de la base de datos (opcional pero recomendado una vez el esquema esté aplicado):

   ```bash
   supabase gen types typescript --linked > src/types/database.types.ts
   ```

   > Si regeneras este archivo, conserva los campos `Relationships` y `Functions` — son obligatorios para que `@supabase/postgrest-js` infiera los tipos de las queries (sin ellos, todo se infiere como `never`). El CLI de Supabase ya los genera correctamente.

5. Crea el primer usuario administrador del CMS:

   - Crea el usuario en **Supabase Dashboard → Authentication → Users → Add user** (o invítalo desde `/settings/usuarios` una vez tengas un admin).
   - Inserta la fila correspondiente en `staff_users` con el mismo `id` del usuario de Auth y `role = 'admin'`.

6. Arranca el servidor de desarrollo:

   ```bash
   npm run dev
   ```

   - Sitio público: [http://localhost:3000](http://localhost:3000)
   - CMS: [http://localhost:3000/login](http://localhost:3000/login)

## Scripts

```bash
npm run dev      # servidor de desarrollo
npm run build    # build de producción (incluye type-check)
npm run start    # sirve el build de producción
npm run lint     # ESLint
```

## Estructura

- `src/app/(public)` — sitio público (marca, reserva de citas, colección de telas, contacto).
- `src/app/(cms)/(protected)` — panel interno autenticado (dashboard, citas, clientes, telas, órdenes, finanzas, ajustes).
- `src/app/api` — endpoints REST (disponibilidad, citas, presign de subidas a R2).
- `src/lib` — integraciones (Supabase, R2, Brevo, Google Calendar, Turnstile) y lógica de dominio (citas, finanzas, dashboard).
- `src/lib/email` — catálogo de correos del sistema (`registry.ts`), plantillas de marca y el único punto de envío (`send.ts`). El módulo `/correos` del CMS se dibuja entero desde el catálogo: agregar una plantilla ahí la hace aparecer sola, con vista previa y envío de prueba.
- `supabase/migrations` — esquema SQL completo con RLS por sede/rol.

## Deploy en Vercel

1. Importa el repositorio en Vercel.
2. Configura las mismas variables de entorno de `.env.local` en el proyecto de Vercel (Settings → Environment Variables).
3. Despliega. El build de Next.js corre el type-check automáticamente.

## Pendiente

El **digitalizador de medidas con maniquí 3D interactivo** (React Three Fiber) es el único módulo grande del plan original que no está implementado todavía — actualmente la captura de medidas usa un formulario 2D funcional (mismos campos, sin el modelo 3D). Ver `PLAN.md` para el detalle completo.
