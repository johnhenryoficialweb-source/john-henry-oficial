import type { CurrencyCode } from "@/types/database.types";

const LOCALE_BY_CURRENCY: Record<CurrencyCode, string> = {
  COP: "es-CO",
  USD: "en-US",
};

export function formatCurrency(amount: number, currency: CurrencyCode) {
  return new Intl.NumberFormat(LOCALE_BY_CURRENCY[currency], {
    style: "currency",
    currency,
    maximumFractionDigits: currency === "COP" ? 0 : 2,
  }).format(amount);
}

/** Convierte un monto en su moneda de origen a USD usando la tasa congelada de la orden. */
export function toUsd(amount: number, currency: CurrencyCode, exchangeRateToUsd: number) {
  if (currency === "USD") return amount;
  return Math.round((amount / exchangeRateToUsd) * 100) / 100;
}
