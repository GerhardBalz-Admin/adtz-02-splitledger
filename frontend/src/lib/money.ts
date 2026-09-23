// Money is always handled as integer minor units (cents). Every supported
// currency uses two decimal places.

export const CURRENCIES = [
  { code: 'CHF', name: 'Swiss franc' },
  { code: 'EUR', name: 'Euro' },
  { code: 'USD', name: 'US dollar' },
  { code: 'GBP', name: 'British pound' },
] as const;

export type CurrencyCode = (typeof CURRENCIES)[number]['code'];

export function isCurrencyCode(value: string): value is CurrencyCode {
  return CURRENCIES.some((c) => c.code === value);
}

const AMOUNT_PATTERN = /^(\d{1,9})(?:[.,](\d{1,2}))?$/;

/** Parses user input such as "12", "12.5" or "12,50" into minor units. Returns null when invalid. */
export function parseAmount(input: string): number | null {
  const match = AMOUNT_PATTERN.exec(input.trim());
  if (!match) return null;
  const whole = Number(match[1]);
  const fraction = Number((match[2] ?? '').padEnd(2, '0'));
  return whole * 100 + fraction;
}

/** Formats minor units as "1234.50" (no currency symbol, no grouping). */
export function formatAmount(minor: number): string {
  const sign = minor < 0 ? '−' : '';
  const abs = Math.abs(minor);
  const whole = Math.floor(abs / 100);
  const cents = String(abs % 100).padStart(2, '0');
  return `${sign}${whole}.${cents}`;
}

/** Formats a balance with an explicit sign: "+81.66", "−48.33", "0.00". */
export function formatSigned(minor: number): string {
  if (minor > 0) return `+${formatAmount(minor)}`;
  return formatAmount(minor);
}

export function balanceTone(minor: number): 'pos' | 'neg' | 'zero' {
  if (minor > 0) return 'pos';
  if (minor < 0) return 'neg';
  return 'zero';
}
