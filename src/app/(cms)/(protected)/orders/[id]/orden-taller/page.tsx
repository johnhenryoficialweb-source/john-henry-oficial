import { notFound } from "next/navigation";
import { requireStaffSession } from "@/lib/auth/roles";
import { getWorkshopOrder } from "@/lib/orders/workshop-order";
import { WorkshopOrderSheet } from "@/components/cms/workshop-order-sheet";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const order = await getWorkshopOrder(id);
  return { title: order ? `Orden de trabajo ${order.orderNumber}` : "Orden de trabajo" };
}

/**
 * Hoja de taller imprimible.
 *
 * Vive dentro del CMS —el sidebar y la cabecera ya se ocultan al imprimir— pero
 * la hoja se sale del padding del layout para que en pantalla se vea como el
 * papel que va a ser: una hoja completa, no una tarjeta dentro del panel.
 */
export default async function WorkshopOrderPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireStaffSession();

  const { id } = await params;
  const order = await getWorkshopOrder(id);
  if (!order) notFound();

  return <WorkshopOrderSheet order={order} />;
}
