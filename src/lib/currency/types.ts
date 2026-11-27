/**
 * MediRoute India — Multi-Currency & Localization Types
 */

export type CurrencyCode =
  | 'INR'
  | 'USD'
  | 'AED'
  | 'SAR'
  | 'OMR'
  | 'QAR'
  | 'KWD'
  | 'BHD'
  | 'NGN'
  | 'KES'
  | 'TZS'
  | 'GHS'
  | 'ZAR'
  | 'ETB'
  | 'BDT'
  | 'NPR'
  | 'LKR'
  | 'MVR'
  | 'GBP'
  | 'EUR'
  | 'CAD'
  | 'AUD'
  | string;

export type CountryCode =
  | 'IN'
  | 'AE'
  | 'SA'
  | 'OM'
  | 'QA'
  | 'KW'
  | 'BH'
  | 'NG'
  | 'KE'
  | 'TZ'
  | 'GH'
  | 'ZA'
  | 'ET'
  | 'BD'
  | 'NP'
  | 'LK'
  | 'MV'
  | 'US'
  | 'GB'
  | 'EU'
  | 'CA'
  | 'AU'
  | string;

export interface CurrencyMeta {
  code: CurrencyCode;
  name: string;
  symbol: string;
  flag: string;
  decimals: number;
  symbolPosition: 'prefix' | 'suffix';
  spaceAfterSymbol?: boolean;
}

export interface CountryMeta {
  code: CountryCode;
  name: string;
  flag: string;
  defaultCurrency: CurrencyCode;
  phoneCode?: string;
}

export interface ExchangeRateData {
  fromCurrency: string; // Base is 'INR'
  toCurrency: string;
  rate: number; // 1 INR = X target
  inverseRate: number; // 1 target = Y INR
  source: string;
  isLocked: boolean;
  markupPercent: number;
  lastFetchedAt: string;
}

export interface ExchangeRatesMap {
  [currencyCode: string]: number; // 1 INR = rate target
}

export interface FormatCurrencyOptions {
  currency?: CurrencyCode;
  showCode?: boolean;
  showOriginalINR?: boolean;
  minimumFractionDigits?: number;
  maximumFractionDigits?: number;
  useApproximation?: boolean;
}
