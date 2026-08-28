"use client";

import { useTransition } from "react";
import { toast } from "sonner";
import { CheckIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { ORDER_STATUS_LABELS } from "@/lib/constants";
import type { OrderStatus } from "@/types/database.types";

const PIPELINE: OrderStatus[] = ["draft", "confirmed", "in_production", "ready_for_delivery", "delivered"];

export function OrderStatusPipeline({
  currentStatus,
  onChange,
}: {
  currentStatus: OrderStatus;
  onChange: (status: OrderStatus) => Promise<void>;
}) {
  const [isPending, startTransition] = useTransition();
  const currentIndex = PIPELINE.indexOf(currentStatus);

  function handleClick(status: OrderStatus) {
    startTransition(async () => {
      await onChange(status);
      toast.success(`Estado actualizado: ${ORDER_STATUS_LABELS[status]}`);
    });
  }

  if (currentStatus === "cancelled") {
    return <p className="text-sm text-destructive">Esta orden fue cancelada.</p>;
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      {PIPELINE.map((status, index) => {
        const isDone = index < currentIndex;
        const isCurrent = index === currentIndex;
        return (
          <button
            key={status}
            type="button"
            disabled={isPending}
            onClick={() => handleClick(status)}
            className={cn(
              "flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors",
              isCurrent && "border-accent bg-accent text-accent-foreground",
              isDone && !isCurrent && "border-accent/40 bg-accent/10 text-accent",
              !isDone && !isCurrent && "border-border text-muted-foreground hover:border-accent/40",
            )}
          >
            {isDone && <CheckIcon className="size-3" />}
            {ORDER_STATUS_LABELS[status]}
          </button>
        );
      })}
    </div>
  );
}
