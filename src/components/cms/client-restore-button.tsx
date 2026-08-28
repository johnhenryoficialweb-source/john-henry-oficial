"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2Icon, RotateCcwIcon } from "lucide-react";
import { restoreClient } from "@/app/(cms)/(protected)/clients/actions";
import { Button } from "@/components/ui/button";

export function ClientRestoreButton({
  clientId,
  clientName,
}: {
  clientId: string;
  clientName: string;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  function handleRestore() {
    startTransition(async () => {
      try {
        const name = await restoreClient(clientId);
        toast.success(`${name} restaurado`);
        router.refresh();
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "No se pudo restaurar el cliente");
      }
    });
  }

  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      onClick={handleRestore}
      disabled={isPending}
      aria-label={`Restaurar ${clientName}`}
    >
      {isPending ? (
        <Loader2Icon className="size-4 animate-spin" />
      ) : (
        <RotateCcwIcon className="size-4" />
      )}
      Restaurar
    </Button>
  );
}
