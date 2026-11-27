'use client';

/**
 * MediRoute India — Global Currency Context & Hook
 * Provides seamless currency conversion, formatting, country detection, and persistence.
 */

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import {
  CurrencyCode,
  CountryCode,
  CurrencyMeta,
  CountryMeta,
  FormatCurrencyOptions,
} from './types';
import {
  BASE_CURRENCY,
  SUPPORTED_CURRENCIES,
  COUNTRIES,
  DEFAULT_EXCHANGE_RATES,
  getCurrencyMeta,
} from './currencies';
import { detectClientCountry } from './detector';

interface CurrencyContextValue {
  currentCurrency: CurrencyCode;
  currentCountry: CountryMeta;
  currencyMeta: CurrencyMeta;
  rates: Record<string, number>;
  isLoading: boolean;
  supportedCurrencies: Record<CurrencyCode, CurrencyMeta>;
  countries: Record<CountryCode, CountryMeta>;
  setCurrency: (currency: CurrencyCode) => void;
  setCountry: (countryCode: CountryCode) => void;
  convert: (amountInINR: number | string | null | undefined, targetCurrency?: CurrencyCode) => number;
  format: (amountInINR: number | string | null | undefined, targetCurrency?: CurrencyCode, options?: FormatCurrencyOptions) => string;
  formatExact: (amount: number | string | null | undefined, currencyCode: CurrencyCode) => string;
  getInverseRate: (currencyCode?: CurrencyCode) => number;
}

const CurrencyContext = createContext<CurrencyContextValue | null>(null);

const STORAGE_KEY_CURRENCY = 'medroute_preferred_currency';
const STORAGE_KEY_COUNTRY = 'medroute_detected_country';

