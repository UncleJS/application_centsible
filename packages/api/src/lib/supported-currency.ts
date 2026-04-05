import { SUPPORTED_CURRENCIES } from "@centsible/shared";

const supportedCurrencySet = new Set<string>(SUPPORTED_CURRENCIES);

export function isSupportedCurrency(code: string): boolean {
  return supportedCurrencySet.has(code);
}

export function supportedCurrencyError(fieldName = "currency"): string {
  return `${fieldName} must be one of the supported ISO currency codes`;
}
