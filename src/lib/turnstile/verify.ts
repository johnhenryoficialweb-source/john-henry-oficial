import "server-only";

const VERIFY_URL = "https://challenges.cloudflare.com/turnstile/v0/siteverify";

/**
 * Valida el token de Cloudflare Turnstile server-side antes de aceptar
 * cualquier inserción proveniente del formulario público de citas.
 */
export async function verifyTurnstileToken(token: string, remoteIp?: string) {
  const response = await fetch(VERIFY_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      secret: process.env.TURNSTILE_SECRET_KEY,
      response: token,
      remoteip: remoteIp,
    }),
  });

  const data: { success: boolean; "error-codes"?: string[] } = await response.json();
  return data.success;
}
