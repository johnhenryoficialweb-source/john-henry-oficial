import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

/** Invalida listados y fichas de órdenes ligadas a un cliente. */
export async function revalidateClientOrderPaths(clientId: string) {
  const supabase = await createClient();
  const { data: orders } = await supabase.from("orders").select("id").eq("client_id", clientId);

  revalidatePath("/orders");
  for (const order of orders ?? []) {
    revalidatePath(`/orders/${order.id}`);
  }
}
