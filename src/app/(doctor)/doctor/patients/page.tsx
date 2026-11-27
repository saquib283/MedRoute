'use client';

/**
 * Afzal Healthcare — Doctor Patient Roster & Safety Alerts
 * Searchable cohort of patients under the specialist's care, displaying decrypted
 * allergies, chronic conditions, medications, surgeries, and active case links.
 */

import { useState, useEffect, useMemo, useCallback } from 'react';
import Link from 'next/link';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge, CaseStatusBadge, UrgencyBadge } from '@/components/ui/Badge';
import { toast } from '@/components/ui/Toast';
import {
  Search,
  AlertTriangle,
  Pill,
  HeartPulse,
  Scissors,
  Droplets,
  Plane,
  ArrowRight,
  X,
} from 'lucide-react';

interface PatientCaseSummary {
  id: string;
  status: string;
  isUrgent: boolean;
  fitToFlyClearance?: { isCleared: boolean } | null;
}

interface DecryptedMedicalProfile {
  allergies?: unknown[];
  medications?: unknown[];
  surgeries?: unknown[];
  chronicConditions?: unknown[];
}

interface DoctorPatient {
  id: string;
  nationality: string;
  passportNo: string;
  bloodGroup: string | null;
  medicalCondition: string | null;
  urgencyLevel: string;
  user: {
    fullName: string;
    email: string;
    phone: string | null;
  };
  medicalProfile: DecryptedMedicalProfile | null;
  cases?: PatientCaseSummary[];
}

function formatProfileItem(item: unknown): string {
  if (typeof item === 'string') return item;
  if (item && typeof item === 'object') {
    const obj = item as Record<string, unknown>;
    const name = obj.name || obj.title || obj.condition || '';
    const extra = [obj.dosage, obj.frequency, obj.date, obj.notes]
      .filter((v) => typeof v === 'string' && v.trim())
      .join(' • ');
    if (name && extra) return `${String(name)} (${extra})`;
    if (name) return String(name);
    return JSON.stringify(item);
  }
  return String(item ?? '');
}

function normalizeList(items: unknown[] | undefined | null): string[] {
  if (!Array.isArray(items)) return [];
  return items.map(formatProfileItem).filter((v) => v.trim().length > 0);
}

