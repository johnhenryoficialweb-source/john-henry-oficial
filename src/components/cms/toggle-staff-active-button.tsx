"use client";

import { useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";

export function ToggleStaffActiveButton({
  isActive,
  onToggle,
}: {
  isActive: boolean;
  onToggle: (nextActive: boolean) => Promise<void>;
}) {
  const [isPending, startTransition] = useTransition();

  return (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      disabled={isPending}
      onClick={() =>
        startTransition(async () => {
          await onToggle(!isActive);
          toast.success(isActive ? "Usuario desactivado" : "Usuario activado");
        })
      }
    >
      {isActive ? "Desactivar" : "Activar"}
    </Button>
  );
}
