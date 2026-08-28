"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2Icon } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  toggleExpenseCategory,
  toggleRecurringExpense,
} from "@/app/(cms)/(protected)/finance/actions";

/**
 * Nada se borra acá: un tipo de salida o una salida fija se desactiva, para no
 * romper el histórico que ya la referencia (regla UX #9).
 */
export function ToggleActiveButton({
  entity,
  id,
  isActive,
  label,
}: {
  entity: "category" | "recurring";
  id: string;
  isActive: boolean;
  label: string;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  function handleClick() {
    startTransition(async () => {
      try {
        const toggle = entity === "category" ? toggleExpenseCategory : toggleRecurringExpense;
        await toggle(id, !isActive);
        toast.success(isActive ? `«${label}» desactivado` : `«${label}» reactivado`);
        router.refresh();
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "No se pudo actualizar.");
      }
    });
  }

  return (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      onClick={handleClick}
      disabled={isPending}
      className="text-muted-foreground"
    >
      {isPending && <Loader2Icon className="animate-spin" />}
      {isActive ? "Desactivar" : "Reactivar"}
    </Button>
  );
}
