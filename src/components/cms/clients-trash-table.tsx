"use client";

import Link from "next/link";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ClientRestoreButton } from "@/components/cms/client-restore-button";
import { formatPhoneDisplay } from "@/lib/phone/format";

export interface TrashedClientRow {
  id: string;
  full_name: string;
  phone: string;
  email: string | null;
  location_name: string | null;
  location_code: string | null;
  orders_count: number;
  deleted_at: string;
}

function formatDeletedAt(value: string): string {
  return new Date(value).toLocaleDateString("es-CO", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function PhoneCell({ phone, locationCode }: { phone: string; locationCode: string | null }) {
  const info = formatPhoneDisplay(phone, locationCode);
  return (
    <span className="inline-flex flex-col gap-0.5">
      <span>{info.formatted}</span>
      {info.label ? <span className="text-xs text-muted-foreground">{info.label}</span> : null}
    </span>
  );
}

export function ClientsTrashTable({ clients }: { clients: TrashedClientRow[] }) {
  return (
    <div className="rounded-lg border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Nombre</TableHead>
            <TableHead>Teléfono</TableHead>
            <TableHead>Sede</TableHead>
            <TableHead className="text-right">Pedidos</TableHead>
            <TableHead>Eliminado</TableHead>
            <TableHead className="text-right">Acciones</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {clients.length === 0 ? (
            <TableRow>
              <TableCell colSpan={6} className="py-8 text-center text-muted-foreground">
                La papelera está vacía.
              </TableCell>
            </TableRow>
          ) : (
            clients.map((client) => (
              <TableRow key={client.id}>
                <TableCell className="font-medium">
                  <Link href={`/clients/${client.id}`} className="hover:underline">
                    {client.full_name}
                  </Link>
                </TableCell>
                <TableCell>
                  <PhoneCell phone={client.phone} locationCode={client.location_code} />
                </TableCell>
                <TableCell>{client.location_name ?? "—"}</TableCell>
                <TableCell className="text-right tabular-nums">{client.orders_count}</TableCell>
                <TableCell className="text-sm text-muted-foreground">
                  {formatDeletedAt(client.deleted_at)}
                </TableCell>
                <TableCell className="text-right">
                  <ClientRestoreButton clientId={client.id} clientName={client.full_name} />
                </TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </div>
  );
}
