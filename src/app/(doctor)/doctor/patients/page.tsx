'use client';

/**
 * MediRoute India — Doctor Patients Directory
 * Displays a list of patients who have appointments with this doctor.
 */

import { useState, useEffect } from 'react';
import { Users } from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { PageHeader } from '@/components/ui/PageHeader';
import { EmptyState } from '@/components/ui/EmptyState';
import { Modal } from '@/components/ui/Modal';

interface Patient {
  id: string;
  nationality: string;
  dob: string;
  bloodGroup: string | null;
  medicalCondition: string | null;
  user: {
    fullName: string;
    email: string;
    phone: string | null;
  };
  medicalProfile: {
    allergies: string[];
    medications: { name: string; dosage?: string; frequency?: string }[];
    surgeries: { name: string; date?: string; notes?: string }[];
    chronicConditions: string[];
  } | null;
}

export default function DoctorPatientsPage() {
  const [patients, setPatients] = useState<Patient[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedPatient, setSelectedPatient] = useState<Patient | null>(null);

  useEffect(() => {
    async function fetchPatients() {
      try {
        const res = await fetch('/api/v1/doctor/patients');
        const data = await res.json();
        
        if (data.success) {
          setPatients(data.data.patients || []);
        }
      } catch (err) {
        console.error('Failed to load patients:', err);
      } finally {
        setLoading(false);
      }
    }

    fetchPatients();
  }, []);

  return (
    <div className="space-y-6 animate-fade-in">
      <PageHeader
        title="Patient Directory"
        subtitle="Assigned patient profiles and reported medical histories"
      />

      {loading ? (
        <div className="flex items-center justify-center min-h-[300px]">
          <div className="w-8 h-8 border-4 border-primary-600 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : patients.length === 0 ? (
        <Card>
          <EmptyState
            icon={<Users className="w-6 h-6" />}
            title="No assigned patients"
            description="Assigned patients will appear here once scheduled."
          />
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {patients.map((p) => (
            <Card key={p.id} className="p-5 flex flex-col">
              <div className="flex justify-between items-start gap-3">
                <div>
                  <h3 className="font-semibold text-surface-900 text-base">{p.user.fullName}</h3>
                  <p className="text-xs text-surface-500 mt-0.5">
                    {p.nationality} · DOB: {new Date(p.dob).toLocaleDateString()}
                  </p>
                </div>
                <div className="w-9 h-9 rounded-full bg-primary-50 text-primary-700 flex items-center justify-center font-bold text-sm shrink-0">
                  {p.user.fullName.charAt(0)}
                </div>
              </div>

              <div className="mt-4 bg-surface-50 p-3 rounded-lg border border-surface-200">
                <p className="text-xs text-surface-500 font-medium mb-0.5">Primary Condition</p>
                <p className="text-sm text-surface-900">{p.medicalCondition || 'Not specified'}</p>
              </div>

              <div className="mt-4 pt-3 border-t border-surface-200">
                <Button className="w-full" variant="secondary" size="sm" onClick={() => setSelectedPatient(p)}>
                  View Medical Dossier
                </Button>
              </div>
            </Card>
          ))}
        </div>
      )}

      <Modal
        open={Boolean(selectedPatient)}
        onClose={() => setSelectedPatient(null)}
        title={selectedPatient?.user.fullName || 'Patient Dossier'}
        subtitle="Medical Dossier"
        maxWidth="lg"
      >
        {selectedPatient && (
          <div className="space-y-6">
            <section>
              <h3 className="text-xs font-semibold text-surface-500 uppercase tracking-wider mb-3">Demographics</h3>
              <div className="grid grid-cols-3 gap-4 text-sm">
                <div>
                  <p className="text-surface-500 text-xs">Date of Birth</p>
                  <p className="font-semibold text-surface-900">{new Date(selectedPatient.dob).toLocaleDateString()}</p>
                </div>
                <div>
                  <p className="text-surface-500 text-xs">Nationality</p>
                  <p className="font-semibold text-surface-900">{selectedPatient.nationality}</p>
                </div>
                <div>
                  <p className="text-surface-500 text-xs">Blood Group</p>
                  <p className="font-semibold text-surface-900">{selectedPatient.bloodGroup || '—'}</p>
                </div>
              </div>
            </section>

            <hr className="border-surface-200" />

            {selectedPatient.medicalProfile ? (
              <div className="space-y-5">
                <section>
                  <h3 className="text-xs font-semibold text-surface-500 uppercase tracking-wider mb-2">Allergies</h3>
                  {selectedPatient.medicalProfile.allergies && selectedPatient.medicalProfile.allergies.length > 0 ? (
                    <div className="flex flex-wrap gap-1.5">
                      {selectedPatient.medicalProfile.allergies.map((a, i) => (
                        <Badge key={i} variant="danger" size="sm">{a}</Badge>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-surface-500">None reported</p>
                  )}
                </section>

                <section>
                  <h3 className="text-xs font-semibold text-surface-500 uppercase tracking-wider mb-2">Chronic Conditions</h3>
                  {selectedPatient.medicalProfile.chronicConditions && selectedPatient.medicalProfile.chronicConditions.length > 0 ? (
                    <ul className="list-disc pl-4 text-sm text-surface-700 space-y-1">
                      {selectedPatient.medicalProfile.chronicConditions.map((c, i) => (
                        <li key={i}>{c}</li>
                      ))}
                    </ul>
                  ) : (
                    <p className="text-sm text-surface-500">None reported</p>
                  )}
                </section>

                <section>
                  <h3 className="text-xs font-semibold text-surface-500 uppercase tracking-wider mb-2">Current Medications</h3>
                  {selectedPatient.medicalProfile.medications && selectedPatient.medicalProfile.medications.length > 0 ? (
                    <div className="space-y-2">
                      {selectedPatient.medicalProfile.medications.map((m, i) => (
                        <div key={i} className="bg-surface-50 p-2.5 rounded-lg border border-surface-200">
                          <p className="text-sm font-semibold text-surface-900">{m.name}</p>
                          <p className="text-xs text-surface-500">{m.dosage} · {m.frequency}</p>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-surface-500">None reported</p>
                  )}
                </section>

                <section>
                  <h3 className="text-xs font-semibold text-surface-500 uppercase tracking-wider mb-2">Past Surgeries</h3>
                  {selectedPatient.medicalProfile.surgeries && selectedPatient.medicalProfile.surgeries.length > 0 ? (
                    <div className="space-y-2.5">
                      {selectedPatient.medicalProfile.surgeries.map((s, i) => (
                        <div key={i} className="pl-3 border-l-2 border-surface-300">
                          <p className="text-sm font-semibold text-surface-900">{s.name}</p>
                          <p className="text-xs text-surface-500">{s.date}</p>
                          {s.notes && <p className="text-xs text-surface-600 mt-0.5">{s.notes}</p>}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-surface-500">No prior surgeries reported</p>
                  )}
                </section>
              </div>
            ) : (
              <p className="text-sm text-surface-500 text-center py-4">No detailed medical profile recorded.</p>
            )}
          </div>
        )}
      </Modal>
    </div>
  );
}
