/**
 * MediRoute India — Country & Currency Detection Engine
 * Multi-tier resolution: User choice (Cookie/Storage) -> Logged-in Patient Nationality -> GeoIP / Headers -> Timezone heuristic -> Default.
 */

import { COUNTRIES, SUPPORTED_CURRENCIES, getCountryForNationality } from './currencies';
import { CountryMeta, CurrencyCode } from './types';

/**
 * Timezone-to-Country mapping heuristic for browser client detection
 */
const TIMEZONE_COUNTRY_MAP: Record<string, string> = {
  'Africa/Lagos': 'NG',
  'Africa/Nairobi': 'KE',
  'Africa/Dar_es_Salaam': 'TZ',
  'Africa/Accra': 'GH',
  'Africa/Johannesburg': 'ZA',
  'Africa/Addis_Ababa': 'ET',
  'Asia/Dubai': 'AE',
  'Asia/Riyadh': 'SA',
  'Asia/Muscat': 'OM',
  'Asia/Qatar': 'QA',
  'Asia/Kuwait': 'KW',
  'Asia/Bahrain': 'BH',
  'Asia/Dhaka': 'BD',
  'Asia/Kathmandu': 'NP',
  'Asia/Colombo': 'LK',
  'Indian/Maldives': 'MV',
  'Europe/London': 'GB',
  'Europe/Berlin': 'DE',
  'Europe/Paris': 'FR',
  'America/New_York': 'US',
  'America/Chicago': 'US',
  'America/Los_Angeles': 'US',
  'America/Toronto': 'CA',
  'Australia/Sydney': 'AU',
  'Asia/Kolkata': 'IN',
  'Asia/Calcutta': 'IN',
};

/**
 * Detect user's country from request headers (Server-side)
 */
export function detectCountryFromHeaders(headers: Headers): CountryMeta {
  // Check standard GeoIP proxy headers
  const countryHeader =
    headers.get('cf-ipcountry') ||
    headers.get('x-vercel-ip-country') ||
    headers.get('x-country-code') ||
    headers.get('x-geo-country');

  if (countryHeader) {
    const code = countryHeader.toUpperCase();
    if (COUNTRIES[code]) {
      return COUNTRIES[code];
    }
  }

  // Fallback to default
  return COUNTRIES['US'] || COUNTRIES['IN'];
}

/**
 * Client-side detection heuristic using Intl.DateTimeFormat timezone
 */
export function detectClientCountry(): CountryMeta {
  if (typeof window === 'undefined') {
    return COUNTRIES['US'] || COUNTRIES['IN'];
  }

  try {
    const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    if (timeZone && TIMEZONE_COUNTRY_MAP[timeZone]) {
      const code = TIMEZONE_COUNTRY_MAP[timeZone];
      if (COUNTRIES[code]) return COUNTRIES[code];
    }

    // Check timezone prefix
    if (timeZone?.startsWith('Asia/Dubai') || timeZone?.includes('Emirates')) return COUNTRIES['AE'];
    if (timeZone?.startsWith('Africa/Lagos') || timeZone?.includes('Nigeria')) return COUNTRIES['NG'];
    if (timeZone?.startsWith('Asia/Riyadh') || timeZone?.includes('Saudi')) return COUNTRIES['SA'];
    if (timeZone?.startsWith('Asia/Dhaka')) return COUNTRIES['BD'];
    if (timeZone?.startsWith('Europe/London')) return COUNTRIES['GB'];
    if (timeZone?.startsWith('America/')) return COUNTRIES['US'];
  } catch (e) {
    console.warn('Failed to detect client timezone:', e);
  }

  return COUNTRIES['US'] || COUNTRIES['IN'];
}

/**
 * Resolve preferred currency from country code or nationality
 */
export function resolveCurrency(countryCodeOrNationality?: string): CurrencyCode {
  if (!countryCodeOrNationality) return 'USD';

  const upper = countryCodeOrNationality.toUpperCase();
  if (COUNTRIES[upper]) {
    return COUNTRIES[upper].defaultCurrency;
  }

  const fromNat = getCountryForNationality(countryCodeOrNationality);
  if (fromNat) return fromNat.defaultCurrency;

  if (SUPPORTED_CURRENCIES[upper]) {
    return upper;
  }

  return 'USD';
}
