"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { AlertTriangleIcon, CheckIcon, Loader2Icon } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  findClientByDocument,
  type DocumentOwner,
} from "@/app/(cms)/(protected)/clients/actions";

/**
 * Campo de cédula con aviso en vivo de duplicado.
 *
 * La cédula no puede repetirse, y hay dos formas de decirlo. Una es dejar
 * llenar el formulario entero y rechazarlo al guardar; la otra es avisar en el
 * momento en que se escribe el documento, que es cuando la persona todavía
 * puede reaccionar — casi siempre porque el cliente ya existía y lo que hay que
 * hacer es abrir su ficha, no crear otra.
 *
 * El aviso enlaza al cliente que ya tiene ese documento: sin el enlace, el
 * mensaje informa pero no resuelve, y el usuario tiene que salirse a buscarlo a
 * mano.
 *
 * Esto NO es la validación. Es un anticipo de la que corre en el servidor
 * (`assertDocumentIsFree`) y de la restricción de la base (índice único, 0037),
 * porque RLS puede esconder un duplicado de la otra sede que este campo nunca
 * llega a ver.
 */
export function DocumentIdField({
  value,
  onChange,
  onConflictChange,
  excludeClientId,
  label = "Cédula o documento",
  id = "documentId",
  name = "documentId",
  hint,
}: {
  value: string;
  onChange: (value: string) => void;
  /** Avisa al formulario para que bloquee el submit mientras haya choque. */
  onConflictChange?: (owner: DocumentOwner | null) => void;
  /** Al editar, la propia ficha no cuenta como duplicado de sí misma. */
  excludeClientId?: string;
  label?: string;
  id?: string;
  name?: string;
  hint?: string;
}) {
  const [owner, setOwner] = useState<DocumentOwner | null>(null);
  const [isChecking, setIsChecking] = useState(false);
  const requestId = useRef(0);

  const trimmed = value.trim();

  /*
   * Al escribir se levanta el bloqueo de inmediato y la consulta lo vuelve a
   * poner si el choque sigue. Limpiar aquí y no en el efecto evita encadenar
   * renders, y sobre todo evita el estado mentiroso: mientras se corrige un
   * documento repetido, el aviso viejo no puede seguir bloqueando el guardado.
   */
  function handleChange(next: string) {
    onChange(next);
    if (owner) {
      setOwner(null);
      onConflictChange?.(null);
    }
    if (!next.trim()) {
      requestId.current += 1;
      setIsChecking(false);
    }
  }

  useEffect(() => {
    if (!trimmed) return;

    // El id de petición descarta respuestas viejas: al escribir rápido, una
    // consulta lenta de "10203" no puede pisar el resultado de "1020304".
    const current = ++requestId.current;

    const timer = setTimeout(async () => {
      setIsChecking(true);
      try {
        const found = await findClientByDocument(trimmed, excludeClientId);
        if (current !== requestId.current) return;
        setOwner(found);
        onConflictChange?.(found);
      } catch {
        if (current !== requestId.current) return;
        // Si la consulta falla, no se afirma que esté libre: el servidor decide.
        setOwner(null);
        onConflictChange?.(null);
      } finally {
        if (current === requestId.current) setIsChecking(false);
      }
    }, 400);

    return () => clearTimeout(timer);
    // onConflictChange se omite a propósito: los llamadores pasan una función
    // nueva en cada render y volvería a disparar la consulta sin razón.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [trimmed, excludeClientId]);

  const activeOwner = trimmed ? owner : null;
  const isFree = Boolean(trimmed) && !isChecking && !activeOwner;

  return (
    <div className="space-y-2">
      <Label htmlFor={id}>{label}</Label>
      <Input
        id={id}
        name={name}
        value={value}
        onChange={(event) => handleChange(event.target.value)}
        autoComplete="off"
        inputMode="text"
        placeholder="Opcional — cédula, pasaporte o documento"
        aria-invalid={activeOwner ? true : undefined}
        aria-describedby={activeOwner ? `${id}-conflict` : undefined}
        className={activeOwner ? "border-destructive focus-visible:ring-destructive/30" : undefined}
      />

      {activeOwner ? (
        <p
          id={`${id}-conflict`}
          role="alert"
          className="flex items-start gap-1.5 text-xs text-destructive"
        >
          <AlertTriangleIcon className="mt-px size-3.5 shrink-0" />
          <span>
            Esta cédula ya es de{" "}
            <Link
              href={`/clients/${activeOwner.id}`}
              className="font-medium underline underline-offset-2"
            >
              {activeOwner.fullName}
            </Link>
            . Si es la misma persona, trabaja sobre esa ficha en vez de crear otra.
          </span>
        </p>
      ) : isChecking ? (
        <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <Loader2Icon className="size-3 animate-spin" />
          Verificando que no esté repetida…
        </p>
      ) : isFree ? (
        <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <CheckIcon className="size-3" />
          Documento disponible.
        </p>
      ) : hint ? (
        <p className="text-xs text-muted-foreground">{hint}</p>
      ) : null}
    </div>
  );
}
