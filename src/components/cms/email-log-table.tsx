import Link from "next/link";
import { InboxIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { EMAIL_TEMPLATES, isEmailTemplateKey } from "@/lib/email/registry";
import { exactTime } from "@/lib/email/format";
import type { EmailLogEntry } from "@/lib/email/send";

const STATUS_LABEL = {
  sent: "Enviado",
  failed: "Falló",
  skipped: "Omitido",
} as const;

/**
 * Bitácora de envíos.
 *
 * Los fallos muestran el motivo en la misma fila y no detrás de un clic:
 * cuando algo se rompe, esa línea de texto es la que dice si hay que tocar
 * Brevo, el correo del cliente o nada.
 */
export function EmailLogTable({ entries }: { entries: EmailLogEntry[] }) {
  if (entries.length === 0) {
    return (
      <div className="flex flex-col items-start gap-3 rounded-lg border border-dashed p-6">
        <InboxIcon className="size-5 text-muted-foreground" />
        <div>
          <p className="text-sm font-medium">Todavía no hay envíos registrados</p>
          <p className="max-w-prose text-xs text-muted-foreground">
            Acá va a aparecer cada correo que salga —y cada uno que falle— con su destinatario y su
            motivo. Si quieres verlo funcionando ahora mismo, lanza la prueba de arriba o abre
            cualquier plantilla y mándate una.
          </p>
        </div>
        <Link href="/correos/order_thank_you" className="text-xs underline underline-offset-4">
          Ver una plantilla
        </Link>
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-lg border">
      <table className="w-full text-sm">
        <thead className="bg-muted/40 text-xs text-muted-foreground">
          <tr>
            <th className="px-4 py-2 text-left font-medium">Plantilla</th>
            <th className="px-4 py-2 text-left font-medium">Destinatario</th>
            <th className="hidden px-4 py-2 text-left font-medium sm:table-cell">Cuándo</th>
            <th className="px-4 py-2 text-right font-medium">Estado</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border/60">
          {entries.map((entry) => {
            const name = isEmailTemplateKey(entry.templateKey)
              ? EMAIL_TEMPLATES[entry.templateKey].name
              : entry.templateKey;

            return (
              <tr key={entry.id} className="align-top">
                <td className="px-4 py-2.5">
                  <span className="flex flex-wrap items-center gap-1.5">
                    {name}
                    {entry.isTest ? (
                      <Badge variant="secondary" className="text-[10px]">
                        Prueba
                      </Badge>
                    ) : null}
                  </span>
                  {entry.error ? (
                    <span className="mt-1 block max-w-prose text-xs text-destructive">
                      {entry.error}
                    </span>
                  ) : (
                    <span className="mt-0.5 block truncate text-xs text-muted-foreground">
                      {entry.subject}
                    </span>
                  )}
                </td>
                <td className="px-4 py-2.5 text-xs text-muted-foreground">{entry.recipient}</td>
                <td className="hidden px-4 py-2.5 text-xs whitespace-nowrap text-muted-foreground sm:table-cell">
                  {exactTime(entry.createdAt)}
                </td>
                <td className="px-4 py-2.5 text-right">
                  <Badge
                    variant={
                      entry.status === "sent"
                        ? "outline"
                        : entry.status === "failed"
                          ? "destructive"
                          : "secondary"
                    }
                    className="text-[10px]"
                  >
                    {STATUS_LABEL[entry.status]}
                  </Badge>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
