'use client';

/**
 * MediRoute India — Manager Patient Cohort Dashboard
 * Cohort roster list and full medical dossier details viewer.
 */

import { useState, useEffect } from 'react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';

interface Document {
  id: string;
  fileName: string;
  fileUrl: string;
  fileSize: number;
  category: string;
  createdAt: string;
}

interface Case {
  id: string;
  status: string;
  isUrgent: boolean;
  createdAt: string;
}

interface MedicalProfile {
  id: string;
  allergies: string[] | string | null;
  medications: unknown[] | string | null;
  surgeries: unknown[] | string | null;
  chronicConditions: string[] | string | null;
  specialisationsRequired: string[] | string | null;
}

interface EmergencyContact {
  name?: string;
  relation?: string;
  phone?: string;
}

interface Patient {
  id: string;
  nationality: string;
  passportNo: string;
  dob: string;
  bloodGroup: string | null;
  medicalCondition: string | null;
  urgencyLevel: string;
  primaryLanguage: string | null;
  emergencyContact: EmergencyContact | null;
  user: {
    fullName: string;
    email: string;
    phone: string | null;
  };
  medicalProfile: MedicalProfile | null;
  cases: Case[];
  documents: Document[];
}

export default function PatientsRoster() {
  const [patients, setPatients] = useState<Patient[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedPatient, setSelectedPatient] = useState<Patient | null>(null);

  useEffect(() => {
    async function loadPatients() {
      try {
        const res = await fetch('/api/v1/manager/patients');
        if (res.ok) {
          const data = await res.json();
          setPatients(data.patients);
        }
      } catch (err) {
        console.error('Failed to load patients:', err);
      } finally {
        setLoading(false);
      }
    }
    loadPatients();
  }, []);

  const formatJSONList = (field: unknown): string[] => {
    if (!field) return [];
    if (Array.isArray(field)) return field as string[];
    try {
      if (typeof field === 'string') {
        const parsed = JSON.parse(field);
        return Array.isArray(parsed) ? parsed : [];
      }
    } catch {
      // ignore
    }
    return [];
  };

  const formatJSONMedications = (
    field: unknown
  ): { name: string; dosage?: string; frequency?: string }[] => {
    if (!field) return [];
    if (Array.isArray(field))
      return field as { name: string; dosage?: string; frequency?: string }[];
    try {
      if (typeof field === 'string') {
        const parsed = JSON.parse(field);
        return Array.isArray(parsed) ? parsed : [];
      }
    } catch {
      // ignore
    }
    return [];
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-4 border-primary-600 border-t-transparent rounded-full animate-spin" />
          <span className="text-sm font-medium text-surface-500">Loading patient roster...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in relative min-h-[500px]">
      <div>
        <h1 className="text-2xl font-bold text-surface-900">Patient Cohort</h1>
        <p className="text-sm text-surface-500 mt-1">Roster of medical travelers assigned to your operational care portfolio.</p>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6 items-start">
        {/* Patients Table List */}
        <div className="xl:col-span-2">
          <Card className="bg-white overflow-hidden border border-surface-200/80">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-sm">
                <thead>
                  <tr className="bg-surface-50 border-b border-surface-200/60">
                    <th className="px-6 py-4 font-semibold text-surface-700">Patient Name</th>
                    <th className="px-6 py-4 font-semibold text-surface-700">Nationality</th>
                    <th className="px-6 py-4 font-semibold text-surface-700">Language</th>
                    <th className="px-6 py-4 font-semibold text-surface-700">Urgency</th>
                    <th className="px-6 py-4 font-semibold text-surface-700 text-center">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-surface-200/50">
                  {patients.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="px-6 py-8 text-center text-surface-400">
                        No assigned patients in your care roster.
                      </td>
                    </tr>
                  ) : (
                    patients.map((patient) => (
                      <tr
                        key={patient.id}
                        className={`hover:bg-surface-50/50 cursor-pointer transition-colors ${
                          selectedPatient?.id === patient.id ? 'bg-primary-50/20' : ''
                        }`}
                        onClick={() => setSelectedPatient(patient)}
                      >
                        <td className="px-6 py-4">
                          <p className="font-semibold text-surface-900">{patient.user.fullName}</p>
                          <p className="text-xs text-surface-500">{patient.user.email}</p>
                        </td>
                        <td className="px-6 py-4 text-surface-600 font-medium">{patient.nationality}</td>
                        <td className="px-6 py-4 text-surface-600">{patient.primaryLanguage || '—'}</td>
                        <td className="px-6 py-4">
                          <span
                            className={`px-2 py-0.5 text-xs font-bold rounded-full ${
                              patient.urgencyLevel === 'URGENT'
                                ? 'bg-red-50 text-red-700 border border-red-200'
                                : patient.urgencyLevel === 'SEMI_URGENT'
                                ? 'bg-amber-50 text-amber-700 border border-amber-200'
                                : 'bg-primary-50 text-primary-700 border border-primary-200'
                            }`}
                          >
                            {patient.urgencyLevel}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-center">
                          <Button size="sm" variant="ghost" onClick={() => setSelectedPatient(patient)}>
                            View Files & Medicals
                          </Button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </Card>
        </div>

        {/* Patient Detail Profile Panel */}
        <div className="xl:col-span-1">
          {selectedPatient ? (
            <Card className="bg-white border border-surface-200/80 p-6 space-y-6 animate-slide-up sticky top-6">
              {/* Profile Header */}
              <div className="flex items-center gap-3 pb-4 border-b border-surface-100">
                <div className="w-12 h-12 rounded-full bg-primary-100 text-primary-700 flex items-center justify-center font-bold text-lg">
                  {selectedPatient.user.fullName.charAt(0)}
                </div>
                <div>
                  <h3 className="font-bold text-surface-900 text-base leading-tight">
                    {selectedPatient.user.fullName}
                  </h3>
                  <p className="text-xs text-surface-500">{selectedPatient.user.email}</p>
                  {selectedPatient.user.phone && <p className="text-xs text-surface-500">{selectedPatient.user.phone}</p>}
                </div>
              </div>

              {/* Personal details */}
              <div className="space-y-3">
                <h4 className="text-xs font-bold text-surface-400 uppercase tracking-widest">Travel & Vital Data</h4>
                <div className="grid grid-cols-2 gap-3 text-xs">
                  <div className="bg-surface-50 p-2.5 rounded border border-surface-200/30">
                    <p className="text-surface-400 font-medium">DOB</p>
                    <p className="font-semibold text-surface-900 mt-0.5">
                      {new Date(selectedPatient.dob).toLocaleDateString(undefined, {
                        year: 'numeric',
                        month: 'short',
                        day: 'numeric',
                      })}
                    </p>
                  </div>
                  <div className="bg-surface-50 p-2.5 rounded border border-surface-200/30">
                    <p className="text-surface-400 font-medium">Blood Group</p>
                    <p className="font-semibold text-surface-900 mt-0.5">{selectedPatient.bloodGroup || '—'}</p>
                  </div>
                </div>
              </div>

              {/* Emergency Contact */}
              <div className="space-y-2">
                <h4 className="text-xs font-bold text-surface-400 uppercase tracking-widest">Emergency Contact</h4>
                {selectedPatient.emergencyContact ? (
                  <div className="p-3 bg-surface-50 rounded border border-surface-200/40 text-xs space-y-1">
                    <p className="font-semibold text-surface-900">
                      {selectedPatient.emergencyContact.name || '—'}
                    </p>
                    <p className="text-surface-600">
                      Relation: {selectedPatient.emergencyContact.relation || '—'}
                    </p>
                    <p className="text-surface-600 font-mono">
                      Phone: {selectedPatient.emergencyContact.phone || '—'}
                    </p>
                  </div>
                ) : (
                  <p className="text-xs text-surface-400">No emergency contact registered.</p>
                )}
              </div>

              {/* Medical Profile Chips */}
              <div className="space-y-4 pt-2 border-t border-surface-100">
                <h4 className="text-xs font-bold text-surface-400 uppercase tracking-widest">Medical History Dossier</h4>
                
                {/* Allergies */}
                <div className="space-y-1">
                  <p className="text-xs font-semibold text-surface-700">Allergies</p>
                  <div className="flex flex-wrap gap-1">
                    {formatJSONList(selectedPatient.medicalProfile?.allergies).length === 0 ? (
                      <span className="text-xs text-surface-400">None declared</span>
                    ) : (
                      formatJSONList(selectedPatient.medicalProfile?.allergies).map((item) => (
                        <span key={item} className="bg-red-50 text-red-700 border border-red-100 text-[10px] px-2 py-0.5 rounded font-semibold">
                          {item}
                        </span>
                      ))
                    )}
                  </div>
                </div>

                {/* Chronic conditions */}
                <div className="space-y-1">
                  <p className="text-xs font-semibold text-surface-700">Chronic Conditions</p>
                  <div className="flex flex-wrap gap-1">
                    {formatJSONList(selectedPatient.medicalProfile?.chronicConditions).length === 0 ? (
                      <span className="text-xs text-surface-400">None declared</span>
                    ) : (
                      formatJSONList(selectedPatient.medicalProfile?.chronicConditions).map((item) => (
                        <span key={item} className="bg-amber-50 text-amber-700 border border-amber-100 text-[10px] px-2 py-0.5 rounded font-semibold">
                          {item}
                        </span>
                      ))
                    )}
                  </div>
                </div>

                {/* Active medications */}
                <div className="space-y-1.5">
                  <p className="text-xs font-semibold text-surface-700">Current Medications</p>
                  {formatJSONMedications(selectedPatient.medicalProfile?.medications).length === 0 ? (
                    <p className="text-xs text-surface-400">None listed</p>
                  ) : (
                    <div className="space-y-1">
                      {formatJSONMedications(selectedPatient.medicalProfile?.medications).map((med, idx) => (
                        <div key={idx} className="bg-surface-50 p-2 rounded border border-surface-200/20 text-xs flex justify-between">
                          <span className="font-semibold text-surface-800">{med.name}</span>
                          <span className="text-surface-500">{med.dosage} ({med.frequency})</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Document vault */}
              <div className="space-y-2 pt-4 border-t border-surface-100">
                <h4 className="text-xs font-bold text-surface-400 uppercase tracking-widest">Document Vault</h4>
                {selectedPatient.documents.length === 0 ? (
                  <p className="text-xs text-surface-400">No medical reports uploaded.</p>
                ) : (
                  <div className="space-y-1.5">
                    {selectedPatient.documents.map((doc) => (
                      <div key={doc.id} className="flex items-center justify-between p-2.5 bg-surface-50 border border-surface-200/40 rounded text-xs">
                        <div className="min-w-0 flex-1 mr-2">
                          <p className="font-semibold text-surface-800 truncate">{doc.fileName}</p>
                          <p className="text-[10px] text-surface-400 uppercase">{doc.category}</p>
                        </div>
                        <a
                          href={doc.fileUrl}
                          download
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-primary-600 hover:text-primary-800 font-semibold"
                        >
                          Download
                        </a>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </Card>
          ) : (
            <Card className="bg-surface-50/50 border border-dashed border-surface-300 text-center py-20 px-6 rounded-lg sticky top-6">
              <svg className="w-10 h-10 text-surface-300 mx-auto mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 9h3.75M15 12h3.75M15 15h3.75M4.5 19.5h15a2.25 2.25 0 002.25-2.25V6.75A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25v10.5A2.25 2.25 0 004.5 19.5zm6-10.125a1.875 1.875 0 11-3.75 0 1.875 1.875 0 013.75 0zm1.294 6.336a6.721 6.721 0 01-3.17.789 6.721 6.721 0 01-3.168-.789 3.376 3.376 0 016.338 0z" />
              </svg>
              <h3 className="text-sm font-semibold text-surface-700 mb-1">No Patient Selected</h3>
              <p className="text-xs text-surface-400 max-w-xs mx-auto">
                Select a patient record from the cohort list to review their emergency details, medical profiles, and vault uploads.
              </p>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
