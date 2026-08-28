import "server-only";

/**
 * Cliente de Brevo (antes Sendinblue) para correo transaccional.
 *
 * Se habla con la API REST por `fetch` en vez de traer `@getbrevo/brevo`: el
 * SDK arrastra un cliente generado grande para usar dos endpoints, y en Vercel
 * cada kilobyte de bundle de función se paga en cold start. La superficie que
 * de verdad usa el sistema es `/v3/smtp/email` (enviar) y `/v3/account`
 * (diagnóstico), y ambas son un POST/GET con una cabecera.
 *
 * La cuenta puede tener activada la restricción "Authorised IPs". Cuando está
 * activa, Brevo rechaza con 401 cualquier llamada desde una IP no registrada
 * —incluidas las IP de salida de Vercel, que son dinámicas—. Ese caso se
 * detecta explícitamente en `describeBrevoError` porque el mensaje crudo de
 * Brevo ("unrecognised IP address") no le dice nada a quien administra la
 * sastrería, y el arreglo no es tocar código sino desactivar la restricción.
 */

const BREVO_API_BASE = "https://api.brevo.com/v3";

export interface BrevoSendParams {
  to: string | string[];
  subject: string;
  html: string;
  /** Texto plano alternativo. Si se omite, Brevo lo deriva del HTML. */
  text?: string;
  replyTo?: string;
  /** Etiquetas de Brevo — permiten filtrar los envíos por tipo en su panel. */
  tags?: string[];
}

export interface BrevoSendResult {
  ok: boolean;
  messageId?: string;
  error?: string;
}

export class BrevoNotConfiguredError extends Error {
  constructor() {
    super("Falta BREVO_API_KEY. Configúrala en las variables de entorno.");
    this.name = "BrevoNotConfiguredError";
  }
}

function brevoApiKey() {
  return process.env.BREVO_API_KEY?.trim() || undefined;
}

export function isBrevoConfigured() {
  return Boolean(brevoApiKey());
}

export function emailSender() {
  return {
    email: process.env.EMAIL_FROM_ADDRESS ?? "info@johnhenryoficial.com",
    name: process.env.EMAIL_FROM_NAME ?? "JOHN HENRY",
  };
}

export function defaultReplyTo() {
  return process.env.EMAIL_REPLY_TO ?? process.env.EMAIL_FROM_ADDRESS ?? "info@johnhenryoficial.com";
}

/**
 * Traduce el error de Brevo a algo accionable en español.
 *
 * Devuelve el mensaje ya listo para mostrarse en el CMS: quien lo lee es el
 * administrador de la sastrería, no un desarrollador.
 */
export function describeBrevoError(status: number, payload: unknown): string {
  const body = payload as { message?: string; code?: string } | null;
  const raw = body?.message ?? `HTTP ${status}`;

  if (/unrecognised ip address|unrecognized ip address/i.test(raw)) {
    const ip = raw.match(/(\d{1,3}\.){3}\d{1,3}/)?.[0];
    return `Brevo bloqueó la conexión por restricción de IP${ip ? ` (${ip})` : ""}. Entra a Brevo → Seguridad → IPs autorizadas y desactiva la restricción, o autoriza esa IP. Mientras esté activa, ningún correo va a salir desde el servidor.`;
  }
  if (status === 401) {
    return "Brevo rechazó la llave de API. Verifica BREVO_API_KEY en las variables de entorno.";
  }
  if (body?.code === "invalid_parameter" && /sender/i.test(raw)) {
    return `Brevo no acepta el remitente configurado. Verifica que ${emailSender().email} esté validado como remitente en Brevo. Detalle: ${raw}`;
  }
  if (status === 402 || /credit/i.test(raw)) {
    return "La cuenta de Brevo se quedó sin créditos de envío.";
  }
  if (status === 429) {
    return "Brevo está limitando la cantidad de envíos (rate limit). Reintenta en unos minutos.";
  }
  return raw;
}

/** Envía un correo transaccional. No lanza: devuelve el resultado. */
export async function brevoSend(params: BrevoSendParams): Promise<BrevoSendResult> {
  const apiKey = brevoApiKey();
  if (!apiKey) {
    return { ok: false, error: new BrevoNotConfiguredError().message };
  }

  const recipients = (Array.isArray(params.to) ? params.to : [params.to])
    .map((address) => address.trim())
    .filter(Boolean)
    .map((email) => ({ email }));

  if (recipients.length === 0) {
    return { ok: false, error: "No hay destinatario." };
  }

  try {
    const response = await fetch(`${BREVO_API_BASE}/smtp/email`, {
      method: "POST",
      headers: {
        "api-key": apiKey,
        "content-type": "application/json",
        accept: "application/json",
      },
      body: JSON.stringify({
        sender: emailSender(),
        to: recipients,
        subject: params.subject,
        htmlContent: params.html,
        ...(params.text ? { textContent: params.text } : {}),
        replyTo: { email: params.replyTo ?? defaultReplyTo() },
        ...(params.tags?.length ? { tags: params.tags } : {}),
      }),
      // Un correo que tarda más de 15s no vale bloquear la Server Action:
      // el envío es un efecto secundario, no la operación que pidió el usuario.
      signal: AbortSignal.timeout(15_000),
    });

    const payload = await response.json().catch(() => null);

    if (!response.ok) {
      return { ok: false, error: describeBrevoError(response.status, payload) };
    }

    return { ok: true, messageId: (payload as { messageId?: string } | null)?.messageId };
  } catch (error) {
    const message =
      error instanceof Error && error.name === "TimeoutError"
        ? "Brevo no respondió a tiempo (15s)."
        : error instanceof Error
          ? error.message
          : "Error desconocido al contactar Brevo.";
    return { ok: false, error: message };
  }
}

export interface BrevoAccountStatus {
  configured: boolean;
  reachable: boolean;
  companyName?: string;
  email?: string;
  /** Créditos de envío restantes del plan, si Brevo los reporta. */
  emailCredits?: number;
  error?: string;
}

/** Diagnóstico de la conexión — alimenta la tarjeta de estado del módulo. */
export async function brevoAccountStatus(): Promise<BrevoAccountStatus> {
  const apiKey = brevoApiKey();
  if (!apiKey) {
    return { configured: false, reachable: false, error: new BrevoNotConfiguredError().message };
  }

  try {
    const response = await fetch(`${BREVO_API_BASE}/account`, {
      headers: { "api-key": apiKey, accept: "application/json" },
      signal: AbortSignal.timeout(10_000),
      cache: "no-store",
    });
    const payload = await response.json().catch(() => null);

    if (!response.ok) {
      return {
        configured: true,
        reachable: false,
        error: describeBrevoError(response.status, payload),
      };
    }

    const account = payload as {
      companyName?: string;
      email?: string;
      plan?: Array<{ type?: string; credits?: number; creditsType?: string }>;
    };

    const emailCredits = account.plan?.find(
      (plan) => plan.creditsType === "sendLimit" || plan.type === "free",
    )?.credits;

    return {
      configured: true,
      reachable: true,
      companyName: account.companyName,
      email: account.email,
      emailCredits,
    };
  } catch (error) {
    return {
      configured: true,
      reachable: false,
      error: error instanceof Error ? error.message : "No se pudo contactar Brevo.",
    };
  }
}
