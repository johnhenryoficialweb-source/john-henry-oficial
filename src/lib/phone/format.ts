export type PhoneCountry = "CO" | "PA";

const COUNTRY_META: Record<PhoneCountry, { dialCode: string; label: string; flag: string }> = {
  CO: { dialCode: "+57", label: "Colombia", flag: "🇨🇴" },
  PA: { dialCode: "+507", label: "Panamá", flag: "🇵🇦" },
};

export function inferPhoneCountry(
  phone: string,
  locationCode?: string | null
): PhoneCountry {
  if (locationCode === "CO" || locationCode === "PA") return locationCode;

  const digits = phone.replace(/\D/g, "");
  if (digits.startsWith("57") && digits.length >= 11) return "CO";
  if (/^3\d{9}$/.test(digits)) return "CO";
  if (digits.startsWith("507") && digits.length >= 11) return "PA";
  if (digits.length <= 8) return "PA";

  return "PA";
}

export function formatPhoneDisplay(
  phone: string,
  locationCode?: string | null
): { country: PhoneCountry; formatted: string; dialCode: string; label: string; flag: string } {
  const country = inferPhoneCountry(phone, locationCode);
  const meta = COUNTRY_META[country];
  const digits = phone.replace(/\D/g, "");

  if (country === "CO") {
    const national = digits.startsWith("57") ? digits.slice(2) : digits;
    if (national.length === 10) {
      return {
        country,
        ...meta,
        formatted: `${meta.dialCode} ${national.slice(0, 3)} ${national.slice(3, 6)} ${national.slice(6)}`,
      };
    }
    return { country, ...meta, formatted: `${meta.dialCode} ${national}` };
  }

  const national = digits.startsWith("507") ? digits.slice(3) : digits;
  if (national.length === 8) {
    return {
      country,
      ...meta,
      formatted: `${meta.dialCode} ${national.slice(0, 4)} ${national.slice(4)}`,
    };
  }
  return { country, ...meta, formatted: `${meta.dialCode} ${national}` };
}
