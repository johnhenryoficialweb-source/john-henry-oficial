import "server-only";
import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import type { RoyaltyBase } from "./labels";

export type { RoyaltyBase };

export interface RoyaltyConfig {
  percent: number;
  /** Código de la sede que paga la regalía (por defecto Colombia). */
  sourceLocationCode: string;
  /** Código de la casa matriz que la recibe (por defecto Panamá). */
  beneficiaryLocationCode: string;
  base: RoyaltyBase;
}

/**
 * Acuerdo de regalía entre sedes. **Única fuente de verdad, y a propósito en
 * código.**
 *
 * No vive en `settings` ni se edita desde el CMS: es un pacto societario entre
 * Bogotá y la casa matriz de Panamá, no una preferencia de la aplicación.
 * Cambiarlo debe exigir un commit revisado y un despliegue — el mismo rastro
 * que exigiría modificar el contrato — y no un campo que cualquier
 * administrador con sesión pueda tocar y dejar sin historial.
 *
 * Para cambiarlo: editar estos valores, commit y desplegar. Los periodos ya
 * liquidados no se ven afectados — cada fila de `royalty_settlements` congela
 * el porcentaje con el que se giró.
 */
export const ROYALTY_AGREEMENT: RoyaltyConfig = {
  percent: 12,
  /** Sede que gira la regalía. */
  sourceLocationCode: "CO",
  /** Casa matriz que la recibe. */
  beneficiaryLocationCode: "PA",
  /** 'sales' = sobre lo facturado · 'collected' = sobre lo efectivamente cobrado. */
  base: "sales",
};

export function getRoyaltyConfig(): RoyaltyConfig {
  return ROYALTY_AGREEMENT;
}

/** Tasa vigente USD → COP, la misma que congela cada orden y cada salida. */
export const getExchangeRate = cache(async (): Promise<number> => {
  const supabase = await createClient();
  const { data } = await supabase
    .from("settings")
    .select("value")
    .eq("key", "exchange_rate_usd_cop")
    .maybeSingle();

  const rate = Number((data?.value as { rate?: number } | null)?.rate);
  return Number.isFinite(rate) && rate > 0 ? rate : 4000;
});