export default function DoctorPatientsPage() {
  const [patients, setPatients] = useState<DoctorPatient[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  const loadPatients = useCallback(async (isCancelled?: () => boolean) => {
    try {
      setLoading(true);
      const res = await fetch('/api/v1/doctor/patients');
      const json = await res.json();
      if (isCancelled?.()) return;

      if (!res.ok || !json.success) {
        toast.apiError(json, 'Failed to load assigned patients');
        return;
      }
      setPatients(json.data?.patients ?? []);
    } catch (err) {
      if (!isCancelled?.()) {
        toast.apiError(err, 'Network error loading patients');
      }
    } finally {
      if (!isCancelled?.()) {
        setLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    const timer = setTimeout(() => {
      void loadPatients(() => cancelled);
    }, 0);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [loadPatients]);

  const filteredPatients = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return patients;
    return patients.filter((p) => {
      const allergies = normalizeList(p.medicalProfile?.allergies).join(' ').toLowerCase();
      const chronic = normalizeList(p.medicalProfile?.chronicConditions).join(' ').toLowerCase();
      return (
        p.user.fullName.toLowerCase().includes(q) ||
        p.nationality.toLowerCase().includes(q) ||
        (p.medicalCondition || '').toLowerCase().includes(q) ||
        (p.bloodGroup || '').toLowerCase().includes(q) ||
        allergies.includes(q) ||
        chronic.includes(q)
      );
    });
  }, [patients, searchQuery]);

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header & Search */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-5 border-b border-surface-200">
        <div>
          <h1 className="text-xl sm:text-2xl font-semibold text-surface-900 tracking-tight">My patients</h1>
          <p className="text-sm text-surface-500 mt-0.5">
            Clinical safety profiles, decrypted allergies &amp; medications, and active treatment cases.
          </p>
        </div>

        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 text-surface-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search patient, country, allergy..."
            className="w-full min-h-11 pl-10 pr-10 py-2 rounded-md border border-surface-300 bg-white text-sm text-surface-900 placeholder:text-surface-400 focus:border-primary-600 focus:outline-none transition-colors"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery('')}
              aria-label="Clear search"
              className="absolute right-0 top-0 w-11 h-11 flex items-center justify-center text-surface-400 hover:text-surface-700"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="flex flex-col items-center gap-3">
            <div className="w-7 h-7 border-2 border-primary-600 border-t-transparent rounded-full animate-spin" />
            <span className="text-sm font-medium text-surface-500">Loading clinical profiles...</span>
          </div>
        </div>
      ) : filteredPatients.length === 0 ? (
        <Card className="p-10 text-center text-sm text-surface-500">
          {searchQuery
            ? 'No assigned patients match your search criteria.'
            : 'No patients are currently assigned to your appointments.'}
        </Card>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          {filteredPatients.map((patient) => {
            const allergies = normalizeList(patient.medicalProfile?.allergies);
            const chronicConditions = normalizeList(patient.medicalProfile?.chronicConditions);
            const medications = normalizeList(patient.medicalProfile?.medications);
            const surgeries = normalizeList(patient.medicalProfile?.surgeries);
            const activeCases = patient.cases ?? [];

            return (
              <Card key={patient.id} className="p-5 space-y-4 flex flex-col justify-between">
                <div className="space-y-4">
                  {/* Patient Header */}
                  <div className="flex flex-wrap items-start justify-between gap-2 pb-3 border-b border-surface-200">
                    <div>
                      <h2 className="text-base font-semibold text-surface-900">
                        {patient.user.fullName}
                      </h2>
                      <p className="text-xs text-surface-500 mt-0.5">
                        {patient.nationality} • Passport: <span className="font-mono">{patient.passportNo || '—'}</span>
                      </p>
                      {patient.medicalCondition && (
                        <p className="text-xs font-medium text-surface-700 mt-1">
                          Condition: {patient.medicalCondition}
                        </p>
                      )}
                    </div>

                    <div className="flex flex-wrap items-center gap-1.5">
                      <UrgencyBadge level={patient.urgencyLevel} />
                      {patient.bloodGroup && (
                        <Badge variant="info" size="sm">
                          <Droplets className="w-3 h-3" /> {patient.bloodGroup}
                        </Badge>
                      )}
                    </div>
                  </div>

                  {/* Clinical Safety Alerts */}
                  <div className="space-y-2.5 text-xs">
                    <div
                      className={`p-3 rounded-md border ${
                        allergies.length > 0
                          ? 'bg-danger-50/70 border-danger-200 text-danger-900'
                          : 'bg-surface-50 border-surface-200 text-surface-600'
                      }`}
                    >
                      <p className="font-semibold flex items-center gap-1.5 mb-1">
                        <AlertTriangle
                          className={`w-3.5 h-3.5 ${
                            allergies.length > 0 ? 'text-danger-600' : 'text-surface-400'
                          }`}
                        />
                        Allergies
                      </p>
                      {allergies.length > 0 ? (
                        <div className="flex flex-wrap gap-1.5">
                          {allergies.map((allergy, idx) => (
                            <span
                              key={`${patient.id}-allergy-${idx}`}
                              className="px-2 py-0.5 rounded bg-danger-100 text-danger-800 border border-danger-200 font-medium"
                            >
                              {allergy}
                            </span>
                          ))}
                        </div>
                      ) : (
                        <span className="text-surface-500">No known allergies reported</span>
                      )}
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                      <div className="p-2.5 rounded-md bg-surface-50 border border-surface-200">
                        <p className="font-medium text-surface-700 flex items-center gap-1.5 mb-1">
                          <HeartPulse className="w-3.5 h-3.5 text-surface-500" />
                          Chronic
                        </p>
                        <p className="text-surface-600">
                          {chronicConditions.length > 0 ? chronicConditions.join(', ') : 'None listed'}
                        </p>
                      </div>

                      <div className="p-2.5 rounded-md bg-surface-50 border border-surface-200">
                        <p className="font-medium text-surface-700 flex items-center gap-1.5 mb-1">
                          <Pill className="w-3.5 h-3.5 text-surface-500" />
                          Medications
                        </p>
                        <p className="text-surface-600">
                          {medications.length > 0 ? medications.join(', ') : 'None listed'}
                        </p>
                      </div>

                      <div className="p-2.5 rounded-md bg-surface-50 border border-surface-200">
                        <p className="font-medium text-surface-700 flex items-center gap-1.5 mb-1">
                          <Scissors className="w-3.5 h-3.5 text-surface-500" />
                          Prior surgeries
                        </p>
                        <p className="text-surface-600">
                          {surgeries.length > 0 ? surgeries.join(', ') : 'None listed'}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Active Cases */}
                <div className="pt-3 border-t border-surface-200 space-y-2">
                  <p className="text-xs font-medium text-surface-500">
                    Active clinical cases ({activeCases.length})
                  </p>
                  {activeCases.length === 0 ? (
                    <p className="text-xs text-surface-400">No open cases linked to this patient.</p>
                  ) : (
                    <div className="space-y-2">
                      {activeCases.map((c) => (
                        <div
                          key={c.id}
                          className="flex flex-wrap items-center justify-between gap-2 p-2.5 rounded-md bg-surface-50 border border-surface-200"
                        >
                          <div className="flex flex-wrap items-center gap-1.5">
                            <CaseStatusBadge status={c.status} />
                            {c.isUrgent && (
                              <Badge variant="danger" size="sm">
                                Urgent
                              </Badge>
                            )}
                            {c.fitToFlyClearance?.isCleared && (
                              <Badge variant="success" size="sm">
                                <Plane className="w-3 h-3" /> Cleared
                              </Badge>
                            )}
                          </div>
                          <Link href={`/doctor/cases/${c.id}`}>
                            <Button size="sm" variant="secondary">
                              Open Case <ArrowRight className="w-3.5 h-3.5" />
                            </Button>
                          </Link>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
