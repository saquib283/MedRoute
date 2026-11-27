'use client';

/**
 * MediRoute India — Treatment Plan Builder
 * Full-page form for creating treatment plans with dynamic line items.
 */

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { PageHeader } from '@/components/ui/PageHeader';
import { toast } from '@/components/ui/Toast';
import { formatCurrency, TREATMENT_PLAN_ITEM_TYPE_LABELS } from '@/lib/constants';
import { Plus, Trash2, Save, Send, ArrowLeft } from 'lucide-react';

interface LineItem {
  description: string;
  itemType: string;
  quantity: number;
  unitCost: number;
  hospitalId: string;
  doctorId: string;
  notes: string;
}

interface HospitalOption { id: string; name: string }
interface DoctorOption { id: string; fullName: string }

export default function TreatmentPlanPage({ params }: { params: Promise<{ id: string }> }) {
  const router = useRouter();
  const [caseId, setCaseId] = useState('');
  const [saving, setSaving] = useState(false);

  // Form state
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [estimatedDuration, setEstimatedDuration] = useState('');
  const [estimatedHospitalStay, setEstimatedHospitalStay] = useState('');
  const [estimatedRecovery, setEstimatedRecovery] = useState('');
  const [items, setItems] = useState<LineItem[]>([
    { description: '', itemType: 'PROCEDURE', quantity: 1, unitCost: 0, hospitalId: '', doctorId: '', notes: '' },
  ]);

  // Options
  const [hospitals, setHospitals] = useState<HospitalOption[]>([]);
  const [doctors, setDoctors] = useState<DoctorOption[]>([]);

  useEffect(() => {
    params.then(p => setCaseId(p.id));
  }, [params]);

  useEffect(() => {
    // Fetch hospitals and doctors for dropdowns
    fetch('/api/v1/manager/hospitals').then(r => r.json()).then(d => {
      if (d.success || d.data?.hospitals) setHospitals(d.data?.hospitals || d.hospitals || []);
    }).catch(() => {});
    fetch('/api/v1/manager/doctors').then(r => r.json()).then(d => {
      if (d.success || d.data?.doctors) setDoctors(d.data?.doctors || d.doctors || []);
    }).catch(() => {});
  }, []);

  const addItem = () => {
    setItems([...items, { description: '', itemType: 'PROCEDURE', quantity: 1, unitCost: 0, hospitalId: '', doctorId: '', notes: '' }]);
  };

  const removeItem = (idx: number) => {
    if (items.length <= 1) return;
    setItems(items.filter((_, i) => i !== idx));
  };

  const updateItem = (idx: number, field: keyof LineItem, value: string | number) => {
    const updated = [...items];
    (updated[idx] as unknown as Record<string, string | number>)[field] = value;
    setItems(updated);
  };

  const totalEstimated = items.reduce((sum, item) => sum + (item.unitCost * item.quantity), 0);

  const handleSave = async (sendToPatient = false) => {
    if (!title.trim()) {
      toast.error('Please enter a plan title');
      return;
    }
    const validItems = items.filter(i => i.description.trim() && i.unitCost > 0);
    if (validItems.length === 0) {
      toast.error('Add at least one item with description and cost');
      return;
    }

    setSaving(true);
    try {
      const res = await fetch('/api/v1/manager/treatment-plans', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          caseId,
          title,
          description,
          estimatedDuration,
          estimatedHospitalStay,
          estimatedRecovery,
          items: validItems.map(i => ({
            description: i.description,
            itemType: i.itemType,
            quantity: i.quantity,
            unitCost: i.unitCost,
            hospitalId: i.hospitalId || undefined,
            doctorId: i.doctorId || undefined,
            notes: i.notes || undefined,
          })),
        }),
      });
      const data = await res.json();
      if (data.success) {
        if (sendToPatient && data.data?.treatmentPlan?.id) {
          // Also send to patient
          await fetch(`/api/v1/manager/treatment-plans/${data.data.treatmentPlan.id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ status: 'SENT_TO_PATIENT' }),
          });
          toast.success('Treatment plan created and sent to patient');
        } else {
          toast.success('Treatment plan saved as draft');
        }
        router.push(`/manager/cases/${caseId}`);
      } else {
        toast.error(data.error || 'Failed to save plan');
      }
    } catch {
      toast.error('Error saving treatment plan');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6 animate-fade-in max-w-5xl mx-auto">
      <PageHeader
        title="Create Treatment Plan"
        subtitle={`Case ID: ${caseId.slice(0, 8)}...`}
        breadcrumbs={[
          { label: 'Cases', href: '/manager/cases' },
          { label: 'Case Detail', href: `/manager/cases/${caseId}` },
          { label: 'New Treatment Plan' },
        ]}
        actions={
          <Button variant="ghost" onClick={() => router.back()}>
            <ArrowLeft className="w-4 h-4 mr-1" /> Back
          </Button>
        }
      />

      {/* Plan Details */}
      <Card className="p-6 bg-white border border-surface-200 space-y-4">
        <h3 className="text-sm font-bold text-surface-900 uppercase tracking-wider">Plan Details</h3>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <Input label="Plan Title *" value={title} onChange={e => setTitle(e.target.value)} placeholder="e.g. Cardiac Bypass Surgery — CABG" />
          <Input label="Estimated Duration" value={estimatedDuration} onChange={e => setEstimatedDuration(e.target.value)} placeholder="e.g. 10-14 days" />
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <Input label="Hospital Stay" value={estimatedHospitalStay} onChange={e => setEstimatedHospitalStay(e.target.value)} placeholder="e.g. 7 nights" />
          <Input label="Recovery Period" value={estimatedRecovery} onChange={e => setEstimatedRecovery(e.target.value)} placeholder="e.g. 4-6 weeks" />
        </div>
        <div>
          <label className="text-xs font-bold text-surface-600 uppercase tracking-wider block mb-1">Description</label>
          <textarea
            value={description}
            onChange={e => setDescription(e.target.value)}
            rows={3}
            className="w-full rounded-lg border border-surface-200 px-3 py-2 text-sm focus:ring-2 focus:ring-primary-300 focus:border-primary-500 outline-none transition-all resize-none"
            placeholder="Detailed description of the treatment plan..."
          />
        </div>
      </Card>

      {/* Line Items */}
      <Card className="p-6 bg-white border border-surface-200 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-bold text-surface-900 uppercase tracking-wider">Treatment Items</h3>
          <Button size="sm" variant="secondary" onClick={addItem}>
            <Plus className="w-3.5 h-3.5 mr-1" /> Add Item
          </Button>
        </div>

        <div className="space-y-4">
          {items.map((item, idx) => (
            <div key={idx} className="p-4 bg-surface-50 rounded-xl border border-surface-200 space-y-3">
              <div className="flex items-start justify-between">
                <span className="text-xs font-bold text-surface-500 uppercase">Item {idx + 1}</span>
                {items.length > 1 && (
                  <button onClick={() => removeItem(idx)} className="text-danger-500 hover:text-danger-700 transition-colors p-1 rounded hover:bg-danger-50">
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
              </div>
              <div className="grid grid-cols-1 lg:grid-cols-4 gap-3">
                <div className="lg:col-span-2">
                  <Input label="Description *" value={item.description} onChange={e => updateItem(idx, 'description', e.target.value)} placeholder="e.g. CABG Surgery (Triple Vessel)" />
                </div>
                <Select
                  label="Type"
                  value={item.itemType}
                  onChange={v => updateItem(idx, 'itemType', v)}
                  options={Object.entries(TREATMENT_PLAN_ITEM_TYPE_LABELS).map(([v, l]) => ({ value: v, label: l }))}
                />
                <div className="grid grid-cols-2 gap-2">
                  <Input label="Qty" type="number" value={String(item.quantity)} onChange={e => updateItem(idx, 'quantity', parseInt(e.target.value) || 1)} />
                  <Input label="Unit Cost (₹)" type="number" value={String(item.unitCost)} onChange={e => updateItem(idx, 'unitCost', parseFloat(e.target.value) || 0)} />
                </div>
              </div>
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
                <Select
                  label="Hospital"
                  value={item.hospitalId}
                  onChange={v => updateItem(idx, 'hospitalId', v)}
                  options={[{ value: '', label: '— Select —' }, ...hospitals.map(h => ({ value: h.id, label: h.name }))]}
                />
                <Select
                  label="Doctor"
                  value={item.doctorId}
                  onChange={v => updateItem(idx, 'doctorId', v)}
                  options={[{ value: '', label: '— Select —' }, ...doctors.map(d => ({ value: d.id, label: `Dr. ${d.fullName}` }))]}
                />
                <div className="text-right self-end pb-1">
                  <p className="text-xs text-surface-500">Line Total</p>
                  <p className="text-lg font-extrabold text-primary-700">{formatCurrency(item.unitCost * item.quantity)}</p>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Total */}
        <div className="flex items-center justify-between p-4 bg-primary-50 rounded-xl border border-primary-200">
          <span className="text-sm font-bold text-primary-900 uppercase tracking-wider">Total Estimated Cost</span>
          <span className="text-2xl font-extrabold text-primary-700">{formatCurrency(totalEstimated)}</span>
        </div>
      </Card>

      {/* Actions */}
      <div className="flex items-center justify-between pt-2 pb-8">
        <Button variant="ghost" onClick={() => router.back()}>Cancel</Button>
        <div className="flex items-center gap-3">
          <Button variant="secondary" onClick={() => handleSave(false)} isLoading={saving} disabled={saving}>
            <Save className="w-4 h-4 mr-1" /> Save Draft
          </Button>
          <Button onClick={() => handleSave(true)} isLoading={saving} disabled={saving}>
            <Send className="w-4 h-4 mr-1" /> Save & Send to Patient
          </Button>
        </div>
      </div>
    </div>
  );
}
