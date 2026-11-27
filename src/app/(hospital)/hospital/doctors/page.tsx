'use client';

/**
 * MediRoute India — Hospital Specialist Doctors Roster
 */

import { useState, useEffect, useCallback } from 'react';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { PageHeader } from '@/components/ui/PageHeader';
import { EmptyState } from '@/components/ui/EmptyState';
import { PriceTag } from '@/components/ui/PriceTag';
import { toast } from '@/components/ui/Toast';
import {
  Stethoscope,
  GraduationCap,
  IndianRupee,
  Languages,
} from 'lucide-react';

interface DoctorItem {
  id: string;
  fullName: string;
  qualification: string | null;
  consultationFee: number | null;
  languages: string[] | null;
  availableDays: string[] | null;
  isActive: boolean;
  specialisation: {
    name: string;
    description: string | null;
  };
}

export default function HospitalDoctorsPage() {
  const [doctors, setDoctors] = useState<DoctorItem[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchDoctors = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/v1/hospital/doctors');
      const json = await res.json();
      if (json.success && json.data?.doctors) {
        setDoctors(json.data.doctors);
      }
    } catch {
      toast.error('Failed to load doctor roster');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    queueMicrotask(() => fetchDoctors());
  }, [fetchDoctors]);

  return (
    <div className="space-y-6 animate-fade-in">
      <PageHeader
        title="Specialist Roster"
        subtitle="Participating specialists available for international consultations and surgical reviews"
        breadcrumbs={[
          { label: 'Hospital IPS', href: '/hospital/dashboard' },
          { label: 'Specialist Roster' },
        ]}
      />

      {loading ? (
        <div className="py-24 flex justify-center"><div className="w-8 h-8 border-4 border-primary-600 border-t-transparent rounded-full animate-spin" /></div>
      ) : doctors.length === 0 ? (
        <Card>
          <EmptyState
            icon={<Stethoscope className="w-6 h-6" />}
            title="No specialists listed"
            description="Doctors assigned to this partner hospital will appear here."
          />
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {doctors.map((doc) => (
            <Card key={doc.id} className="p-5 space-y-3">
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-10 h-10 rounded-full bg-primary-50 text-primary-700 font-semibold flex items-center justify-center shrink-0">
                    <Stethoscope className="w-5 h-5" />
                  </div>
                  <div className="min-w-0">
                    <h3 className="text-sm font-semibold text-surface-900 truncate">Dr. {doc.fullName}</h3>
                    <span className="text-xs font-medium text-primary-700 block truncate">
                      {doc.specialisation?.name || 'Specialist'}
                    </span>
                  </div>
                </div>
                <Badge variant={doc.isActive ? 'success' : 'default'} size="sm">
                  {doc.isActive ? 'Active' : 'Inactive'}
                </Badge>
              </div>

              <div className="space-y-1.5 text-xs text-surface-600 pt-2.5 border-t border-surface-200">
                {doc.qualification && (
                  <div className="flex items-center gap-2">
                    <GraduationCap className="w-3.5 h-3.5 text-surface-400 shrink-0" />
                    <span>{doc.qualification}</span>
                  </div>
                )}
                <div className="flex items-center gap-2">
                  <IndianRupee className="w-3.5 h-3.5 text-surface-400 shrink-0" />
                  <span>
                    Consult Fee:{' '}
                    {doc.consultationFee != null ? (
                      <PriceTag amountInINR={doc.consultationFee} />
                    ) : (
                      'On request'
                    )}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <Languages className="w-3.5 h-3.5 text-surface-400 shrink-0" />
                  <span>
                    Languages:{' '}
                    {doc.languages && doc.languages.length > 0
                      ? doc.languages.join(', ')
                      : 'Not specified'}
                  </span>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
