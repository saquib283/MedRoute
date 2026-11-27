/**
 * MediRoute India — Currencies & Countries Registry
 * Master registry for supported currencies, country mapping, and fallback exchange rates.
 */

import { CurrencyMeta, CountryMeta, CurrencyCode, CountryCode } from './types';

export const BASE_CURRENCY: CurrencyCode = 'INR';

/**
 * Supported currencies with regional metadata and formatting rules
 */
export const SUPPORTED_CURRENCIES: Record<CurrencyCode, CurrencyMeta> = {
  INR: {
    code: 'INR',
    name: 'Indian Rupee',
    symbol: '₹',
    flag: '🇮🇳',
    decimals: 0,
    symbolPosition: 'prefix',
    spaceAfterSymbol: false,
  },
  USD: {
    code: 'USD',
    name: 'US Dollar',
    symbol: '$',
    flag: '🇺🇸',
    decimals: 0,
    symbolPosition: 'prefix',
    spaceAfterSymbol: false,
  },
  AED: {
    code: 'AED',
    name: 'UAE Dirham',
    symbol: 'AED',
    flag: '🇦🇪',
    decimals: 0,
    symbolPosition: 'prefix',
    spaceAfterSymbol: true,
  },
  SAR: {
    code: 'SAR',
    name: 'Saudi Riyal',
    symbol: 'SAR',
    flag: '🇸🇦',
    decimals: 0,
    symbolPosition: 'prefix',
    spaceAfterSymbol: true,
  },
  OMR: {
    code: 'OMR',
    name: 'Omani Rial',
    symbol: 'OMR',
    flag: '🇴🇲',
    decimals: 2,
    symbolPosition: 'prefix',
    spaceAfterSymbol: true,
  },
  QAR: {
    code: 'QAR',
    name: 'Qatari Riyal',
    symbol: 'QAR',
    flag: '🇶🇦',
    decimals: 0,
    symbolPosition: 'prefix',
    spaceAfterSymbol: true,
  },
  KWD: {
    code: 'KWD',
    name: 'Kuwaiti Dinar',
    symbol: 'KWD',
    flag: '🇰🇼',
    decimals: 2,
    symbolPosition: 'prefix',
    spaceAfterSymbol: true,
  },
  BHD: {
    code: 'BHD',
    name: 'Bahraini Dinar',
    symbol: 'BHD',
    flag: '🇧🇭',
    decimals: 2,
    symbolPosition: 'prefix',
    spaceAfterSymbol: true,
  },
  NGN: {
    code: 'NGN',
    name: 'Nigerian Naira',
    symbol: '₦',
    flag: '🇳🇬',
    decimals: 0,
    symbolPosition: 'prefix',
    spaceAfterSymbol: false,
  },
  KES: {
    code: 'KES',
    name: 'Kenyan Shilling',
    symbol: 'KSh',
    flag: '🇰🇪',
    decimals: 0,
    symbolPosition: 'prefix',
    spaceAfterSymbol: true,
  },
  TZS: {
    code: 'TZS',
    name: 'Tanzanian Shilling',
    symbol: 'TSh',
    flag: '🇹🇿',
    decimals: 0,
    symbolPosition: 'prefix',
    spaceAfterSymbol: true,
  },
  GHS: {
    code: 'GHS',
    name: 'Ghanaian Cedi',
    symbol: 'GH₵',
    flag: '🇬🇭',
    decimals: 0,
    symbolPosition: 'prefix',
    spaceAfterSymbol: true,
  },
  ZAR: {
    code: 'ZAR',
    name: 'South African Rand',
    symbol: 'R',
    flag: '🇿🇦',
    decimals: 0,
    symbolPosition: 'prefix',
    spaceAfterSymbol: true,
  },
  ETB: {
    code: 'ETB',
    name: 'Ethiopian Birr',
    symbol: 'Br',
    flag: '🇪🇹',
    decimals: 0,
    symbolPosition: 'prefix',
    spaceAfterSymbol: true,
  },
  BDT: {
    code: 'BDT',
    name: 'Bangladeshi Taka',
    symbol: '৳',
    flag: '🇧🇩',
    decimals: 0,
    symbolPosition: 'prefix',
    spaceAfterSymbol: false,
  },
  NPR: {
    code: 'NPR',
    name: 'Nepalese Rupee',
    symbol: 'रू',
    flag: '🇳🇵',
    decimals: 0,
    symbolPosition: 'prefix',
    spaceAfterSymbol: false,
  },
  LKR: {
    code: 'LKR',
    name: 'Sri Lankan Rupee',
    symbol: 'Rs',
    flag: '🇱🇰',
    decimals: 0,
    symbolPosition: 'prefix',
    spaceAfterSymbol: true,
  },
  MVR: {
    code: 'MVR',
    name: 'Maldivian Rufiyaa',
    symbol: 'Rf',
    flag: '🇲🇻',
    decimals: 0,
    symbolPosition: 'prefix',
    spaceAfterSymbol: true,
  },
  GBP: {
    code: 'GBP',
    name: 'British Pound',
    symbol: '£',
    flag: '🇬🇧',
    decimals: 0,
    symbolPosition: 'prefix',
    spaceAfterSymbol: false,
  },
  EUR: {
    code: 'EUR',
    name: 'Euro',
    symbol: '€',
    flag: '🇪🇺',
    decimals: 0,
    symbolPosition: 'prefix',
    spaceAfterSymbol: false,
  },
  CAD: {
    code: 'CAD',
    name: 'Canadian Dollar',
    symbol: 'CA$',
    flag: '🇨🇦',
    decimals: 0,
    symbolPosition: 'prefix',
    spaceAfterSymbol: false,
  },
  AUD: {
    code: 'AUD',
    name: 'Australian Dollar',
    symbol: 'A$',
    flag: '🇦🇺',
    decimals: 0,
    symbolPosition: 'prefix',
    spaceAfterSymbol: false,
  },
};

