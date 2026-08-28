"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { CheckCircle2Icon, Loader2Icon, SendIcon, XCircleIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  sendAllTestEmails,
  type SystemEmailCheckResult,
} from "@/app/(cms)/(protected)/correos/actions";

/**
 * Prueba de extremo a extremo de todos los correos del sistema.
 *
 * Es la acción principal del módulo porque responde la única pregunta que
 * importa antes de confiar en él: ¿esto sale de verdad? Se le dice al usuario
 * cuántos correos va a recibir antes de pulsar, no después — nueve correos
 * inesperados en la bandeja es una sorpresa desagradable, nueve anunciados son
 * una prueba.
 */
export function EmailSystemCheck({
  defaultRecipient,
  canSend,
  connected,
  templateCount,
}: {
  defaultRecipient: string;
  canSend: boolean;
  connected: boolean;
  templateCount: number;
}) {
  const [recipient, setRecipient] = useState(defaultRecipient);
  const [results, setResults] = useState<SystemEmailCheckResult[] | null>(null);
  const [isPending, startTransition] = useTransition();

  function run() {
    startTransition(async () => {
      try {
        const outcome = await sendAllTestEmails(recipient);
        setResults(outcome);

        const failed = outcome.filter((item) => !item.ok);
        if (failed.length === 0) {
          toast.success(`Los ${outcome.length} correos salieron a ${recipient}.`);
        } else {
          toast.error(`${failed.length} de ${outcome.length} correos no pudieron enviarse.`);
        }
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "No se pudo ejecutar la prueba.");
      }
    });
  }

  const okCount = results?.filter((item) => item.ok).length ?? 0;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Comprobar que todo funciona</CardTitle>
        <CardDescription>
          Envía las plantillas con datos de ejemplo a un correo tuyo y reporta cuál llegó y cuál no.
          No toca ninguna orden ni cita real.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-wrap items-end gap-3">
          <div className="min-w-[240px] flex-1 space-y-1.5">
            <Label htmlFor="check-recipient">Enviar la prueba a</Label>
            <Input
              id="check-recipient"
              type="email"
              value={recipient}
              onChange={(event) => setRecipient(event.target.value)}
              disabled={!canSend || isPending}
            />
          </div>
          <Button onClick={run} disabled={!canSend || isPending || !recipient.trim()}>
            {isPending ? (
              <Loader2Icon className="size-4 animate-spin" />
            ) : (
              <SendIcon className="size-4" />
            )}
            {isPending ? "Enviando…" : `Probar los ${templateCount} correos`}
          </Button>
        </div>

        {!canSend ? (
          <p className="text-xs text-muted-foreground">
            Solo un administrador puede lanzar la prueba, porque consume créditos de envío de la
            cuenta.
          </p>
        ) : !connected ? (
          <p className="text-xs text-destructive">
            La conexión con Brevo está caída: la prueba va a fallar hasta que se resuelva.
          </p>
        ) : (
          <p className="text-xs text-muted-foreground">
            Recibirás {templateCount} correos seguidos, uno por plantilla, marcados como prueba en
            la bitácora.
          </p>
        )}

        {results ? (
          <div className="space-y-1.5 rounded-lg border p-3">
            <p className="text-xs font-medium">
              {okCount} de {results.length} salieron correctamente
            </p>
            <ul className="space-y-1">
              {results.map((item) => (
                <li key={item.key} className="flex items-start gap-2 text-xs">
                  {item.ok ? (
                    <CheckCircle2Icon className="mt-0.5 size-3 shrink-0 text-emerald-500" />
                  ) : (
                    <XCircleIcon className="mt-0.5 size-3 shrink-0 text-destructive" />
                  )}
                  <span className={item.ok ? "" : "text-destructive"}>
                    {item.name}
                    {item.error ? <span className="block opacity-80">{item.error}</span> : null}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}
