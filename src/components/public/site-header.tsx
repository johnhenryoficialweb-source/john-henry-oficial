"use client";

import { useState } from "react";
import Link from "next/link";
import { Logotipo } from "@/components/brand/logo";
import { cn } from "@/lib/utils";

/**
 * Navegación. Cinzel, mayúsculas, tracking amplio, siempre subordinada al
 * nombre. El único destacado es la conversación privada — y ni siquiera es un
 * botón sólido: es una invitación, no un llamado.
 *
 * El hecho a medida no aparece en la navegación a propósito. Se menciona
 * dentro del home, nunca se anuncia.
 */
const NAV_LINKS = [
  { href: "/el-oficio", label: "El Oficio" },
  { href: "/ready-to-wear", label: "Ready-to-Wear" },
  { href: "/sedes/bogota", label: "Bogotá" },
  { href: "/sedes/panama", label: "Panamá" },
];

const linkClass =
  "font-institutional text-[10px] uppercase tracking-[0.32em] text-[var(--jh-ivory)]/65 transition-colors duration-500 hover:text-[var(--jh-gold)]";

export function SiteHeader() {
  const [open, setOpen] = useState(false);

  return (
    <header className="sticky top-0 z-40 border-b border-[var(--jh-gold-mid)]/15 bg-[var(--jh-navy)]/92 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-6 lg:px-10">
        <Link href="/" aria-label="JOHN HENRY — inicio">
          <Logotipo size="sm" />
        </Link>

        <nav className="hidden items-center gap-10 lg:flex">
          {NAV_LINKS.map((link) => (
            <Link key={link.href} href={link.href} className={linkClass}>
              {link.label}
            </Link>
          ))}
        </nav>

        <Link
          href="/citas"
          className="hidden font-institutional text-[10px] tracking-[0.32em] text-[var(--jh-gold)] uppercase transition-colors duration-500 hover:text-[var(--jh-ivory)] lg:block"
        >
          Conversación privada
        </Link>

        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          aria-label={open ? "Cerrar menú" : "Abrir menú"}
          className="flex h-6 w-7 flex-col justify-center gap-[5px] lg:hidden"
        >
          {/* Dos líneas, no un icono de librería. Coherente con el trazo del logo. */}
          <span
            aria-hidden
            className={cn(
              "h-px w-full bg-[var(--jh-gold)] transition-transform duration-500",
              open && "translate-y-[3px] rotate-45",
            )}
          />
          <span
            aria-hidden
            className={cn(
              "h-px w-full bg-[var(--jh-gold)] transition-transform duration-500",
              open && "-translate-y-[3px] -rotate-45",
            )}
          />
        </button>
      </div>

      {open && (
        <nav className="flex flex-col gap-5 border-t border-[var(--jh-gold-mid)]/15 px-6 py-8 lg:hidden">
          {NAV_LINKS.map((link) => (
            <Link key={link.href} href={link.href} onClick={() => setOpen(false)} className={linkClass}>
              {link.label}
            </Link>
          ))}
          <Link
            href="/citas"
            onClick={() => setOpen(false)}
            className="font-institutional text-[10px] tracking-[0.32em] text-[var(--jh-gold)] uppercase"
          >
            Conversación privada
          </Link>
        </nav>
      )}
    </header>
  );
}
