import Link from "next/link";
import {
  AlertTriangleIcon,
  ArrowRightIcon,
  CheckCircle2Icon,
  MailIcon,
  MailXIcon,
  PencilIcon,
} from "lucide-react";
import { requireStaffSession } from "@/lib/auth/roles";
import { brevoAccountStatus } from "@/lib/email/brevo";
import { getAllEmailOverrides } from "@/lib/email/overrides";
import { getEmailActivityByTemplate, getEmailLog } from "@/lib/email/send";
import { EMAIL_TEMPLATE_GROUPS, EMAIL_TEMPLATES } from "@/lib/email/registry";
import { relativeTime } from "@/lib/email/format";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { EmailSystemCheck } from "@/components/cms/email-system-check";
import { EmailLogTable } from "@/components/cms/email-log-table";
import { cn } from "@/lib/utils";

export const metadata = { title: "Correos del sistema" };

/**
 * Módulo de correos.
 *
 * La pantalla responde, en este orden, las tres preguntas de quien entra:
 * ¿está conectado?, ¿qué correos manda el sistema y funcionan?, ¿qué salió
 * últimamente? Por eso el diagnóstico va primero y el catálogo después — antes
 * de saber si una plantilla está bien redactada hay que saber si el canal de
 * salida existe.
 */
