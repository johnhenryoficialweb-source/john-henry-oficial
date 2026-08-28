"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2Icon, RepeatIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { generateFixedExpenses } from "@/app/(cms)/(protected)/finance/actions";

/**
 * Regla UX #10 (Contrast Effect): antes de crear nada, el botón dice cuántos
 * movimientos va a registrar y por cuánto. Regla UX #12: confirma el resultado
 * exacto en vez de dejar al usuario adivinando si pasó algo.
 */
export function GenerateFixedExpensesButton({
  count,
  summary,
  variant = "default",
}: {
  count: number;
  summary: string;
  variant?: "default" | "secondary" | "outline";
}) {
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  function handleClick() {
    startTransition(async () => {
      try {
        const { created } = await generateFixedExpenses();
        if (created === 0) {
          toast.info("Las salidas fijas de este mes ya estaban registradas.");
        } else {
          toast.success(
            `${created} ${created === 1 ? "salida fija registrada" : "salidas fijas registradas"} · ${summary}`,
          );
        }
        router.refresh();
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "No se pudieron generar las salidas.");
      }
    });
  }

  return (
    <Button type="button" size="sm" variant={variant} onClick={handleClick} disabled={isPending || count === 0}>
      {isPending ? <Loader2Icon className="animate-spin" /> : <RepeatIcon />}
      Registrar {count} {count === 1 ? "salida fija" : "salidas fijas"}
    </Button>
  );
}