/**
 * Country definitions with mapped default currency and phone dial codes
 */
export const COUNTRIES: Record<CountryCode, CountryMeta> = {
  IN: { code: 'IN', name: 'India', flag: '🇮🇳', defaultCurrency: 'INR', phoneCode: '+91' },
  AE: { code: 'AE', name: 'United Arab Emirates', flag: '🇦🇪', defaultCurrency: 'AED', phoneCode: '+971' },
  SA: { code: 'SA', name: 'Saudi Arabia', flag: '🇸🇦', defaultCurrency: 'SAR', phoneCode: '+966' },
  OM: { code: 'OM', name: 'Oman', flag: '🇴🇲', defaultCurrency: 'OMR', phoneCode: '+968' },
  QA: { code: 'QA', name: 'Qatar', flag: '🇶🇦', defaultCurrency: 'QAR', phoneCode: '+974' },
  KW: { code: 'KW', name: 'Kuwait', flag: '🇰🇼', defaultCurrency: 'KWD', phoneCode: '+965' },
  BH: { code: 'BH', name: 'Bahrain', flag: '🇧🇭', defaultCurrency: 'BHD', phoneCode: '+973' },
  NG: { code: 'NG', name: 'Nigeria', flag: '🇳🇬', defaultCurrency: 'NGN', phoneCode: '+234' },
  KE: { code: 'KE', name: 'Kenya', flag: '🇰🇪', defaultCurrency: 'KES', phoneCode: '+254' },
  TZ: { code: 'TZ', name: 'Tanzania', flag: '🇹🇿', defaultCurrency: 'TZS', phoneCode: '+255' },
  GH: { code: 'GH', name: 'Ghana', flag: '🇬🇭', defaultCurrency: 'GHS', phoneCode: '+233' },
  ZA: { code: 'ZA', name: 'South Africa', flag: '🇿🇦', defaultCurrency: 'ZAR', phoneCode: '+27' },
  ET: { code: 'ET', name: 'Ethiopia', flag: '🇪🇹', defaultCurrency: 'ETB', phoneCode: '+251' },
  BD: { code: 'BD', name: 'Bangladesh', flag: '🇧🇩', defaultCurrency: 'BDT', phoneCode: '+880' },
  NP: { code: 'NP', name: 'Nepal', flag: '🇳🇵', defaultCurrency: 'NPR', phoneCode: '+977' },
  LK: { code: 'LK', name: 'Sri Lanka', flag: '🇱🇰', defaultCurrency: 'LKR', phoneCode: '+94' },
  MV: { code: 'MV', name: 'Maldives', flag: '🇲🇻', defaultCurrency: 'MVR', phoneCode: '+960' },
  US: { code: 'US', name: 'United States', flag: '🇺🇸', defaultCurrency: 'USD', phoneCode: '+1' },
  GB: { code: 'GB', name: 'United Kingdom', flag: '🇬🇧', defaultCurrency: 'GBP', phoneCode: '+44' },
  DE: { code: 'DE', name: 'Germany', flag: '🇩🇪', defaultCurrency: 'EUR', phoneCode: '+49' },
  FR: { code: 'FR', name: 'France', flag: '🇫🇷', defaultCurrency: 'EUR', phoneCode: '+33' },
  CA: { code: 'CA', name: 'Canada', flag: '🇨🇦', defaultCurrency: 'CAD', phoneCode: '+1' },
  AU: { code: 'AU', name: 'Australia', flag: '🇦🇺', defaultCurrency: 'AUD', phoneCode: '+61' },
};