export default async function EmailsPage() {
  const session = await requireStaffSession();

  const [status, overrides, activity, log] = await Promise.all([
    brevoAccountStatus(),
    getAllEmailOverrides(),
    getEmailActivityByTemplate(),
    getEmailLog(25),
  ]);

  const totalTemplates = Object.keys(EMAIL_TEMPLATES).length;
  const disabled = Object.values(overrides).filter((o) => o?.isEnabled === false).length;
  const edited = Object.values(overrides).filter(
    (o) => o && (o.subject || o.heading || o.intro || o.outro || o.ctaLabel),
  ).length;
  const failing = Object.entries(activity).filter(
    ([, value]) => value && value.failedCount > 0 && !value.lastSentAt,
  ).length;

  return (
    <div className="max-w-5xl space-y-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="font-heading text-2xl">Correos del sistema</h1>
          <p className="max-w-prose text-sm text-muted-foreground">
            Todo lo que la sastrería le escribe a un cliente sale de acá. Puedes ver cada plantilla
            como la recibe él, ajustar los textos y comprobar que estén saliendo.
          </p>
        </div>
        <Badge variant="outline" className="font-normal">
          {totalTemplates} plantillas
        </Badge>
      </div>

      <ConnectionCard status={status} />

      {/* Acción principal de la pantalla: comprobar que todo el sistema envía. */}
      <EmailSystemCheck
        defaultRecipient={session.email}
        canSend={session.role === "admin"}
        connected={status.reachable}
        templateCount={totalTemplates}
      />

      <section className="space-y-3">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="font-heading text-lg">Plantillas</h2>
          <p className="text-xs text-muted-foreground">
            {edited > 0 ? `${edited} con textos personalizados` : "Todas con los textos por defecto"}
            {disabled > 0 ? ` · ${disabled} desactivadas` : ""}
            {failing > 0 ? ` · ${failing} con fallos` : ""}
          </p>
        </div>

        {EMAIL_TEMPLATE_GROUPS.map((group) => (
          <div key={group.label} className="space-y-2">
            <div className="pt-3">
              <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
                {group.label}
              </p>
              <p className="text-xs text-muted-foreground/80">{group.description}</p>
            </div>

            <div className="divide-y divide-border/60 rounded-lg border">
              {group.keys.map((key) => {
                const definition = EMAIL_TEMPLATES[key];
                const override = overrides[key];
                const stats = activity[key];
                const isDisabled = override?.isEnabled === false;
                const isEdited = Boolean(
                  override &&
                    (override.subject ||
                      override.heading ||
                      override.intro ||
                      override.outro ||
                      override.ctaLabel),
                );

                return (
                  <Link
                    key={key}
                    href={`/correos/${key}`}
                    className="group flex items-center justify-between gap-4 p-4 transition-colors hover:bg-accent/40"
                  >
                    <div className="min-w-0 space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-sm font-medium">{definition.name}</span>
                        {definition.audience !== "client" ? (
                          <Badge variant="secondary" className="text-[10px]">
                            {definition.audience === "staff" ? "Interno" : "Taller"}
                          </Badge>
                        ) : null}
                        {isDisabled ? (
                          <Badge variant="destructive" className="text-[10px]">
                            Desactivado
                          </Badge>
                        ) : null}
                        {isEdited ? (
                          <Badge variant="outline" className="gap-1 text-[10px]">
                            <PencilIcon className="size-2.5" />
                            Editado
                          </Badge>
                        ) : null}
                      </div>
                      <p className="max-w-prose truncate text-xs text-muted-foreground">
                        {definition.description}
                      </p>
                      <p className="text-[11px] text-muted-foreground/70">{definition.trigger}</p>
                    </div>

                    <div className="flex shrink-0 items-center gap-3">
                      <TemplateActivity stats={stats} />
                      <ArrowRightIcon className="size-4 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
                    </div>
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
      </section>

      <Link
        href="/correos/destinatarios"
        className="flex items-center justify-between gap-4 rounded-lg border p-4 text-sm hover:border-accent"
      >
        <span>
          Destinatarios de la orden de trabajo
          <span className="block text-xs text-muted-foreground">
            Quién recibe el documento del taller: el sastre, el vendedor y el proveedor de tela.
          </span>
        </span>
        <ArrowRightIcon className="size-4 shrink-0" />
      </Link>

      <section className="space-y-3">
        <div>
          <h2 className="font-heading text-lg">Últimos envíos</h2>
          <p className="text-xs text-muted-foreground">
            Cada correo que el sistema intentó mandar, haya salido o no.
          </p>
        </div>
        <EmailLogTable entries={log} />
      </section>
    </div>
  );
}

function TemplateActivity({
  stats,
}: {
  stats?: { lastSentAt: string | null; lastFailedAt: string | null; failedCount: number } | null;
}) {
  if (!stats || (!stats.lastSentAt && !stats.lastFailedAt)) {
    return <span className="hidden text-[11px] text-muted-foreground/60 sm:inline">Sin envíos</span>;
  }

  if (stats.lastFailedAt && !stats.lastSentAt) {
    return (
      <span className="hidden items-center gap-1.5 text-[11px] text-destructive sm:inline-flex">
        <AlertTriangleIcon className="size-3" />
        Falló {relativeTime(stats.lastFailedAt)}
      </span>
    );
  }

  return (
    <span className="hidden items-center gap-1.5 text-[11px] text-muted-foreground sm:inline-flex">
      <CheckCircle2Icon className="size-3 text-emerald-500" />
      Último {relativeTime(stats.lastSentAt)}
    </span>
  );
}

/**
 * Estado de la conexión con Brevo.
 *
 * Cuando algo está mal, la tarjeta dice qué hacer, no solo qué pasó: el error
 * más probable de esta cuenta —la restricción de IP— se arregla en el panel de
 * Brevo, no en el código, y quien lee esto necesita saber eso, no un HTTP 401.
 */
function ConnectionCard({
  status,
}: {
  status: Awaited<ReturnType<typeof brevoAccountStatus>>;
}) {
  const ok = status.reachable;

  return (
    <Card className={cn(!ok && "border-destructive/50")}>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          {ok ? (
            <MailIcon className="size-4 text-emerald-500" />
          ) : (
            <MailXIcon className="size-4 text-destructive" />
          )}
          {ok ? "Conectado a Brevo" : "Sin conexión con Brevo"}
        </CardTitle>
        <CardDescription>
          {ok
            ? "El proveedor de correo responde. Los envíos del sistema están saliendo por esta cuenta."
            : "Mientras esto no se resuelva, ningún correo del sistema va a llegarle a un cliente."}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
        {ok ? (
          <dl className="grid gap-x-8 gap-y-2 sm:grid-cols-2">
            {status.companyName ? (
              <div>
                <dt className="text-xs text-muted-foreground">Cuenta</dt>
                <dd>{status.companyName}</dd>
              </div>
            ) : null}
            {status.email ? (
              <div>
                <dt className="text-xs text-muted-foreground">Correo de la cuenta</dt>
                <dd className="truncate">{status.email}</dd>
              </div>
            ) : null}
            <div>
              <dt className="text-xs text-muted-foreground">Remitente</dt>
              <dd className="truncate">
                {process.env.EMAIL_FROM_NAME ?? "JOHN HENRY"} &lt;
                {process.env.EMAIL_FROM_ADDRESS ?? "info@johnhenryoficial.com"}&gt;
              </dd>
            </div>
            {typeof status.emailCredits === "number" ? (
              <div>
                <dt className="text-xs text-muted-foreground">Créditos de envío</dt>
                <dd className="tabular-nums">{status.emailCredits.toLocaleString("es-CO")}</dd>
              </div>
            ) : null}
          </dl>
        ) : (
          <div className="rounded-md border border-destructive/40 bg-destructive/5 p-3">
            <p className="text-sm">{status.error}</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
