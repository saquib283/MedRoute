'use client';

/**
 * MediRoute India — Admin Forex & Currency Management Page
 * Allows administrator to configure supported currencies, view/edit exchange rates, set markup buffers, and sync live rates.
 */

import { useState, useEffect, useCallback } from 'react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { PageHeader } from '@/components/ui/PageHeader';
import { StatCard } from '@/components/ui/StatCard';
import { toast } from '@/components/ui/Toast';
import { useCurrency } from '@/lib/currency/CurrencyContext';
import {
  Globe,
  RefreshCw,
  Lock,
  Unlock,
  Percent,
  Edit2,
  Check,
  X,
  Search,
  DollarSign,
} from 'lucide-react';

interface RateDetail {
  toCurrency: string;
  rate: number;
  inverseRate: number;
  source: string;
  isLocked: boolean;
  markupPercent: number;
  lastFetchedAt: string;
}

export default function CurrencySettingsPage() {
  const { supportedCurrencies } = useCurrency();
  const [ratesDetail, setRatesDetail] = useState<RateDetail[]>([]);
  const [globalMarkup, setGlobalMarkup] = useState<number>(0);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [search, setSearch] = useState('');

  // Inline editing state
  const [editingCurrency, setEditingCurrency] = useState<string | null>(null);
  const [editRate, setEditRate] = useState('');
  const [editMarkup, setEditMarkup] = useState('');
  const [savingEdit, setSavingEdit] = useState(false);

  const fetchRates = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/v1/currency/rates');
      const data = await res.json();
      if (data.success && data.data?.ratesDetail) {
        setRatesDetail(data.data.ratesDetail);
        setGlobalMarkup(data.data.globalMarkupPercent || 0);
      }
    } catch (err) {
      console.error('Failed to load rates detail:', err);
      toast.error('Failed to load currency rates');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    queueMicrotask(() => fetchRates());
  }, [fetchRates]);

  const handleSyncLive = async () => {
    try {
      setSyncing(true);
      const res = await fetch('/api/v1/currency/rates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'SYNC_RATES' }),
      });
      const data = await res.json();
      if (data.success) {
        toast.success(data.message || 'Exchange rates synced successfully');
        await fetchRates();
      } else {
        toast.error(data.error || 'Failed to sync rates');
      }
    } catch {
      toast.error('Error contacting exchange rate service');
    } finally {
      setSyncing(false);
    }
  };

  const handleToggleLock = async (currency: RateDetail) => {
    try {
      const res = await fetch('/api/v1/currency/rates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'UPDATE_CURRENCY',
          currencyCode: currency.toCurrency,
          isLocked: !currency.isLocked,
        }),
      });
      const data = await res.json();
      if (data.success) {
        toast.success(
          !currency.isLocked
            ? `${currency.toCurrency} rate locked from auto-updates`
            : `${currency.toCurrency} rate unlocked`
        );
        await fetchRates();
      }
    } catch {
      toast.error('Failed to update rate lock status');
    }
  };

  const startEdit = (r: RateDetail) => {
    setEditingCurrency(r.toCurrency);
    setEditRate(String(r.rate));
    setEditMarkup(String(r.markupPercent));
  };

  const saveEdit = async (currencyCode: string) => {
    setSavingEdit(true);
    try {
      const res = await fetch('/api/v1/currency/rates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'UPDATE_CURRENCY',
          currencyCode,
          manualRate: editRate ? parseFloat(editRate) : undefined,
          markupPercent: editMarkup ? parseFloat(editMarkup) : 0,
        }),
      });
      const data = await res.json();
      if (data.success) {
        toast.success(`${currencyCode} configuration updated`);
        setEditingCurrency(null);
        await fetchRates();
      } else {
        toast.error(data.error || 'Failed to update currency');
      }
    } catch {
      toast.error('Error saving currency rate');
    } finally {
      setSavingEdit(false);
    }
  };

  const filteredRates = ratesDetail.filter((r) => {
    const meta = supportedCurrencies[r.toCurrency];
    const q = search.toLowerCase();
    return (
      r.toCurrency.toLowerCase().includes(q) ||
      (meta?.name && meta.name.toLowerCase().includes(q))
    );
  });

  return (
    <div className="space-y-6 animate-fade-in max-w-7xl mx-auto">
      <PageHeader
        title="Multi-Currency & Forex Management"
        subtitle="Manage supported currencies, live exchange rates against INR, and conversion markup buffers"
        breadcrumbs={[
          { label: 'Admin', href: '/admin/dashboard' },
          { label: 'Settings', href: '/admin/settings' },
          { label: 'Forex & Currencies' },
        ]}
        actions={
          <Button onClick={handleSyncLive} isLoading={syncing} disabled={syncing}>
            <RefreshCw className="w-4 h-4 mr-2" /> Sync Live Forex Rates
          </Button>
        }
      />

      {/* Metrics Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Base Currency"
          value="INR (₹)"
          subtitle="All hospital/hotel catalog prices stored in INR"
          icon={<DollarSign className="w-5 h-5" />}
          variant="primary"
        />
        <StatCard
          title="Supported Currencies"
          value={Object.keys(supportedCurrencies).length}
          subtitle="20+ global patient markets"
          icon={<Globe className="w-5 h-5" />}
          variant="success"
        />
        <StatCard
          title="Locked Rates"
          value={ratesDetail.filter((r) => r.isLocked).length}
          subtitle="Manual fixed corporate rates"
          icon={<Lock className="w-5 h-5" />}
          variant="warning"
        />
        <StatCard
          title="Forex Buffer"
          value={`${globalMarkup}%`}
          subtitle="Hedging volatility spread"
          icon={<Percent className="w-5 h-5" />}
        />
      </div>

      {/* Rates Table Card */}
      <Card className="p-6 bg-white border border-surface-200 space-y-4 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-2 border-b border-surface-100">
          <div>
            <h3 className="text-base font-bold text-surface-900">Exchange Rates vs INR</h3>
            <p className="text-xs text-surface-500">
              Live conversion rates used across patient portal, inquiry estimates, and treatment plans.
            </p>
          </div>

          <div className="relative w-full sm:w-72">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-surface-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search currency..."
              className="w-full pl-9 pr-3 py-1.5 text-xs rounded-lg bg-surface-50 border border-surface-200 focus:bg-white focus:border-primary-500 focus:ring-2 focus:ring-primary-100 outline-none transition-all"
            />
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-16">
            <div className="w-8 h-8 border-4 border-primary-600 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="text-[11px] uppercase tracking-wider text-surface-400 font-bold border-b border-surface-200">
                  <th className="pb-3 px-3">Currency</th>
                  <th className="pb-3 px-3">Symbol</th>
                  <th className="pb-3 px-3 text-right">1 INR = (Target)</th>
                  <th className="pb-3 px-3 text-right">1 Target = (INR)</th>
                  <th className="pb-3 px-3 text-center">Markup</th>
                  <th className="pb-3 px-3 text-center">Source</th>
                  <th className="pb-3 px-3 text-center">Lock</th>
                  <th className="pb-3 px-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-surface-100">
                {filteredRates.map((r) => {
                  const meta = supportedCurrencies[r.toCurrency];
                  const isEditing = editingCurrency === r.toCurrency;

                  return (
                    <tr key={r.toCurrency} className="hover:bg-surface-50/70 transition-colors">
                      {/* Currency Name & Flag */}
                      <td className="py-3 px-3 font-semibold text-surface-900">
                        <div className="flex items-center gap-2">
                          <span className="text-lg">{meta?.flag || 'FX'}</span>
                          <div>
                            <p className="font-bold text-surface-900">{r.toCurrency}</p>
                            <p className="text-[11px] text-surface-400">{meta?.name || r.toCurrency}</p>
                          </div>
                        </div>
                      </td>

                      {/* Symbol */}
                      <td className="py-3 px-3 font-mono text-surface-600 font-bold">
                        {meta?.symbol || '—'}
                      </td>

                      {/* Rate (1 INR = X Target) */}
                      <td className="py-3 px-3 text-right font-mono font-medium">
                        {isEditing ? (
                          <input
                            type="number"
                            step="any"
                            value={editRate}
                            onChange={(e) => setEditRate(e.target.value)}
                            className="w-28 text-right px-2 py-1 text-xs border border-primary-400 rounded focus:ring-1 focus:ring-primary-500 outline-none"
                          />
                        ) : (
                          <span className="text-surface-900 font-semibold">{r.rate}</span>
                        )}
                      </td>

                      {/* Inverse Rate (1 Target = Y INR) */}
                      <td className="py-3 px-3 text-right font-mono font-bold text-primary-700">
                        {r.rate > 0 ? `₹${(1 / r.rate).toFixed(2)}` : '—'}
                      </td>

                      {/* Markup Buffer */}
                      <td className="py-3 px-3 text-center">
                        {isEditing ? (
                          <input
                            type="number"
                            step="0.1"
                            value={editMarkup}
                            onChange={(e) => setEditMarkup(e.target.value)}
                            className="w-16 text-center px-1.5 py-1 text-xs border border-primary-400 rounded focus:ring-1 focus:ring-primary-500 outline-none"
                          />
                        ) : r.markupPercent > 0 ? (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-warning-50 text-warning-700 border border-warning-200">
                            +{r.markupPercent}%
                          </span>
                        ) : (
                          <span className="text-surface-400 text-xs">—</span>
                        )}
                      </td>

                      {/* Source */}
                      <td className="py-3 px-3 text-center">
                        <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-surface-100 text-surface-600">
                          {r.source.replace('_', ' ')}
                        </span>
                      </td>

                      {/* Lock Status */}
                      <td className="py-3 px-3 text-center">
                        <button
                          type="button"
                          onClick={() => handleToggleLock(r)}
                          className={`p-1.5 rounded-md transition-colors ${
                            r.isLocked
                              ? 'text-warning-600 hover:bg-warning-50'
                              : 'text-surface-300 hover:text-surface-500 hover:bg-surface-100'
                          }`}
                          title={r.isLocked ? 'Rate is locked. Click to unlock.' : 'Rate updates automatically. Click to lock.'}
                        >
                          {r.isLocked ? <Lock className="w-4 h-4" /> : <Unlock className="w-4 h-4" />}
                        </button>
                      </td>

                      {/* Actions */}
                      <td className="py-3 px-3 text-right">
                        {isEditing ? (
                          <div className="flex items-center justify-end gap-1">
                            <Button
                              size="sm"
                              onClick={() => saveEdit(r.toCurrency)}
                              isLoading={savingEdit}
                              className="!px-2 !py-1 text-xs"
                            >
                              <Check className="w-3.5 h-3.5" />
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => setEditingCurrency(null)}
                              className="!px-2 !py-1 text-xs text-danger-600"
                            >
                              <X className="w-3.5 h-3.5" />
                            </Button>
                          </div>
                        ) : (
                          <button
                            type="button"
                            onClick={() => startEdit(r)}
                            className="p-1.5 text-surface-400 hover:text-primary-600 hover:bg-primary-50 rounded transition-colors"
                            title="Edit exchange rate"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
