import { getPublicLocations } from "@/lib/locations/public";
import { AppointmentWizard } from "@/components/public/appointment-wizard";
import type { LocationCode } from "@/config/locations";

export default async function CitasPage() {
  const locations = await getPublicLocations();

  return (
    <section className="mx-auto max-w-2xl px-6 py-24">
      <div className="mb-12 text-center">
        <p className="font-heading text-sm tracking-[0.3em] text-accent uppercase">Cita</p>
        <h1 className="mt-4 font-heading text-4xl italic">Reserva su cita</h1>
        <p className="mx-auto mt-4 max-w-md text-foreground/60">
          Cuatro pasos: tipo de cita, fecha y hora, sus datos, y confirmación.
        </p>
      </div>

      <AppointmentWizard locations={locations.map((l) => ({ code: l.code as LocationCode, name: l.name }))} />
    </section>
  );
}
