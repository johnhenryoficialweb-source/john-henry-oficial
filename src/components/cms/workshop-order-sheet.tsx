"use client";

import Link from "next/link";
import { ArrowLeftIcon, PrinterIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { WorkshopGarment, WorkshopOrder } from "@/lib/orders/workshop-labels";

/**
 * Orden de trabajo imprimible.
 *
 * Es la misma hoja que sale por correo, pero en papel: fondo claro, tinta
 * oscura, filetes en oro apagado. Nada de navy a página completa — el sastre
 * la imprime, la marca con lápiz y la deja sobre la mesa de corte, y un fondo
 * saturado la vuelve ilegible en cuanto la impresora escatima tóner.
 *
 * Los colores van en hex literal y no en tokens del tema: el CMS tiene modo
 * oscuro y esta hoja NO debe seguirlo. Un documento que cambia de color según
 * la preferencia de quien lo abre no es un documento, es una pantalla.
 *
 * Lo que NO aparece es tan deliberado como lo que aparece: ni teléfono, ni
 * cédula, ni correo del cliente, ni precios. Ver la nota en
 * src/lib/orders/workshop-order.ts.
 */
export function WorkshopOrderSheet({ order }: { order: WorkshopOrder }) {
  return (
    <div className="-m-6 min-h-screen bg-[#F4F1EA] text-[#1C1B18] print:m-0 print:min-h-0 print:bg-white">
      {/* Barra de acciones — no se imprime. */}
      <div className="sticky top-0 z-10 border-b border-[#DDD7C9] bg-[#F4F1EA]/90 backdrop-blur print:hidden">
        <div className="mx-auto flex max-w-[8.5in] items-center justify-between gap-4 px-6 py-3">
          <Link
            href={`/orders/${order.orderId}`}
            className="flex items-center gap-1.5 text-sm text-[#5A564C] hover:text-[#1C1B18]"
          >
            <ArrowLeftIcon className="size-4" />
            Volver a la orden
          </Link>
          <div className="flex items-center gap-3">
            <span className="hidden text-xs text-[#8A857A] sm:inline">
              Sin datos de contacto del cliente ni valores
            </span>
            <Button
              size="sm"
              onClick={() => window.print()}
              className="bg-[#8A6D2F] text-white hover:bg-[#6F5726]"
            >
              <PrinterIcon className="size-4" />
              Imprimir
            </Button>
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-[8.5in] px-6 py-8 print:max-w-none print:px-0 print:py-0">
        <header className="flex items-end justify-between gap-6 border-b-2 border-[#8A6D2F] pb-4">
          <div>
            <p className="font-display text-[15px] tracking-[0.3em] text-[#1C1B18] uppercase">
              John Henry
            </p>
            <p className="mt-1.5 text-[9px] tracking-[0.26em] text-[#8A6D2F] uppercase">
              Sastrería · Est. 2004
            </p>
          </div>
          <div className="text-right">
            <p className="text-[10px] tracking-[0.2em] text-[#8A857A] uppercase">Orden de trabajo</p>
            <p className="mt-1 font-heading text-xl text-[#1C1B18]">{order.orderNumber}</p>
          </div>
        </header>

        <dl className="grid grid-cols-3 gap-x-6 gap-y-4 border-b border-[#DDD7C9] py-4">
          <Meta label="Cliente" value={order.clientName} />
          <Meta label="Sede" value={order.locationName} />
          <Meta label="Fecha" value={order.createdAtLabel} />
          {order.fittingDateLabel ? (
            <Meta label="Fecha de prueba" value={order.fittingDateLabel} />
          ) : null}
          {order.expectedDeliveryLabel ? (
            <Meta label="Fecha de entrega" value={order.expectedDeliveryLabel} />
          ) : null}
          <Meta label="Estado" value={order.statusLabel} />
        </dl>

        <div className="space-y-6 pt-6">
          {order.garments.map((garment) => (
            <GarmentCard key={garment.id} garment={garment} />
          ))}
        </div>

        {order.notes ? (
          <div className="mt-6 break-inside-avoid">
            <p className="mb-2 text-[11px] tracking-[0.18em] text-[#8A6D2F] uppercase">
              Notas de la orden
            </p>
            <p className="border border-dashed border-[#DDD7C9] p-3 text-sm leading-relaxed whitespace-pre-line">
              {order.notes}
            </p>
          </div>
        ) : null}

        <footer className="mt-8 border-t border-[#DDD7C9] pt-4 text-[11px] text-[#8A857A]">
          JOHN HENRY · {order.locationName}
          {order.locationPhone ? ` · ${order.locationPhone}` : ""}
        </footer>
      </div>
    </div>
  );
}

function Meta({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-[10px] tracking-[0.14em] text-[#8A857A] uppercase">{label}</dt>
      <dd className="text-sm text-[#1C1B18]">{value}</dd>
    </div>
  );
}

function GarmentCard({ garment }: { garment: WorkshopGarment }) {
  const fabricLine = [garment.fabricName, garment.fabricCode ? `Cód. ${garment.fabricCode}` : null]
    .filter(Boolean)
    .join(" · ");
  const fabricDetail = [garment.fabricComposition, garment.fabricSupplier]
    .filter(Boolean)
    .join(" · ");

  return (
    <article className="workshop-garment border border-[#DDD7C9] bg-white">
      <div className="border-b-2 border-[#8A6D2F] px-5 py-4">
        <p className="text-[10px] tracking-[0.2em] text-[#8A857A] uppercase">Prenda</p>
        <h2 className="font-heading text-xl tracking-[0.06em] text-[#1C1B18] uppercase">
          {garment.label}
          {garment.quantity > 1 ? (
            <span className="ml-2 text-base text-[#8A6D2F]">×{garment.quantity}</span>
          ) : null}
        </h2>
      </div>

      {fabricLine || garment.modelName ? (
        <dl className="space-y-1 border-b border-[#DDD7C9] px-5 py-3.5">
          {fabricLine ? (
            <div className="flex gap-4">
              <dt className="w-20 shrink-0 pt-0.5 text-[11px] tracking-[0.08em] text-[#8A857A] uppercase">
                Tela
              </dt>
              <dd className="text-sm">
                {fabricLine}
                {fabricDetail ? (
                  <span className="block text-xs text-[#5A564C]">{fabricDetail}</span>
                ) : null}
              </dd>
            </div>
          ) : null}
          {garment.modelName ? (
            <div className="flex gap-4">
              <dt className="w-20 shrink-0 pt-0.5 text-[11px] tracking-[0.08em] text-[#8A857A] uppercase">
                Modelo
              </dt>
              <dd className="text-sm">{garment.modelName}</dd>
            </div>
          ) : null}
        </dl>
      ) : null}

      <div className="px-5 pt-4 pb-2">
        <p className="text-[11px] tracking-[0.18em] text-[#8A6D2F] uppercase">
          Medidas ({garment.measurementUnit})
        </p>
      </div>

      <div className="px-5 pb-4">
        {garment.measurements.length > 0 ? (
          <div className="grid grid-cols-3 border-t border-l border-[#DDD7C9]">
            {garment.measurements.map((measurement) => (
              <div
                key={measurement.label}
                className="border-r border-b border-[#DDD7C9] px-2.5 py-2"
              >
                <span className="block text-[10px] tracking-[0.08em] text-[#8A857A] uppercase">
                  {measurement.label}
                </span>
                <span className="block text-base text-[#1C1B18] tabular-nums">
                  {measurement.value}
                </span>
              </div>
            ))}
            {/* Celdas vacías para cerrar la última fila de la rejilla. */}
            {Array.from({ length: (3 - (garment.measurements.length % 3)) % 3 }).map((_, index) => (
              <div key={`fill-${index}`} className="border-r border-b border-[#DDD7C9]" />
            ))}
          </div>
        ) : (
          <p className="text-sm text-[#8A857A] italic">Sin medidas registradas para esta prenda.</p>
        )}
      </div>

      {garment.spec ? (
        <div className="px-5 pb-5">
          <p className="mb-1.5 text-[11px] tracking-[0.18em] text-[#8A6D2F] uppercase">Pedido</p>
          {/* Mismo recuadro que en el correo: el documento habla en campos con
              caja, como la ficha en papel. */}
          <p className="border border-[#DDD7C9] bg-[#F4F1EA] px-3.5 py-3 text-sm leading-relaxed whitespace-pre-line">
            {garment.spec}
          </p>
        </div>
      ) : null}

      {/* Espacio para que el sastre anote a mano. En la ficha en papel esa
          franja siempre existió, y sin ella la nota termina en el margen. */}
      <div className="hidden border-t border-dashed border-[#DDD7C9] px-5 py-6 print:block">
        <p className="text-[10px] tracking-[0.14em] text-[#8A857A] uppercase">Observaciones del taller</p>
      </div>
    </article>
  );
}
