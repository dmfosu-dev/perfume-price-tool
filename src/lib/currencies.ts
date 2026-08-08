// Currencies offered in the FX settings picker. Deliberately a curated list
// rather than all ~161 codes the providers support: only the selected ones are
// ever fetched or stored, which keeps both the payload and the table small.
// Add a code here if the business starts trading in it.

export type CurrencyInfo = {
  code: string;
  name: string;
  symbol: string;
  flag: string;
};

export const SUPPORTED_CURRENCIES: CurrencyInfo[] = [
  { code: "SAR", name: "Saudi Riyal", symbol: "SAR ", flag: "🇸🇦" },
  { code: "USD", name: "US Dollar", symbol: "$", flag: "🇺🇸" },
  { code: "GHS", name: "Ghanaian Cedi", symbol: "GH₵", flag: "🇬🇭" },
  { code: "AED", name: "UAE Dirham", symbol: "AED ", flag: "🇦🇪" },
  { code: "EUR", name: "Euro", symbol: "€", flag: "🇪🇺" },
  { code: "GBP", name: "British Pound", symbol: "£", flag: "🇬🇧" },
  { code: "NGN", name: "Nigerian Naira", symbol: "₦", flag: "🇳🇬" },
  { code: "XOF", name: "West African CFA Franc", symbol: "CFA ", flag: "🌍" },
  { code: "ZAR", name: "South African Rand", symbol: "R", flag: "🇿🇦" },
  { code: "KES", name: "Kenyan Shilling", symbol: "KSh", flag: "🇰🇪" },
  { code: "EGP", name: "Egyptian Pound", symbol: "E£", flag: "🇪🇬" },
  { code: "MAD", name: "Moroccan Dirham", symbol: "MAD ", flag: "🇲🇦" },
  { code: "QAR", name: "Qatari Riyal", symbol: "QR ", flag: "🇶🇦" },
  { code: "KWD", name: "Kuwaiti Dinar", symbol: "KD ", flag: "🇰🇼" },
  { code: "BHD", name: "Bahraini Dinar", symbol: "BD ", flag: "🇧🇭" },
  { code: "OMR", name: "Omani Rial", symbol: "OMR ", flag: "🇴🇲" },
  { code: "JOD", name: "Jordanian Dinar", symbol: "JD ", flag: "🇯🇴" },
  { code: "TRY", name: "Turkish Lira", symbol: "₺", flag: "🇹🇷" },
  { code: "INR", name: "Indian Rupee", symbol: "₹", flag: "🇮🇳" },
  { code: "PKR", name: "Pakistani Rupee", symbol: "₨", flag: "🇵🇰" },
  { code: "CNY", name: "Chinese Yuan", symbol: "¥", flag: "🇨🇳" },
  { code: "JPY", name: "Japanese Yen", symbol: "¥", flag: "🇯🇵" },
  { code: "CHF", name: "Swiss Franc", symbol: "CHF ", flag: "🇨🇭" },
  { code: "CAD", name: "Canadian Dollar", symbol: "C$", flag: "🇨🇦" },
  { code: "AUD", name: "Australian Dollar", symbol: "A$", flag: "🇦🇺" },
];

const BY_CODE = new Map(SUPPORTED_CURRENCIES.map((entry) => [entry.code, entry]));

export function isSupportedCurrency(code: unknown): code is string {
  return typeof code === "string" && BY_CODE.has(code);
}

export function currencyInfo(code: string): CurrencyInfo {
  return BY_CODE.get(code) ?? { code, name: code, symbol: `${code} `, flag: "🏳️" };
}

/// Zero-decimal currencies would look wrong with cents.
export function decimalsFor(code: string): number {
  return code === "JPY" ? 0 : 2;
}

export function formatMoney(code: string, amount: number): string {
  return `${currencyInfo(code).symbol}${amount.toFixed(decimalsFor(code))}`;
}

/// Prices are entered in whichever currency the shop quotes. These are only the
/// starting points — both are admin-configurable.
export const DEFAULT_PRICE_CURRENCY = "SAR";
export const DEFAULT_BASE_CURRENCY = "USD";
export const DEFAULT_SELECTED_CURRENCIES = ["SAR", "USD", "GHS", "AED"];

/**
 * Ordering rule from the brief: selected currencies come first, and the base
 * currency is always first of all. Everything else follows alphabetically.
 */
export function orderCurrencies(
  base: string,
  selected: readonly string[],
): CurrencyInfo[] {
  const selectedSet = new Set(selected);
  const rank = (code: string): number => {
    if (code === base) return 0;
    if (selectedSet.has(code)) return 1;
    return 2;
  };

  return [...SUPPORTED_CURRENCIES].sort((a, b) => {
    const byRank = rank(a.code) - rank(b.code);
    return byRank !== 0 ? byRank : a.code.localeCompare(b.code);
  });
}

/**
 * Converts between any two tracked currencies using rates quoted from a common
 * base: 1 base = rates[c] of c, so amount_to = amount * rates[to] / rates[from].
 * Returns null when either leg is missing, rather than guessing.
 */
export function convertAmount(
  amount: number,
  from: string,
  to: string,
  rates: Readonly<Record<string, number>>,
): number | null {
  if (!Number.isFinite(amount)) return null;
  if (from === to) return amount;

  const fromRate = rates[from];
  const toRate = rates[to];
  if (!fromRate || !toRate || fromRate <= 0 || toRate <= 0) return null;

  return (amount * toRate) / fromRate;
}
