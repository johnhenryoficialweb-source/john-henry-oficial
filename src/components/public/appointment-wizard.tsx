"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import {
  CheckIcon,
  ChevronLeftIcon,
  ClockIcon,
  CrownIcon,
  HandshakeIcon,
  Loader2Icon,
  RulerIcon,
  ScissorsIcon,
  ShirtIcon,
} from "lucide-react";
import {
  SERVICE_TYPES,
  SERVICE_TYPE_LABELS,
  SERVICE_TYPE_DURATION_MINUTES,
  type ServiceType,
} from "@/lib/constants";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { AppointmentCalendar } from "@/components/public/appointment-calendar";
import { TurnstileWidget } from "@/components/public/turnstile-widget";
import { cn } from "@/lib/utils";
import type { LocationCode } from "@/config/locations";

const SERVICE_ICONS: Record<ServiceType, typeof ShirtIcon> = {
  primera_consulta: HandshakeIcon,
  saco: ShirtIcon,
  tuxido: CrownIcon,
  camisa: RulerIcon,
  ajuste: ScissorsIcon,
};

const SERVICE_BLURBS: Record<ServiceType, string> = {
  primera_consulta: "Conversemos sobre su visión — showroom",
  saco: "Confección completa a la medida",
  tuxido: "Etiqueta y ocasiones formales",
  camisa: "Corte y tela a su preferencia",
  ajuste: "Retoques sobre una prenda existente",
};

type Step = 1 | 2 | 3 | 4;
const STEP_LABELS: Record<Step, string> = {
  1: "Tipo",
  2: "Fecha y hora",
  3: "Tus datos",
  4: "Confirmar",
};

function formatSlotTime(iso: string) {
  return new Date(iso).toLocaleTimeString("es-CO", { hour: "numeric", minute: "2-digit" });
}

