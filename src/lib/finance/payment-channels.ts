import "server-only";
import { createClient } from "@/lib/supabase/server";
import type { PaymentChannelOption } from "./labels";

interface ChannelRow {
  id: string;
  code: string | null;
  name: string;
  method: PaymentChannelOption["method"];
  fee_percent: number;
  fee_fixed: number;
  location_id: string | null;
  notes: string | null;
  is_active: boolean;
  sort_order: number;
}

function mapChannel(row: ChannelRow): PaymentChannelOption {
  return {
    id: row.id,
    code: row.code,
    name: row.name,
    method: row.method,
    feePercent: Number(row.fee_percent) || 0,
    feeFixed: Number(row.fee_fixed) || 0,
    locationId: row.location_id,
    notes: row.notes,
    isActive: row.is_active,
    sortOrder: row.sort_order,
  };
}

/**
 * Medios de cobro disponibles.
 *
 * `locationId` filtra los canales propios de una sede (un datáfono existe en
 * una sede, no en las dos) sin esconder los compartidos, que son la mayoría.
 */
export async function getPaymentChannels(options?: {
  includeInactive?: boolean;
  locationId?: string | null;
}): Promise<PaymentChannelOption[]> {
  const supabase = await createClient();

  let query = supabase
    .from("payment_channels")
    .select("id, code, name, method, fee_percent, fee_fixed, location_id, notes, is_active, sort_order")
    .order("sort_order")
    .order("name");

  if (!options?.includeInactive) query = query.eq("is_active", true);

  const { data } = await query;
  const channels = (data ?? []).map((row) => mapChannel(row as ChannelRow));

  if (!options?.locationId) return channels;
  return channels.filter(
    (channel) => channel.locationId === null || channel.locationId === options.locationId
  );
}
