/**
 * URLs absolutas para los botones de los correos.
 *
 * Un correo no tiene origen: un enlace relativo simplemente no funciona. Y
 * `NEXT_PUBLIC_SITE_URL` apunta a localhost en desarrollo, que es exactamente
 * lo que se quiere al probar, pero sería un enlace roto si se filtrara a un
 * envío real — por eso el fallback es el dominio de producción y no una cadena
 * vacía.
 */
export function siteUrl(): string {
  const configured = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  if (configured) return configured.replace(/\/$/, "");
  if (process.env.VERCEL_PROJECT_PRODUCTION_URL) {
    return `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`;
  }
  return "https://johnhenryoficial.com";
}

/** Página pública de reserva de citas. */
export function bookingUrl(): string {
  return `${siteUrl()}/citas`;
}
