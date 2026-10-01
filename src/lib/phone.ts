export const DEFAULT_COUNTRY_CODE = process.env.NEXT_PUBLIC_DEFAULT_COUNTRY_CODE || "91";

/**
 * Normalise to E.164 digits without "+" (the format wa.me expects).
 *  "+91 98765 43210" → "919876543210"
 *  "09876543210" / "9876543210" → "919876543210" (default country code)
 */
export function normalizePhone(
  input: string,
  defaultCC = DEFAULT_COUNTRY_CODE,
): { ok: true; value: string } | { ok: false; reason: string } {
  const raw = input.trim();
  if (!raw) return { ok: false, reason: "Enter a WhatsApp number" };
  if (/[^\d+\s\-().]/.test(raw)) return { ok: false, reason: "Phone numbers can only contain digits, spaces, + and -" };
  const hasPlus = raw.startsWith("+") || raw.startsWith("00");
  let digits = raw.replace(/\D/g, "");
  if (raw.startsWith("00")) digits = digits.slice(2);
  if (!hasPlus) {
    digits = digits.replace(/^0+/, "");
    if (defaultCC === "91" && digits.length === 10) digits = defaultCC + digits;
    else if (digits.length <= 10) digits = defaultCC + digits;
  }
  if (digits.length < 8 || digits.length > 15) {
    return { ok: false, reason: "Enter a valid number with country code, e.g. +91 98765 43210" };
  }
  if (digits.startsWith("91") && digits.length === 12 && !/^91[6-9]/.test(digits)) {
    return { ok: false, reason: "Indian mobile numbers start with 6, 7, 8 or 9" };
  }
  return { ok: true, value: digits };
}

export function formatPhone(digits: string) {
  if (digits.startsWith("91") && digits.length === 12) return `+91 ${digits.slice(2, 7)} ${digits.slice(7)}`;
  return `+${digits}`;
}

/** "+91 ••••• •3210" — avoid showing full numbers unless the teacher asks. */
export function maskPhone(digits: string) {
  if (digits.startsWith("91") && digits.length === 12) return `+91 ••••• •${digits.slice(-4)}`;
  return `+${digits.slice(0, Math.max(1, digits.length - 10))} •••• ${digits.slice(-4)}`;
}
