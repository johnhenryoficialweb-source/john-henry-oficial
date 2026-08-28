"use client";

import { useMemo, useState, useTransition } from "react";
import { toast } from "sonner";
import {
  EyeIcon,
  Loader2Icon,
  RotateCcwIcon,
  SaveIcon,
  SendIcon,
  SmartphoneIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { EMAIL_TEMPLATES, type EmailTemplateKey } from "@/lib/email/registry";
import {
  resetEmailTemplate,
  saveEmailTemplate,
  sendTestEmail,
  toggleEmailTemplate,
} from "@/app/(cms)/(protected)/correos/actions";

export interface EmailTemplateOverrideProps {
  subject?: string;
  heading?: string;
  intro?: string;
  outro?: string;
  ctaLabel?: string;
  isEnabled: boolean;
}

interface Draft {
  subject: string;
  heading: string;
  intro: string;
  outro: string;
  ctaLabel: string;
}

/**
 * Editor de una plantilla, con vista previa en vivo.
 *
 * La previsualización se calcula en el navegador y no en el servidor: las
 * funciones de plantilla son puras, así que importarlas acá deja ver el correo
 * cambiando mientras se escribe, sin ida y vuelta de red. Ese es todo el
 * punto: nadie corrige bien un texto que solo puede ver después de guardarlo.
 *
 * El HTML se pinta dentro de un <iframe> con `srcDoc` en vez de inyectarlo en
 * la página. Un correo trae su propio <body>, sus colores y su tipografía; sin
 * el aislamiento del iframe, sus estilos y los del CMS se pisan y la vista
 * previa deja de parecerse a lo que recibe el cliente, que es justo lo que se
 * está tratando de comprobar.
 */
export function EmailTemplateEditor({
  templateKey,
  override,
  canEdit,
  defaultRecipient,
}: {
  templateKey: EmailTemplateKey;
  override: EmailTemplateOverrideProps | null;
  canEdit: boolean;
  defaultRecipient: string;
}) {
  const definition = EMAIL_TEMPLATES[templateKey];
  const defaults = definition.defaultCopy;

  const [draft, setDraft] = useState<Draft>({
    subject: override?.subject ?? "",
    heading: override?.heading ?? "",
    intro: override?.intro ?? "",
    outro: override?.outro ?? "",
    ctaLabel: override?.ctaLabel ?? "",
  });
  const [recipient, setRecipient] = useState(defaultRecipient);
  const [narrow, setNarrow] = useState(false);
  const [isSaving, startSave] = useTransition();
  const [isSending, startSend] = useTransition();
  const [isToggling, startToggle] = useTransition();

  const isEnabled = override?.isEnabled ?? true;

  // Un campo vacío significa "usa el texto por defecto", no "déjalo en blanco".
  const preview = useMemo(
    () =>
      definition.renderSample({
        subject: draft.subject || undefined,
        heading: draft.heading || undefined,
        intro: draft.intro || undefined,
        outro: draft.outro || undefined,
        ctaLabel: draft.ctaLabel || undefined,
      }),
    [definition, draft],
  );

  const dirty =
    draft.subject !== (override?.subject ?? "") ||
    draft.heading !== (override?.heading ?? "") ||
    draft.intro !== (override?.intro ?? "") ||
    draft.outro !== (override?.outro ?? "") ||
    draft.ctaLabel !== (override?.ctaLabel ?? "");

  const hasOverride = Boolean(
    override?.subject || override?.heading || override?.intro || override?.outro || override?.ctaLabel,
  );

  function save() {
    const formData = new FormData();
    formData.set("key", templateKey);
    formData.set("subject", draft.subject);
    formData.set("heading", draft.heading);
    formData.set("intro", draft.intro);
    formData.set("outro", draft.outro);
    formData.set("ctaLabel", draft.ctaLabel);
    formData.set("isEnabled", String(isEnabled));

    startSave(async () => {
      try {
        await saveEmailTemplate(formData);
        toast.success("Textos guardados. Los próximos envíos ya salen con ellos.");
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "No se pudo guardar.");
      }
    });
  }

  function restoreDefaults() {
    startSave(async () => {
      try {
        await resetEmailTemplate(templateKey);
        setDraft({ subject: "", heading: "", intro: "", outro: "", ctaLabel: "" });
        toast.success("La plantilla volvió a sus textos originales.");
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "No se pudo restaurar.");
      }
    });
  }

  function toggle() {
    startToggle(async () => {
      try {
        await toggleEmailTemplate(templateKey, !isEnabled);
        toast.success(isEnabled ? "Correo desactivado." : "Correo activado.");
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "No se pudo cambiar el estado.");
      }
    });
  }

  function test() {
    startSend(async () => {
      try {
        await sendTestEmail(templateKey, recipient);
        toast.success(`Correo de prueba enviado a ${recipient}.`);
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "No se pudo enviar la prueba.");
      }
    });
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
      {/* -------------------------------------------------------------- */}
      {/* Columna de edición                                              */}
      {/* -------------------------------------------------------------- */}
      <div className="space-y-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Textos del correo</CardTitle>
            <CardDescription>
              Deja un campo vacío para usar el texto original. La estructura —los datos de la orden,
              los totales, el diseño de la marca— no se toca desde acá y siempre se ve bien.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Field
              id="subject"
              label="Asunto"
              value={draft.subject}
              placeholder={defaults.subject}
              disabled={!canEdit}
              onChange={(value) => setDraft((prev) => ({ ...prev, subject: value }))}
            />
            <Field
              id="heading"
              label="Saludo"
              value={draft.heading}
              placeholder={defaults.heading}
              disabled={!canEdit}
              onChange={(value) => setDraft((prev) => ({ ...prev, heading: value }))}
            />
            <Field
              id="intro"
              label="Párrafo de apertura"
              value={draft.intro}
              placeholder={defaults.intro}
              disabled={!canEdit}
              multiline
              onChange={(value) => setDraft((prev) => ({ ...prev, intro: value }))}
            />
            <Field
              id="outro"
              label="Cierre"
              value={draft.outro}
              placeholder={defaults.outro || "Sin texto de cierre"}
              disabled={!canEdit}
              multiline
              onChange={(value) => setDraft((prev) => ({ ...prev, outro: value }))}
            />
            {defaults.ctaLabel ? (
              <Field
                id="ctaLabel"
                label="Texto del botón"
                value={draft.ctaLabel}
                placeholder={defaults.ctaLabel}
                disabled={!canEdit}
                onChange={(value) => setDraft((prev) => ({ ...prev, ctaLabel: value }))}
              />
            ) : null}

            <div className="rounded-md border border-dashed p-3">
              <p className="text-xs font-medium">Variables disponibles</p>
              <p className="mb-2 text-xs text-muted-foreground">
                Escríbelas entre llaves dobles y se reemplazan con los datos reales al enviar.
              </p>
              <div className="flex flex-wrap gap-1.5">
                {definition.variables.map((variable) => (
                  <code
                    key={variable}
                    className="rounded bg-muted px-1.5 py-0.5 font-mono text-[11px]"
                  >
                    {`{{${variable}}}`}
                  </code>
                ))}
              </div>
            </div>

            {canEdit ? (
              <div className="flex flex-wrap items-center gap-2">
                <Button onClick={save} disabled={!dirty || isSaving}>
                  {isSaving ? (
                    <Loader2Icon className="size-4 animate-spin" />
                  ) : (
                    <SaveIcon className="size-4" />
                  )}
                  {dirty ? "Guardar cambios" : "Sin cambios"}
                </Button>
                {hasOverride ? (
                  <Button variant="ghost" size="sm" onClick={restoreDefaults} disabled={isSaving}>
                    <RotateCcwIcon className="size-4" />
                    Restaurar textos originales
                  </Button>
                ) : null}
              </div>
            ) : (
              <p className="text-xs text-muted-foreground">
                Solo un administrador puede editar los textos que salen con la marca.
              </p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Enviar una prueba</CardTitle>
            <CardDescription>
              Manda este correo con datos de ejemplo, exactamente como está en la vista previa.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-wrap items-end gap-3">
            <div className="min-w-[220px] flex-1 space-y-1.5">
              <Label htmlFor="test-recipient">Correo de destino</Label>
              <Input
                id="test-recipient"
                type="email"
                value={recipient}
                onChange={(event) => setRecipient(event.target.value)}
                disabled={!canEdit || isSending}
              />
            </div>
            <Button
              variant="outline"
              onClick={test}
              disabled={!canEdit || isSending || !recipient.trim()}
            >
              {isSending ? (
                <Loader2Icon className="size-4 animate-spin" />
              ) : (
                <SendIcon className="size-4" />
              )}
              Enviar prueba
            </Button>
          </CardContent>
        </Card>

        {definition.canDisable ? (
          <Card className={cn(!isEnabled && "border-destructive/50")}>
            <CardHeader>
              <CardTitle className="text-base">
                {isEnabled ? "Este correo está activo" : "Este correo está desactivado"}
              </CardTitle>
              <CardDescription>
                {isEnabled
                  ? "Al desactivarlo, el sistema dejará de enviarlo por completo. La acción que lo dispara seguirá funcionando, pero el cliente no se enterará por correo — y no queda ningún aviso pendiente que se mande después."
                  : "Ahora mismo el cliente no recibe nada cuando ocurre esta acción. Los intentos quedan registrados como omitidos en la bitácora."}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button
                variant={isEnabled ? "outline" : "default"}
                size="sm"
                onClick={toggle}
                disabled={!canEdit || isToggling}
              >
                {isToggling ? <Loader2Icon className="size-4 animate-spin" /> : null}
                {isEnabled ? "Desactivar este correo" : "Volver a activarlo"}
              </Button>
            </CardContent>
          </Card>
        ) : (
          <p className="rounded-lg border border-dashed p-3 text-xs text-muted-foreground">
            Este correo no se puede desactivar: quien reservó una cita tiene derecho a enterarse de
            lo que pase con ella.
          </p>
        )}
      </div>

      {/* -------------------------------------------------------------- */}
      {/* Columna de vista previa                                         */}
      {/* -------------------------------------------------------------- */}
      <div className="space-y-3 lg:sticky lg:top-6 lg:self-start">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-sm">
            <EyeIcon className="size-4 text-muted-foreground" />
            <span className="font-medium">Como lo recibe el cliente</span>
            {dirty ? (
              <Badge variant="secondary" className="text-[10px]">
                Sin guardar
              </Badge>
            ) : null}
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setNarrow((value) => !value)}
            title="Alternar ancho de teléfono"
          >
            <SmartphoneIcon className="size-4" />
            {narrow ? "Ancho completo" : "Ver en móvil"}
          </Button>
        </div>

        <div className="overflow-hidden rounded-lg border">
          <div className="border-b bg-muted/40 px-4 py-2.5">
            <p className="text-[11px] text-muted-foreground">Asunto</p>
            <p className="truncate text-sm font-medium">{preview.subject}</p>
          </div>
          <div className="flex justify-center bg-[#0D1F3C]">
            <iframe
              // La clave fuerza el remontaje al cambiar de ancho, para que el
              // iframe reconstruya su layout en vez de reescalar el anterior.
              key={narrow ? "narrow" : "wide"}
              title="Vista previa del correo"
              srcDoc={preview.html}
              sandbox=""
              className={cn(
                "h-[680px] border-0 bg-transparent transition-[width] duration-300",
                narrow ? "w-[390px]" : "w-full",
              )}
            />
          </div>
        </div>

        <p className="text-xs text-muted-foreground">
          Los datos son de ejemplo — un cliente, una orden y una sede ficticios. Al enviarse de
          verdad, cada valor se reemplaza por el de la orden o la cita correspondiente.
        </p>
      </div>
    </div>
  );
}

function Field({
  id,
  label,
  value,
  placeholder,
  disabled,
  multiline,
  onChange,
}: {
  id: string;
  label: string;
  value: string;
  placeholder: string;
  disabled: boolean;
  multiline?: boolean;
  onChange: (value: string) => void;
}) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between gap-2">
        <Label htmlFor={id}>{label}</Label>
        {value ? (
          <button
            type="button"
            className="text-[11px] text-muted-foreground underline underline-offset-2 hover:text-foreground disabled:opacity-50"
            onClick={() => onChange("")}
            disabled={disabled}
          >
            usar el original
          </button>
        ) : null}
      </div>
      {multiline ? (
        <Textarea
          id={id}
          rows={3}
          value={value}
          placeholder={placeholder}
          disabled={disabled}
          onChange={(event) => onChange(event.target.value)}
        />
      ) : (
        <Input
          id={id}
          value={value}
          placeholder={placeholder}
          disabled={disabled}
          onChange={(event) => onChange(event.target.value)}
        />
      )}
    </div>
  );
}
