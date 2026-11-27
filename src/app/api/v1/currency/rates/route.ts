import { NextResponse, NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { DEFAULT_EXCHANGE_RATES, SUPPORTED_CURRENCIES, COUNTRIES, BASE_CURRENCY } from '@/lib/currency/currencies';
import { detectCountryFromHeaders } from '@/lib/currency/detector';

export async function GET(request: NextRequest) {
  try {
    // 1. Fetch exchange rates from database
    let ratesFromDb = await prisma.exchangeRate.findMany();

    // If no rates in DB, auto-populate from default baseline table
    if (ratesFromDb.length === 0) {
      const records = Object.entries(DEFAULT_EXCHANGE_RATES).map(([currency, rate]) => ({
        fromCurrency: BASE_CURRENCY,
        toCurrency: currency,
        rate,
        inverseRate: rate > 0 ? 1 / rate : 0,
        source: 'SYSTEM_DEFAULT',
        isLocked: false,
        markupPercent: 0,
      }));

      await prisma.exchangeRate.createMany({
        data: records,
        skipDuplicates: true,
      });

      ratesFromDb = await prisma.exchangeRate.findMany();
    }

    // 2. Fetch global markup setting if configured
    const markupConfig = await prisma.systemConfig.findUnique({
      where: { key: 'forexMarkupPercent' },
    });
    const globalMarkup = markupConfig?.value ? parseFloat(markupConfig.value) : 0;

    // 3. Build rates map: 1 INR = (rate * (1 - markup)) target currency
    const ratesMap: Record<string, number> = {};
    for (const record of ratesFromDb) {
      const rateNum = Number(record.rate);
      const markup = Number(record.markupPercent) || globalMarkup || 0;
      // If markup is applied, reduce the target rate slightly (forex buffer)
      const adjustedRate = markup > 0 ? rateNum * (1 - markup / 100) : rateNum;
      ratesMap[record.toCurrency] = adjustedRate;
    }

    // Ensure baseline is 1.0
    ratesMap['INR'] = 1.0;

    // 4. Detect visitor country from request headers
    const detectedCountry = detectCountryFromHeaders(request.headers);

    return NextResponse.json({
      success: true,
      data: {
        baseCurrency: BASE_CURRENCY,
        rates: ratesMap,
        ratesDetail: ratesFromDb.map(r => ({
          toCurrency: r.toCurrency,
          rate: Number(r.rate),
          inverseRate: Number(r.inverseRate),
          source: r.source,
          isLocked: r.isLocked,
          markupPercent: Number(r.markupPercent),
          lastFetchedAt: r.lastFetchedAt,
        })),
        supportedCurrencies: SUPPORTED_CURRENCIES,
        countries: COUNTRIES,
        detectedCountry,
        globalMarkupPercent: globalMarkup,
      },
    });
  } catch (err) {
    console.error('Failed to fetch exchange rates:', err);
    // Fallback to static in-memory table
    return NextResponse.json({
      success: true,
      data: {
        baseCurrency: BASE_CURRENCY,
        rates: DEFAULT_EXCHANGE_RATES,
        supportedCurrencies: SUPPORTED_CURRENCIES,
        countries: COUNTRIES,
        detectedCountry: COUNTRIES['US'],
        globalMarkupPercent: 0,
      },
    });
  }
}

export async function POST(request: NextRequest) {
  try {
    const userRole = request.headers.get('x-user-role');
    const userId = request.headers.get('x-user-id');

    if (!userId || userRole !== 'ADMIN') {
      return NextResponse.json({ error: 'Unauthorized. Admin access required.' }, { status: 403 });
    }

    const body = await request.json();
    const { action, currencyCode, manualRate, markupPercent, isLocked } = body;

    // Action: Update individual currency rate / lock / markup
    if (action === 'UPDATE_CURRENCY') {
      if (!currencyCode) {
        return NextResponse.json({ error: 'currencyCode is required' }, { status: 400 });
      }

      const updateData: Record<string, unknown> = {};
      if (manualRate !== undefined) {
        const rate = parseFloat(manualRate);
        updateData.rate = rate;
        updateData.inverseRate = rate > 0 ? 1 / rate : 0;
        updateData.source = 'MANUAL_OVERRIDE';
        updateData.lastFetchedAt = new Date();
      }
      if (markupPercent !== undefined) {
        updateData.markupPercent = parseFloat(markupPercent);
      }
      if (isLocked !== undefined) {
        updateData.isLocked = Boolean(isLocked);
      }

      const updated = await prisma.exchangeRate.upsert({
        where: { toCurrency: currencyCode.toUpperCase() },
        update: updateData,
        create: {
          fromCurrency: BASE_CURRENCY,
          toCurrency: currencyCode.toUpperCase(),
          rate: manualRate ? parseFloat(manualRate) : DEFAULT_EXCHANGE_RATES[currencyCode.toUpperCase()] || 1,
          inverseRate: manualRate ? 1 / parseFloat(manualRate) : 1,
          source: 'MANUAL_OVERRIDE',
          isLocked: Boolean(isLocked),
          markupPercent: markupPercent ? parseFloat(markupPercent) : 0,
        },
      });

      return NextResponse.json({ success: true, data: { rate: updated } });
    }

    // Action: Sync live rates from public forex feed
    if (action === 'SYNC_RATES') {
      try {
        const res = await fetch('https://open.er-api.com/v6/latest/INR', {
          headers: { 'User-Agent': 'MedRoute-India/1.0' },
          next: { revalidate: 3600 },
        });

        if (res.ok) {
          const liveData = await res.json();
          if (liveData && liveData.rates) {
            const liveRates = liveData.rates as Record<string, number>;
            const updates = [];

            for (const [code] of Object.entries(SUPPORTED_CURRENCIES)) {
              if (code === 'INR') continue;
              if (liveRates[code]) {
                const newRate = liveRates[code];
                // Only update if not locked by admin
                const existing = await prisma.exchangeRate.findUnique({ where: { toCurrency: code } });
                if (!existing || !existing.isLocked) {
                  updates.push(
                    prisma.exchangeRate.upsert({
                      where: { toCurrency: code },
                      update: {
                        rate: newRate,
                        inverseRate: newRate > 0 ? 1 / newRate : 0,
                        source: 'AUTO_FEED',
                        lastFetchedAt: new Date(),
                      },
                      create: {
                        fromCurrency: BASE_CURRENCY,
                        toCurrency: code,
                        rate: newRate,
                        inverseRate: newRate > 0 ? 1 / newRate : 0,
                        source: 'AUTO_FEED',
                        isLocked: false,
                        markupPercent: 0,
                      },
                    })
                  );
                }
              }
            }

            await Promise.all(updates);
            return NextResponse.json({ success: true, message: `Synced ${updates.length} exchange rates.` });
          }
        }
      } catch (syncErr) {
        console.warn('Live rate sync failed, keeping current rates:', syncErr);
        return NextResponse.json({ success: false, error: 'Failed to contact external forex API' }, { status: 502 });
      }
    }

    // Action: Update global markup buffer
    if (action === 'UPDATE_GLOBAL_MARKUP' && markupPercent !== undefined) {
      await prisma.systemConfig.upsert({
        where: { key: 'forexMarkupPercent' },
        update: { value: String(markupPercent) },
        create: { key: 'forexMarkupPercent', value: String(markupPercent) },
      });
      return NextResponse.json({ success: true, message: 'Global forex markup updated.' });
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
  } catch (err) {
    console.error('Failed to update exchange rate:', err);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
