import Link from "next/link";
import { ArrowLeftIcon } from "lucide-react";
import { requireStaffSession } from "@/lib/auth/roles";
import { getAssignableLocations, getExpenseCategories } from "@/lib/finance/expenses";
import { getExchangeRate } from "@/lib/finance/config";
import { ExpenseForm } from "@/components/finance/expense-form";

export default async function NewExpensePage() {
  const session = await requireStaffSession();
  const [categories, locations, exchangeRate] = await Promise.all([
    getExpenseCategories(),
    getAssignableLocations(),
    getExchangeRate(),
  ]);

  // Regla UX #1: la sede del usuario viene puesta; el admin sin sede arranca
  // en la primera para no dejar el campo vacío.
  const defaultLocationId =
    locations.find((location) => location.id === session.locationId)?.id ?? locations[0]?.id ?? "";

  return (
    <div className="space-y-6">
      <Link
        href="/finance/salidas"
        className="flex w-fit items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeftIcon className="size-4" />
        Volver a salidas
      </Link>

      <div>
        <h1 className="font-heading text-2xl">Registrar salida de dinero</h1>
        <p className="text-sm text-muted-foreground">
          Queda asociada a la sede y descuenta del resultado del periodo.
        </p>
      </div>

      <ExpenseForm
        categories={categories}
        locations={locations}
        defaultLocationId={defaultLocationId}
        exchangeRate={exchangeRate}
      />
    </div>
  );
}
