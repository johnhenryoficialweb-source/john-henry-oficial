import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeftIcon } from "lucide-react";
import { requireStaffSession } from "@/lib/auth/roles";
import { getEmailOverride } from "@/lib/email/overrides";
import { getEmailActivityByTemplate } from "@/lib/email/send";
import { EMAIL_TEMPLATES, isEmailTemplateKey } from "@/lib/email/registry";
import { relativeTime } from "@/lib/email/format";
import { Badge } from "@/components/ui/badge";
import { EmailTemplateEditor } from "@/components/cms/email-template-editor";

export async function generateMetadata({ params }: { params: Promise<{ key: string }> }) {
  const { key } = await params;
  if (!isEmailTemplateKey(key)) return { title: "Plantilla no encontrada" };
  return { title: `${EMAIL_TEMPLATES[key].name} — Correos` };
}

export default async function EmailTemplatePage({
  params,
}: {
  params: Promise<{ key: string }>;
}) {
  const { key } = await params;
  if (!isEmailTemplateKey(key)) notFound();

  const session = await requireStaffSession();
  const definition = EMAIL_TEMPLATES[key];

  const [override, activity] = await Promise.all([
    getEmailOverride(key),
    getEmailActivityByTemplate(),
  ]);

  const stats = activity[key];

  return (
    <div className="max-w-6xl space-y-6">
      <Link
        href="/correos"
        className="flex w-fit items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeftIcon className="size-4" />
        Correos del sistema
      </Link>

      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="font-heading text-2xl">{definition.name}</h1>
            {definition.audience !== "client" ? (
              <Badge variant="secondary">
                {definition.audience === "staff" ? "Interno" : "Taller"}
              </Badge>
            ) : null}
            {override?.isEnabled === false ? (
              <Badge variant="destructive">Desactivado</Badge>
            ) : null}
          </div>
          <p className="max-w-prose text-sm text-muted-foreground">{definition.description}</p>
          <p className="text-xs text-muted-foreground/80">
            <span className="font-medium">Se envía:</span> {definition.trigger}
          </p>
        </div>

        <div className="text-right text-xs text-muted-foreground">
          {stats?.lastSentAt ? (
            <p>
              Último envío real {relativeTime(stats.lastSentAt)}
              <span className="block opacity-70">
                {stats.sentCount} {stats.sentCount === 1 ? "envío" : "envíos"} registrados
              </span>
            </p>
          ) : (
            <p>Sin envíos reales todavía</p>
          )}
          {stats?.lastError && stats.lastFailedAt ? (
            <p className="mt-1 max-w-[28ch] text-destructive">
              Último fallo {relativeTime(stats.lastFailedAt)}: {stats.lastError}
            </p>
          ) : null}
        </div>
      </div>

      <EmailTemplateEditor
        templateKey={key}
        override={override}
        canEdit={session.role === "admin"}
        defaultRecipient={session.email}
      />
    </div>
  );
}
