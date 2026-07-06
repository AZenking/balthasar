/**
 * Currency whitelist + helpers (research.md Q7).
 *
 * Single source of truth for supported currencies. zod schema in procedure
 * inputs references `SUPPORTED_CURRENCIES` directly, so adding a currency
 * only requires editing this file.
 *
 * MVP ships 9 common currencies. V2 may expand to full ISO 4217.
 */
export const SUPPORTED_CURRENCIES = [
  "CNY",
  "USD",
  "EUR",
  "JPY",
  "HKD",
  "GBP",
  "AUD",
  "CAD",
  "SGD",
] as const;

export type Currency = (typeof SUPPORTED_CURRENCIES)[number];

/**
 * Minor units per currency (digits after decimal point).
 * Used when displaying balance as 元 / 元分.
 *
 * Most currencies use 2; JPY uses 0.
 */
export const CURRENCY_MINOR_UNITS: Record<Currency, number> = {
  CNY: 2,
  USD: 2,
  EUR: 2,
  JPY: 0,
  HKD: 2,
  GBP: 2,
  AUD: 2,
  CAD: 2,
  SGD: 2,
};

/**
 * Type guard: narrows a string to Currency if it's in the whitelist.
 */
export function isSupportedCurrency(code: string): code is Currency {
  return (SUPPORTED_CURRENCIES as readonly string[]).includes(code);
}

/**
 * Convert integer minor units (分) to display string in major units (元).
 * e.g. 100000 with CNY (2 minor) → "1000.00"
 *      2000 with JPY (0 minor) → "2000"
 *
 * Pure function, no IO.
 */
export function formatBalance(
  minorUnits: number,
  currency: Currency
): string {
  const decimals = CURRENCY_MINOR_UNITS[currency];
  if (decimals === 0) return String(minorUnits);
  const divisor = Math.pow(10, decimals);
  const major = minorUnits / divisor;
  return major.toFixed(decimals);
}
