'use client';

/**
 * MediRoute India — Hospital Specialist Doctors Roster
 */

import { useState, useEffect, useCallback } from 'react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { PageHeader } from '@/components/ui/PageHeader';
import { toast } from '@/components/ui/Toast';
import {
  Stethoscope,
  GraduationCap,
  Calendar,
  CheckCircle2,
  DollarSign,
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
    fetchDoctors();
  }, [fetchDoctors]);

  return (
    <div className="space-y-6 animate-fade-in max-w-7xl mx-auto pb-12">
      <PageHeader
        title="Hospital Specialist Doctors Roster"
        subtitle="Empanelled super-specialist surgeons and physicians available for international patient teleconsultations and surgical procedures"
        breadcrumbs={[
          { label: 'Hospital IPS', href: '/hospital/dashboard' },
          { label: 'Doctor Specialists' },
        ]}
      />

      {loading ? (
        <div className="py-24 flex justify-center"><div className="w-10 h-10 border-4 border-primary-600 border-t-transparent rounded-full animate-spin" /></div>
      ) : doctors.length === 0 ? (
        <div className="p-12 text-center bg-white border border-surface-200 rounded-2xl text-surface-400">
          No doctors empanelled under this hospital.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {doctors.map((doc) => (
            <Card key={doc.id} className="p-5 bg-white border border-surface-200 rounded-2xl shadow-2xs space-y-3">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-11 h-11 rounded-full bg-primary-100 text-primary-800 font-bold flex items-center justify-center text-sm shrink-0">
                    <Stethoscope className="w-5 h-5 text-primary-700" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-surface-900">Dr. {doc.fullName}</h3>
                    <span className="text-xs font-semibold text-primary-700 block">
                      {doc.specialisation?.name || 'Super Specialist'}
                    </span>
                  </div>
                </div>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-success-50 text-success-800 border border-success-200">
                  Active Roster
                </span>
              </div>

              <div className="space-y-1.5 text-xs text-surface-600 pt-2 border-t border-surface-100">
                {doc.qualification && (
                  <div className="flex items-center gap-2">
                    <GraduationCap className="w-3.5 h-3.5 text-surface-400 shrink-0" />
                    <span>{doc.qualification}</span>
                  </div>
                )}
                <div className="flex items-center gap-2">
                  <DollarSign className="w-3.5 h-3.5 text-surface-400 shrink-0" />
                  <span>OPD Consult Fee: ₹{doc.consultationFee ? Number(doc.consultationFee).toLocaleString() : '2,500'}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Languages className="w-3.5 h-3.5 text-surface-400 shrink-0" />
                  <span>Languages: English, Hindi, Arabic (Interpreter)</span>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
