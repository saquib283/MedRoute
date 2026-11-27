import { NextResponse, NextRequest } from 'next/server';
import { detectCountryFromHeaders, resolveCurrency } from '@/lib/currency/detector';
import { getCurrencyMeta } from '@/lib/currency/currencies';

export async function GET(request: NextRequest) {
  try {
    const country = detectCountryFromHeaders(request.headers);
    const currencyCode = resolveCurrency(country.code);
    const currency = getCurrencyMeta(currencyCode);

    return NextResponse.json({
      success: true,
      data: {
        country,
        currency,
      },
    });
  } catch (err) {
    console.error('Geo detect error:', err);
    return NextResponse.json({
      success: true,
      data: {
        country: { code: 'US', name: 'United States', flag: '🇺🇸', defaultCurrency: 'USD' },
        currency: getCurrencyMeta('USD'),
      },
    });
  }
}