/**
 * Standard baseline exchange rates against 1 INR (fallback table)
 * Rate: 1 INR = X target currency
 */
export const DEFAULT_EXCHANGE_RATES: Record<string, number> = {
  INR: 1.0,
  USD: 0.0116,       // 1 USD ~ 86.20 INR
  AED: 0.0426,       // 1 AED ~ 23.47 INR
  SAR: 0.0435,       // 1 SAR ~ 22.98 INR
  OMR: 0.00446,      // 1 OMR ~ 224.20 INR
  QAR: 0.0422,       // 1 QAR ~ 23.70 INR
  KWD: 0.00356,      // 1 KWD ~ 280.90 INR
  BHD: 0.00437,      // 1 BHD ~ 228.80 INR
  NGN: 18.55,        // 1 INR ~ 18.55 NGN (1 USD ~ 1600 NGN)
  KES: 1.51,         // 1 KES ~ 0.66 INR
  TZS: 30.50,        // 1 TZS ~ 0.033 INR
  GHS: 0.178,        // 1 GHS ~ 5.62 INR
  ZAR: 0.215,        // 1 ZAR ~ 4.65 INR
  ETB: 1.45,         // 1 ETB ~ 0.69 INR
  BDT: 1.39,         // 1 BDT ~ 0.72 INR
  NPR: 1.60,         // 1 NPR ~ 0.625 INR (pegged)
  LKR: 3.48,         // 1 LKR ~ 0.287 INR
  MVR: 0.179,        // 1 MVR ~ 5.58 INR
  GBP: 0.0091,       // 1 GBP ~ 109.90 INR
  EUR: 0.0108,       // 1 EUR ~ 92.60 INR
  CAD: 0.0162,       // 1 CAD ~ 61.70 INR
  AUD: 0.0180,       // 1 AUD ~ 55.55 INR
};

export function getCurrencyMeta(code: string): CurrencyMeta {
  const upper = code?.toUpperCase();
  return (
    SUPPORTED_CURRENCIES[upper] || {
      code: upper || 'INR',
      name: upper || 'Indian Rupee',
      symbol: upper === 'INR' ? '₹' : upper || '₹',
      flag: '🌐',
      decimals: 0,
      symbolPosition: 'prefix',
    }
  );
}

export function getCountryForNationality(nationality: string): CountryMeta | null {
  if (!nationality) return null;
  const n = nationality.trim().toLowerCase();

  const mapping: Record<string, CountryCode> = {
    nigeria: 'NG',
    nigerian: 'NG',
    uae: 'AE',
    emirates: 'AE',
    emirati: 'AE',
    dubai: 'AE',
    saudi: 'SA',
    'saudi arabia': 'SA',
    saudian: 'SA',
    oman: 'OM',
    omani: 'OM',
    qatar: 'QA',
    qatari: 'QA',
    kuwait: 'KW',
    kuwaiti: 'KW',
    bahrain: 'BH',
    bahraini: 'BH',
    kenya: 'KE',
    kenyan: 'KE',
    tanzania: 'TZ',
    tanzanian: 'TZ',
    ghana: 'GH',
    ghanaian: 'GH',
    bangladesh: 'BD',
    bangladeshi: 'BD',
    nepal: 'NP',
    nepalese: 'NP',
    nepali: 'NP',
    'sri lanka': 'LK',
    'sri lankan': 'LK',
    maldives: 'MV',
    maldivian: 'MV',
    usa: 'US',
    american: 'US',
    'united states': 'US',
    uk: 'GB',
    british: 'GB',
    'united kingdom': 'GB',
    canada: 'CA',
    canadian: 'CA',
    australia: 'AU',
    australian: 'AU',
    india: 'IN',
    indian: 'IN',
  };

  const code = mapping[n];
  if (code && COUNTRIES[code]) {
    return COUNTRIES[code];
  }
  return null;
}
