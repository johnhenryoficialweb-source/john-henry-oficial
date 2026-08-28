"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeftIcon } from "lucide-react";
import { ordersListHref } from "@/lib/orders/list-view";

/**
 * "Volver a órdenes" que devuelve a la vista que el usuario tenía, con sus
 * filtros puestos.
 *
 * Los filtros recordados se leen al hacer clic, no al montar. sessionStorage no
 * existe en el servidor, así que resolverlos en un efecto obligaría a un
 * segundo render solo para cambiar un href que nadie ha usado todavía. El
 * `href` estático mantiene el enlace real —se puede abrir en pestaña nueva, el
 * navegador lo muestra al pasar por encima— y el clic normal lo redirige a la
 * vista filtrada.
 */
export function BackToOrdersLink() {
  const router = useRouter();

  return (
    <Link
      href="/orders"
      onClick={(event) => {
        const target = ordersListHref();
        if (target === "/orders") return;
        // Solo el clic simple: cmd/ctrl/click medio deben abrir pestaña nueva.
        if (event.metaKey || event.ctrlKey || event.shiftKey || event.button !== 0) return;
        event.preventDefault();
        router.push(target);
      }}
      className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground print:hidden"
    >
      <ArrowLeftIcon className="size-4" />
      Volver a órdenes
    </Link>
  );
}