export function CurrencyProvider({ children }: { children: React.ReactNode }) {
  const [currentCurrency, setCurrentCurrencyState] = useState<CurrencyCode>('USD');
  const [currentCountry, setCurrentCountryState] = useState<CountryMeta>(COUNTRIES['US'] || COUNTRIES['IN']);
  const [rates, setRates] = useState<Record<string, number>>(DEFAULT_EXCHANGE_RATES);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  // Initialize currency & country from storage or heuristics asynchronously after hydration
  useEffect(() => {
    let cancelled = false;
    queueMicrotask(() => {
      if (cancelled) return;
      try {
        const savedCurrency = localStorage.getItem(STORAGE_KEY_CURRENCY);
        const savedCountryCode = localStorage.getItem(STORAGE_KEY_COUNTRY);

        if (savedCountryCode && COUNTRIES[savedCountryCode]) {
          setCurrentCountryState(COUNTRIES[savedCountryCode]);
        } else {
          setCurrentCountryState(detectClientCountry());
        }

        if (savedCurrency && (SUPPORTED_CURRENCIES[savedCurrency] || savedCurrency === 'INR')) {
          setCurrentCurrencyState(savedCurrency);
        } else if (savedCountryCode && COUNTRIES[savedCountryCode]) {
          setCurrentCurrencyState(COUNTRIES[savedCountryCode].defaultCurrency);
        } else {
          setCurrentCurrencyState(detectClientCountry().defaultCurrency);
        }
      } catch (e) {
        console.warn('LocalStorage access issue:', e);
      }
    });
    return () => {
      cancelled = true;
    };
  }, []);

  // Fetch live exchange rates and server geo-detection
  useEffect(() => {
    async function fetchRates() {
      try {
        const res = await fetch('/api/v1/currency/rates');
        if (res.ok) {
          const data = await res.json();
          if (data.success && data.data?.rates) {
            setRates(data.data.rates);

            // If user hasn't explicitly chosen yet, update with server-detected country
            const savedCurrency = localStorage.getItem(STORAGE_KEY_CURRENCY);
            if (!savedCurrency && data.data.detectedCountry) {
              const detected = data.data.detectedCountry as CountryMeta;
              if (COUNTRIES[detected.code]) {
                setCurrentCountryState(COUNTRIES[detected.code]);
                setCurrentCurrencyState(detected.defaultCurrency);
              }
            }
          }
        }
      } catch (err) {
        console.warn('Using fallback exchange rates:', err);
      } finally {
        setIsLoading(false);
      }
    }

    fetchRates();
  }, []);

  const setCurrency = useCallback((code: CurrencyCode) => {
    const upper = code.toUpperCase();
    setCurrentCurrencyState(upper);
    try {
      localStorage.setItem(STORAGE_KEY_CURRENCY, upper);
      document.cookie = `medroute_currency=${upper}; path=/; max-age=31536000; SameSite=Lax`;
    } catch (e) {
      console.warn('Failed to save currency:', e);
    }
  }, []);

  const setCountry = useCallback((code: CountryCode) => {
    const upper = code.toUpperCase();
    const found = COUNTRIES[upper];
    if (found) {
      setCurrentCountryState(found);
      setCurrentCurrencyState(found.defaultCurrency);
      try {
        localStorage.setItem(STORAGE_KEY_COUNTRY, upper);
        localStorage.setItem(STORAGE_KEY_CURRENCY, found.defaultCurrency);
        document.cookie = `medroute_country=${upper}; path=/; max-age=31536000; SameSite=Lax`;
        document.cookie = `medroute_currency=${found.defaultCurrency}; path=/; max-age=31536000; SameSite=Lax`;
      } catch (e) {
        console.warn('Failed to save country:', e);
      }
    }
  }, []);

  /**
   * Converts an amount in INR to target currency
   */
  const convert = useCallback(
    (amountInINR: number | string | null | undefined, targetCurrency?: CurrencyCode): number => {
      if (amountInINR === null || amountInINR === undefined || amountInINR === '') return 0;
      const num = typeof amountInINR === 'string' ? parseFloat(amountInINR) : amountInINR;
      if (isNaN(num)) return 0;

      const target = (targetCurrency || currentCurrency).toUpperCase();
      if (target === BASE_CURRENCY) return num;

      const rate = rates[target] || DEFAULT_EXCHANGE_RATES[target] || 1;
      return num * rate;
    },
    [currentCurrency, rates]
  );

  /**
   * Formats an amount in INR into the target currency string
   */
  const format = useCallback(
    (
      amountInINR: number | string | null | undefined,
      targetCurrency?: CurrencyCode,
      options?: FormatCurrencyOptions
    ): string => {
      if (amountInINR === null || amountInINR === undefined || amountInINR === '') return '—';
      const num = typeof amountInINR === 'string' ? parseFloat(amountInINR) : amountInINR;
      if (isNaN(num)) return '—';

      const target = (targetCurrency || currentCurrency).toUpperCase();
      const meta = getCurrencyMeta(target);
      const converted = convert(num, target);

      // Format number according to currency convention
      const fractionDigits = options?.minimumFractionDigits !== undefined
        ? options.minimumFractionDigits
        : meta.decimals;

      let formattedNumber: string;

      if (target === 'INR') {
        formattedNumber = new Intl.NumberFormat('en-IN', {
          minimumFractionDigits: fractionDigits,
          maximumFractionDigits: options?.maximumFractionDigits ?? fractionDigits,
        }).format(converted);
      } else {
        formattedNumber = new Intl.NumberFormat('en-US', {
          minimumFractionDigits: fractionDigits,
          maximumFractionDigits: options?.maximumFractionDigits ?? fractionDigits,
        }).format(converted);
      }

      const symbol = meta.symbol;
      const space = meta.spaceAfterSymbol ? ' ' : '';
      const formatted = meta.symbolPosition === 'suffix'
        ? `${formattedNumber} ${symbol}`
        : `${symbol}${space}${formattedNumber}`;

      if (options?.showOriginalINR && target !== BASE_CURRENCY) {
        const inrFormatted = new Intl.NumberFormat('en-IN', {
          style: 'currency',
          currency: 'INR',
          maximumFractionDigits: 0,
        }).format(num);
        return `${formatted} (${inrFormatted})`;
      }

      return formatted;
    },
    [convert, currentCurrency]
  );

  /**
   * Formats an amount already in the target currency
   */
  const formatExact = useCallback((amount: number | string | null | undefined, currencyCode: CurrencyCode): string => {
    if (amount === null || amount === undefined || amount === '') return '—';
    const num = typeof amount === 'string' ? parseFloat(amount) : amount;
    if (isNaN(num)) return '—';

    const target = currencyCode.toUpperCase();
    const meta = getCurrencyMeta(target);

    let formattedNumber: string;
    if (target === 'INR') {
      formattedNumber = new Intl.NumberFormat('en-IN', {
        minimumFractionDigits: meta.decimals,
        maximumFractionDigits: meta.decimals,
      }).format(num);
    } else {
      formattedNumber = new Intl.NumberFormat('en-US', {
        minimumFractionDigits: meta.decimals,
        maximumFractionDigits: meta.decimals,
      }).format(num);
    }

    const symbol = meta.symbol;
    const space = meta.spaceAfterSymbol ? ' ' : '';
    return meta.symbolPosition === 'suffix'
      ? `${formattedNumber} ${symbol}`
      : `${symbol}${space}${formattedNumber}`;
  }, []);

  const getInverseRate = useCallback(
    (currencyCode?: CurrencyCode): number => {
      const target = (currencyCode || currentCurrency).toUpperCase();
      if (target === BASE_CURRENCY) return 1.0;
      const rate = rates[target] || DEFAULT_EXCHANGE_RATES[target] || 1;
      return rate > 0 ? 1 / rate : 1;
    },
    [currentCurrency, rates]
  );

  const value: CurrencyContextValue = {
    currentCurrency,
    currentCountry,
    currencyMeta: getCurrencyMeta(currentCurrency),
    rates,
    isLoading,
    supportedCurrencies: SUPPORTED_CURRENCIES,
    countries: COUNTRIES,
    setCurrency,
    setCountry,
    convert,
    format,
    formatExact,
    getInverseRate,
  };

  return <CurrencyContext.Provider value={value}>{children}</CurrencyContext.Provider>;
}

export function useCurrency(): CurrencyContextValue {
  const context = useContext(CurrencyContext);
  if (!context) {
    throw new Error('useCurrency must be used within a CurrencyProvider');
  }
  return context;
}