export function AppointmentWizard({ locations }: { locations: { code: LocationCode; name: string }[] }) {
  const [step, setStep] = useState<Step>(1);
  const [succeeded, setSucceeded] = useState(false);

  const [locationCode, setLocationCode] = useState<LocationCode>(locations[0]?.code ?? "CO");
  const [serviceType, setServiceType] = useState<ServiceType | null>(null);

  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [slots, setSlots] = useState<string[]>([]);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [selectedSlot, setSelectedSlot] = useState<string | null>(null);

  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [notes, setNotes] = useState("");
  const [turnstileToken, setTurnstileToken] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!selectedDate) return;
    let cancelled = false;
    // Sincroniza el estado de carga con el fetch de disponibilidad que arranca
    // justo debajo; no es un anti-patrón de derivar estado desde props.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLoadingSlots(true);
    setSelectedSlot(null);
    fetch(`/api/availability?location=${locationCode}&date=${selectedDate}`)
      .then((res) => res.json())
      .then((data) => {
        if (!cancelled) setSlots(data.slots ?? []);
      })
      .finally(() => {
        if (!cancelled) setLoadingSlots(false);
      });
    return () => {
      cancelled = true;
    };
  }, [locationCode, selectedDate]);

  async function handleConfirm() {
    if (!serviceType || !selectedSlot) return;
    setSubmitting(true);
    const res = await fetch("/api/appointments", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        fullName,
        phone,
        email: email || undefined,
        notes: notes || undefined,
        locationCode,
        serviceType,
        startsAt: selectedSlot,
        turnstileToken: turnstileToken ?? undefined,
      }),
    });
    setSubmitting(false);

    if (res.ok) {
      setSucceeded(true);
    } else {
      const body = await res.json().catch(() => ({}));
      toast.error(body.error ?? "No se pudo reservar la cita.");
    }
  }

  if (succeeded) {
    return (
      <div className="mx-auto max-w-md space-y-4 py-12 text-center">
        <p className="text-3xl text-accent">✦</p>
        <h2 className="font-heading text-2xl italic">Cita confirmada</h2>
        <p className="text-foreground/60">
          {fullName.split(" ")[0]}, su cita de {serviceType && SERVICE_TYPE_LABELS[serviceType].toLowerCase()} quedó
          reservada{selectedSlot ? ` para el ${new Date(selectedSlot).toLocaleString("es-CO", { dateStyle: "long", timeStyle: "short" })}` : ""}.
        </p>
        <p className="text-sm text-foreground/40">Le enviamos los detalles por correo.</p>
        <Button className="mt-4" render={<Link href="/" />}>
          Volver al inicio
        </Button>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-lg space-y-8">
      <WizardProgress step={step} />

      {locations.length > 1 && (
        <div className="flex items-center justify-center gap-2 text-sm text-foreground/60">
          <span>Sede:</span>
          <Select
            value={locationCode}
            onValueChange={(v) => v && setLocationCode(v as LocationCode)}
            items={locations.map((loc) => ({ value: loc.code, label: loc.name }))}
          >
            <SelectTrigger className="h-8 w-auto border-[var(--jh-gold-mid)]/30 bg-transparent font-display text-base text-[var(--jh-ivory)] hover:border-[var(--jh-gold-mid)]/60">
              <SelectValue />
            </SelectTrigger>
            {/*
             * `font-display` explícito: el popup se portalea a <body>, fuera
             * del contenedor del sitio público, así que hereda la sans del CMS
             * y no la tipografía de marca. El portal se salta la cascada.
             */}
            <SelectContent className="font-display text-base">
              {locations.map((loc) => (
                <SelectItem key={loc.code} value={loc.code}>
                  {loc.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      {step === 1 && (
        <div className="space-y-6">
          <h2 className="text-center font-heading text-xl italic">¿Qué tipo de cita necesita?</h2>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {SERVICE_TYPES.map((type) => {
              const Icon = SERVICE_ICONS[type];
              const active = serviceType === type;
              return (
                <button
                  key={type}
                  type="button"
                  onClick={() => setServiceType(type)}
                  className={cn(
                    "flex flex-col items-start gap-2 rounded-lg border p-5 text-left transition-colors",
                    active ? "border-accent bg-accent/10" : "border-[var(--jh-gold-mid)]/20 hover:border-accent/40"
                  )}
                >
                  <Icon className={cn("size-6", active ? "text-accent" : "text-foreground/50")} />
                  <span className="font-heading text-base">{SERVICE_TYPE_LABELS[type]}</span>
                  <span className="text-xs text-foreground/50">
                    {SERVICE_BLURBS[type]} · {SERVICE_TYPE_DURATION_MINUTES[type]} min
                  </span>
                </button>
              );
            })}
          </div>
          <div className="flex justify-end">
            <Button disabled={!serviceType} onClick={() => setStep(2)}>
              Continuar
            </Button>
          </div>
        </div>
      )}

      {step === 2 && (
        <div className="space-y-6">
          <h2 className="text-center font-heading text-xl italic">Elija fecha y hora</h2>
          <div className="rounded-lg border border-[var(--jh-gold-mid)]/20 p-4">
            <AppointmentCalendar
              locationCode={locationCode}
              selectedDate={selectedDate}
              onSelectDate={setSelectedDate}
            />
          </div>

          <div>
            <Label className="mb-3 block text-foreground/70">Horarios disponibles</Label>
            {!selectedDate ? (
              <p className="text-sm text-foreground/40">Selecciona un día para ver los horarios disponibles.</p>
            ) : loadingSlots ? (
              <p className="flex items-center gap-2 text-sm text-foreground/50">
                <Loader2Icon className="size-4 animate-spin" />
                Buscando disponibilidad…
              </p>
            ) : slots.length === 0 ? (
              <p className="flex items-center gap-2 text-sm text-foreground/50">
                <ClockIcon className="size-4" />
                Sin horarios disponibles ese día.
              </p>
            ) : (
              <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
                {slots.map((slot) => (
                  <button
                    key={slot}
                    type="button"
                    onClick={() => setSelectedSlot(slot)}
                    className={cn(
                      "rounded-md border px-2 py-2 text-sm transition-colors",
                      selectedSlot === slot
                        ? "border-accent bg-accent text-accent-foreground"
                        : "border-[var(--jh-gold-mid)]/30 hover:border-accent/50"
                    )}
                  >
                    {formatSlotTime(slot)}
                  </button>
                ))}
              </div>
            )}
          </div>

          <WizardNav onBack={() => setStep(1)} onNext={() => setStep(3)} nextDisabled={!selectedSlot} />
        </div>
      )}

      {step === 3 && (
        <div className="space-y-6">
          <h2 className="text-center font-heading text-xl italic">Sus datos</h2>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="fullName">Nombre completo *</Label>
              <Input id="fullName" required value={fullName} onChange={(e) => setFullName(e.target.value)} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="phone">WhatsApp / Teléfono *</Label>
                <Input id="phone" required value={phone} onChange={(e) => setPhone(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="email">Correo</Label>
                <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="notes">Notas adicionales</Label>
              <Textarea
                id="notes"
                rows={3}
                placeholder="Cuéntenos más sobre lo que busca…"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
              />
            </div>
          </div>
          <WizardNav
            onBack={() => setStep(2)}
            onNext={() => setStep(4)}
            nextDisabled={fullName.trim().length < 2 || phone.trim().length < 7}
          />
        </div>
      )}

      {step === 4 && serviceType && (
        <div className="space-y-6">
          <h2 className="text-center font-heading text-xl italic">Confirme su cita</h2>
          <div className="space-y-3 rounded-lg border border-[var(--jh-gold-mid)]/20 p-5 text-sm">
            <SummaryRow label="Tipo" value={SERVICE_TYPE_LABELS[serviceType]} />
            <SummaryRow label="Sede" value={locations.find((l) => l.code === locationCode)?.name ?? locationCode} />
            <SummaryRow
              label="Fecha y hora"
              value={selectedSlot ? new Date(selectedSlot).toLocaleString("es-CO", { dateStyle: "long", timeStyle: "short" }) : "—"}
            />
            <SummaryRow label="Nombre" value={fullName} />
            <SummaryRow label="Contacto" value={`${phone}${email ? ` · ${email}` : ""}`} />
          </div>

          <TurnstileWidget onVerify={setTurnstileToken} />

          <WizardNav
            onBack={() => setStep(3)}
            onNext={handleConfirm}
            nextLabel={submitting ? "Confirmando…" : "Confirmar cita"}
            nextDisabled={submitting}
            loading={submitting}
          />
        </div>
      )}
    </div>
  );
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-4">
      <span className="text-foreground/50">{label}</span>
      <span className="text-right font-medium">{value}</span>
    </div>
  );
}

function WizardNav({
  onBack,
  onNext,
  nextDisabled,
  nextLabel = "Continuar",
  loading = false,
}: {
  onBack: () => void;
  onNext: () => void;
  nextDisabled?: boolean;
  nextLabel?: string;
  loading?: boolean;
}) {
  return (
    <div className="flex items-center justify-between">
      <Button type="button" variant="outline" onClick={onBack}>
        <ChevronLeftIcon />
        Atrás
      </Button>
      <Button type="button" onClick={onNext} disabled={nextDisabled}>
        {loading && <Loader2Icon className="animate-spin" />}
        {nextLabel}
      </Button>
    </div>
  );
}

function WizardProgress({ step }: { step: Step }) {
  const steps: Step[] = [1, 2, 3, 4];
  return (
    <div className="flex items-center justify-center" role="list">
      {steps.map((s, i) => (
        <div key={s} className="flex items-center">
          <div className="flex flex-col items-center gap-1.5" role="listitem">
            <span
              className={cn(
                "flex size-7 items-center justify-center rounded-full border text-xs transition-colors",
                s < step
                  ? "border-accent bg-accent text-accent-foreground"
                  : s === step
                    ? "border-accent text-accent"
                    : "border-[var(--jh-gold-mid)]/30 text-foreground/40"
              )}
            >
              {s < step ? <CheckIcon className="size-3.5" /> : s}
            </span>
            <span className={cn("text-[10px] uppercase tracking-wide", s <= step ? "text-foreground/70" : "text-foreground/30")}>
              {STEP_LABELS[s]}
            </span>
          </div>
          {i < steps.length - 1 && (
            <div className={cn("mx-2 h-px w-8 sm:w-12", s < step ? "bg-accent" : "bg-[var(--jh-gold-mid)]/25")} />
          )}
        </div>
      ))}
    </div>
  );
}
