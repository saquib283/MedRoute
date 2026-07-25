'use client';

/**
 * MediRoute India — Doctor Patients Directory
 * Displays a list of patients who have appointments with this doctor.
 */

import { useState, useEffect } from 'react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';

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
    medications: any[];
    surgeries: any[];
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
    <div className="max-w-6xl mx-auto space-y-8 animate-fade-in">
      <div>
        <h1 className="text-2xl font-bold text-surface-900 tracking-tight">Patient Directory</h1>
        <p className="text-sm text-surface-500 mt-1">Review profiles and medical histories of your assigned patients.</p>
      </div>

      {loading ? (
        <div className="flex items-center justify-center min-h-[300px]">
          <div className="w-8 h-8 border-4 border-primary-600 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {patients.length === 0 ? (
            <div className="col-span-full border border-dashed border-surface-200 rounded-lg p-12 text-center text-sm text-surface-500 bg-white">
              No patients assigned to you at the moment.
            </div>
          ) : (
            patients.map((p) => (
              <Card key={p.id} className="p-5 bg-white border border-surface-200 hover:shadow-md transition-shadow">
                <div className="flex justify-between items-start">
                  <div>
                    <h3 className="font-bold text-surface-900 text-lg">{p.user.fullName}</h3>
                    <p className="text-xs text-surface-500 mt-0.5">Nationality: {p.nationality} • DOB: {new Date(p.dob).toLocaleDateString()}</p>
                  </div>
                  <div className="w-10 h-10 rounded-full bg-primary-50 text-primary-600 flex items-center justify-center font-bold text-lg">
                    {p.user.fullName.charAt(0)}
                  </div>
                </div>

                <div className="mt-4 bg-surface-50 p-3 rounded-lg border border-surface-200">
                  <p className="text-xs text-surface-700 font-semibold mb-1">Primary Condition</p>
                  <p className="text-sm text-surface-900">{p.medicalCondition || 'Not specified'}</p>
                </div>

                <div className="mt-4 flex gap-2">
                  <Button className="w-full" onClick={() => setSelectedPatient(p)}>
                    View Medical Dossier
                  </Button>
                </div>
              </Card>
            ))
          )}
        </div>
      )}

      {/* Dossier Drawer / Modal */}
      {selectedPatient && (
        <div className="fixed inset-0 z-50 flex items-stretch justify-end bg-surface-900/40 backdrop-blur-xs">
          <div className="bg-white w-full max-w-md shadow-2xl animate-slide-left overflow-y-auto">
            <div className="p-6 border-b border-surface-100 flex items-center justify-between sticky top-0 bg-white/95 backdrop-blur z-10">
              <div>
                <h2 className="text-lg font-bold text-surface-900">{selectedPatient.user.fullName}</h2>
                <p className="text-xs text-surface-500">Medical Dossier</p>
              </div>
              <button onClick={() => setSelectedPatient(null)} className="p-2 -mr-2 text-surface-400 hover:text-surface-700 bg-surface-50 hover:bg-surface-100 rounded-full transition-colors">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>

            <div className="p-6 space-y-6">
              {/* Demographics */}
              <section>
                <h3 className="text-xs font-bold text-surface-400 uppercase tracking-wider mb-3">Demographics</h3>
                <div className="grid grid-cols-2 gap-4 text-sm">
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
                    <p className="font-semibold text-surface-900">{selectedPatient.bloodGroup || 'N/A'}</p>
                  </div>
                </div>
              </section>

              <hr className="border-surface-100" />

              {/* Medical Profile */}
              {selectedPatient.medicalProfile ? (
                <>
                  <section>
                    <h3 className="text-xs font-bold text-surface-400 uppercase tracking-wider mb-3">Allergies</h3>
                    {selectedPatient.medicalProfile.allergies && selectedPatient.medicalProfile.allergies.length > 0 ? (
                      <div className="flex flex-wrap gap-2">
                        {selectedPatient.medicalProfile.allergies.map((a: string, i: number) => (
                          <span key={i} className="px-2 py-1 bg-red-50 text-red-700 text-xs font-bold rounded border border-red-200">
                            {a}
                          </span>
                        ))}
                      </div>
                    ) : <p className="text-sm text-surface-500">None reported</p>}
                  </section>

                  <section>
                    <h3 className="text-xs font-bold text-surface-400 uppercase tracking-wider mb-3">Chronic Conditions</h3>
                    {selectedPatient.medicalProfile.chronicConditions && selectedPatient.medicalProfile.chronicConditions.length > 0 ? (
                      <ul className="list-disc pl-4 text-sm text-surface-700 space-y-1">
                        {selectedPatient.medicalProfile.chronicConditions.map((c: string, i: number) => (
                          <li key={i} className="font-medium">{c}</li>
                        ))}
                      </ul>
                    ) : <p className="text-sm text-surface-500">None reported</p>}
                  </section>

                  <section>
                    <h3 className="text-xs font-bold text-surface-400 uppercase tracking-wider mb-3">Current Medications</h3>
                    {selectedPatient.medicalProfile.medications && selectedPatient.medicalProfile.medications.length > 0 ? (
                      <div className="space-y-2">
                        {selectedPatient.medicalProfile.medications.map((m: any, i: number) => (
                          <div key={i} className="bg-surface-50 p-2.5 rounded border border-surface-200">
                            <p className="text-sm font-bold text-surface-900">{m.name}</p>
                            <p className="text-xs text-surface-500">{m.dosage} • {m.frequency}</p>
                          </div>
                        ))}
                      </div>
                    ) : <p className="text-sm text-surface-500">None reported</p>}
                  </section>

                  <section>
                    <h3 className="text-xs font-bold text-surface-400 uppercase tracking-wider mb-3">Past Surgeries</h3>
                    {selectedPatient.medicalProfile.surgeries && selectedPatient.medicalProfile.surgeries.length > 0 ? (
                      <div className="space-y-3">
                        {selectedPatient.medicalProfile.surgeries.map((s: any, i: number) => (
                          <div key={i} className="relative pl-4 border-l-2 border-surface-300">
                            <p className="text-sm font-bold text-surface-900">{s.name}</p>
                            <p className="text-xs text-surface-500">{s.date}</p>
                            {s.notes && <p className="text-xs text-surface-600 mt-1 italic">{s.notes}</p>}
                          </div>
                        ))}
                      </div>
                    ) : <p className="text-sm text-surface-500">No prior surgeries reported</p>}
                  </section>
                </>
              ) : (
                <p className="text-sm text-surface-500 text-center py-4">No detailed medical profile available.</p>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
