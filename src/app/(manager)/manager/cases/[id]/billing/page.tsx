'use client';

/**
 * MediRoute India — Invoice Builder
 * Full-page form for creating invoices with line items.
 */

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { PageHeader } from '@/components/ui/PageHeader';
import { toast } from '@/components/ui/Toast';
import { formatCurrency, INVOICE_TYPE_LABELS } from '@/lib/constants';
import { Plus, Trash2, Save, ArrowLeft } from 'lucide-react';

interface LineItem {
  description: string;
  quantity: number;
  unitPrice: number;
  category: string;
}

interface HospitalOption { id: string; name: string }

export default function BillingPage({ params }: { params: Promise<{ id: string }> }) {
  const router = useRouter();
  const [caseId, setCaseId] = useState('');
  const [saving, setSaving] = useState(false);

  const [invoiceType, setInvoiceType] = useState('TREATMENT');
  const [hospitalId, setHospitalId] = useState('');
  const [currency, setCurrency] = useState('INR');
  const [notes, setNotes] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [lineItems, setLineItems] = useState<LineItem[]>([
    { description: '', quantity: 1, unitPrice: 0, category: '' },
  ]);

  const [hospitals, setHospitals] = useState<HospitalOption[]>([]);

  useEffect(() => { params.then(p => setCaseId(p.id)); }, [params]);

  useEffect(() => {
    fetch('/api/v1/manager/hospitals').then(r => r.json()).then(d => {
      if (d.data?.hospitals) setHospitals(d.data.hospitals);
      else if (d.hospitals) setHospitals(d.hospitals);
    }).catch(() => {});
  }, []);

  const addItem = () => {
    setLineItems([...lineItems, { description: '', quantity: 1, unitPrice: 0, category: '' }]);
  };

  const removeItem = (idx: number) => {
    if (lineItems.length <= 1) return;
    setLineItems(lineItems.filter((_, i) => i !== idx));
  };

  const updateItem = (idx: number, field: keyof LineItem, value: string | number) => {
    const updated = [...lineItems];
    (updated[idx] as unknown as Record<string, string | number>)[field] = value;
    setLineItems(updated);
  };

  const subtotal = lineItems.reduce((sum, item) => sum + (item.unitPrice * item.quantity), 0);

  const handleSave = async () => {
    const validItems = lineItems.filter(i => i.description.trim() && i.unitPrice > 0);
    if (validItems.length === 0) {
      toast.error('Add at least one line item with description and price');
      return;
    }

    setSaving(true);
    try {
      const res = await fetch('/api/v1/manager/invoices', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          caseId,
          invoiceType,
          hospitalId: hospitalId || undefined,
          currency,
          notes: notes || undefined,
          dueDate: dueDate || undefined,
          lineItems: validItems,
        }),
      });
      const data = await res.json();
      if (data.success) {
        toast.success(`Invoice ${data.data.invoice.invoiceNumber} created`);
        router.push(`/manager/cases/${caseId}`);
      } else {
        toast.error(data.error || 'Failed to create invoice');
      }
    } catch {
      toast.error('Error creating invoice');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6 animate-fade-in max-w-5xl mx-auto">
      <PageHeader
        title="Create Invoice"
        subtitle={`Case ID: ${caseId.slice(0, 8)}...`}
        breadcrumbs={[
          { label: 'Cases', href: '/manager/cases' },
          { label: 'Case Detail', href: `/manager/cases/${caseId}` },
          { label: 'New Invoice' },
        ]}
        actions={
          <Button variant="ghost" onClick={() => router.back()}>
            <ArrowLeft className="w-4 h-4 mr-1" /> Back
          </Button>
        }
      />

      {/* Invoice Details */}
      <Card className="p-6 bg-white border border-surface-200 space-y-4">
        <h3 className="text-sm font-bold text-surface-900 uppercase tracking-wider">Invoice Details</h3>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <Select
            label="Invoice Type *"
            value={invoiceType}
            onChange={setInvoiceType}
            options={Object.entries(INVOICE_TYPE_LABELS).map(([v, l]) => ({ value: v, label: l }))}
          />
          {invoiceType === 'TREATMENT' && (
            <Select
              label="Hospital"
              value={hospitalId}
              onChange={setHospitalId}
              options={[{ value: '', label: '— Select —' }, ...hospitals.map(h => ({ value: h.id, label: h.name }))]}
            />
          )}
          <div className="grid grid-cols-2 gap-3">
            <Select
              label="Currency"
              value={currency}
              onChange={setCurrency}
              options={[
                { value: 'INR', label: '₹ INR' },
                { value: 'USD', label: '$ USD' },
                { value: 'EUR', label: '€ EUR' },
                { value: 'GBP', label: '£ GBP' },
              ]}
            />
            <Input label="Due Date" type="date" value={dueDate} onChange={e => setDueDate(e.target.value)} />
          </div>
        </div>
        <div>
          <label className="text-xs font-bold text-surface-600 uppercase tracking-wider block mb-1">Notes</label>
          <textarea
            value={notes}
            onChange={e => setNotes(e.target.value)}
            rows={2}
            className="w-full rounded-lg border border-surface-200 px-3 py-2 text-sm focus:ring-2 focus:ring-primary-300 focus:border-primary-500 outline-none transition-all resize-none"
            placeholder="Payment terms, special instructions..."
          />
        </div>
      </Card>

      {/* Line Items */}
      <Card className="p-6 bg-white border border-surface-200 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-bold text-surface-900 uppercase tracking-wider">Line Items</h3>
          <Button size="sm" variant="secondary" onClick={addItem}>
            <Plus className="w-3.5 h-3.5 mr-1" /> Add Item
          </Button>
        </div>

        <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-xs text-surface-500 uppercase border-b border-surface-200">
              <th className="text-left pb-2 font-bold">Description</th>
              <th className="text-left pb-2 font-bold w-28">Category</th>
              <th className="text-right pb-2 font-bold w-20">Qty</th>
              <th className="text-right pb-2 font-bold w-32">Unit Price</th>
              <th className="text-right pb-2 font-bold w-32">Total</th>
              <th className="w-10"></th>
            </tr>
          </thead>
          <tbody>
            {lineItems.map((item, idx) => (
              <tr key={idx} className="border-b border-surface-50">
                <td className="py-2 pr-2">
                  <input
                    type="text"
                    value={item.description}
                    onChange={e => updateItem(idx, 'description', e.target.value)}
                    className="w-full rounded border border-surface-300 px-2 py-1.5 text-sm focus:border-primary-600"
                    placeholder="Item description"
                  />
                </td>
                <td className="py-2 pr-2">
                  <input
                    type="text"
                    value={item.category}
                    onChange={e => updateItem(idx, 'category', e.target.value)}
                    className="w-full rounded border border-surface-300 px-2 py-1.5 text-sm focus:border-primary-600"
                    placeholder="Category"
                  />
                </td>
                <td className="py-2 pr-2">
                  <input
                    type="number"
                    min={1}
                    value={item.quantity}
                    onChange={e => updateItem(idx, 'quantity', parseInt(e.target.value) || 1)}
                    className="w-full rounded border border-surface-300 px-2 py-1.5 text-sm text-right focus:border-primary-600"
                  />
                </td>
                <td className="py-2 pr-2">
                  <input
                    type="number"
                    min={0}
                    value={item.unitPrice}
                    onChange={e => updateItem(idx, 'unitPrice', parseFloat(e.target.value) || 0)}
                    className="w-full rounded border border-surface-300 px-2 py-1.5 text-sm text-right focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-600"
                  />
                </td>
                <td className="py-2 text-right font-bold text-surface-900">{formatCurrency(item.unitPrice * item.quantity)}</td>
                <td className="py-2 text-center">
                  {lineItems.length > 1 && (
                    <button onClick={() => removeItem(idx)} className="text-danger-400 hover:text-danger-600 p-1">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        </div>

        <div className="flex justify-end">
          <div className="w-64 space-y-2 pt-3 border-t border-surface-200">
            <div className="flex justify-between text-sm">
              <span className="text-surface-500">Subtotal</span>
              <span className="font-bold">{formatCurrency(subtotal)}</span>
            </div>
            <div className="flex justify-between text-sm text-surface-400">
              <span>Tax (auto-calculated)</span>
              <span className="italic">Applied on save</span>
            </div>
            <div className="flex justify-between text-sm text-surface-400">
              <span>Commission (auto-calculated)</span>
              <span className="italic">Applied on save</span>
            </div>
          </div>
        </div>
      </Card>

      {/* Actions */}
      <div className="flex items-center justify-between pt-2 pb-8">
        <Button variant="ghost" onClick={() => router.back()}>Cancel</Button>
        <Button onClick={handleSave} isLoading={saving} disabled={saving}>
          <Save className="w-4 h-4 mr-1" /> Create Invoice
        </Button>
      </div>
    </div>
  );
}
