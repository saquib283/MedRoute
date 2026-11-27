'use client';

/**
 * Afzal Healthcare — Manager Patient Cohort Dashboard
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

interface MedicationEntry {
  name?: string;
  dosage?: string;
  frequency?: string;
}

interface SurgeryEntry {
  name?: string;
  date?: string;
  notes?: string;
}

interface EmergencyContact {
  name?: string;
  relation?: string;
  phone?: string;
}

interface MedicalProfile {
  id: string;
  allergies: string[] | string | null;
  medications: MedicationEntry[] | string | null;
  surgeries: SurgeryEntry[] | string | null;
  chronicConditions: string[] | string | null;
  specialisationsRequired: string[] | string | null;
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
    if (Array.isArray(field)) return field.map(String);
    try {
      if (typeof field === 'string') {
        const parsed: unknown = JSON.parse(field);
        return Array.isArray(parsed) ? parsed.map(String) : [];
      }
    } catch {
      // ignore
    }
    return [];
  };

  const formatJSONMedications = (field: unknown): MedicationEntry[] => {
    if (!field) return [];
    if (Array.isArray(field)) return field as MedicationEntry[];
    try {
      if (typeof field === 'string') {
        const parsed: unknown = JSON.parse(field);
        return Array.isArray(parsed) ? (parsed as MedicationEntry[]) : [];
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
          <div className="w-7 h-7 border-2 border-primary-600 border-t-transparent rounded-full animate-spin" />
          <span className="text-xs font-medium text-surface-500">Loading patient roster...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-5 border-b border-surface-200">
        <div>
          <h1 className="text-xl font-semibold tracking-tight text-surface-900">Patient Cohort</h1>
          <p className="text-xs sm:text-sm text-surface-500 mt-1">
            Roster of medical travelers assigned to your operational care portfolio.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6 items-start">
        {/* Patients Table List */}
        <div className="xl:col-span-2">
          <Card className="!p-0 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-surface-50 border-b border-surface-200">
                    <th className="px-5 py-3 text-[11px] font-medium uppercase tracking-wide text-surface-500">Patient Name</th>
                    <th className="px-5 py-3 text-[11px] font-medium uppercase tracking-wide text-surface-500">Nationality</th>
                    <th className="px-5 py-3 text-[11px] font-medium uppercase tracking-wide text-surface-500">Language</th>
                    <th className="px-5 py-3 text-[11px] font-medium uppercase tracking-wide text-surface-500">Urgency</th>
                    <th className="px-5 py-3 text-[11px] font-medium uppercase tracking-wide text-surface-500 text-center">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-surface-200">
                  {patients.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="px-5 py-10 text-center text-xs text-surface-500">
                        No assigned patients in your care roster.
                      </td>
                    </tr>
                  ) : (
                    patients.map((patient) => (
                      <tr
                        key={patient.id}
                        className={`hover:bg-surface-50 cursor-pointer transition-colors ${
                          selectedPatient?.id === patient.id ? 'bg-primary-50/40' : ''
                        }`}
                        onClick={() => setSelectedPatient(patient)}
                      >
                        <td className="px-5 py-3.5">
                          <p className="text-sm font-semibold text-surface-900">{patient.user.fullName}</p>
                          <p className="text-xs text-surface-500">{patient.user.email}</p>
                        </td>
                        <td className="px-5 py-3.5 text-surface-700 font-medium">{patient.nationality}</td>
                        <td className="px-5 py-3.5 text-surface-600">{patient.primaryLanguage || '—'}</td>
                        <td className="px-5 py-3.5">
                          <span
                            className={`inline-flex items-center px-2 py-0.5 text-[11px] font-medium rounded border ${
                              patient.urgencyLevel === 'URGENT'
                                ? 'bg-red-50 text-red-700 border-red-200'
                                : patient.urgencyLevel === 'SEMI_URGENT'
                                ? 'bg-amber-50 text-amber-700 border-amber-200'
                                : 'bg-primary-50 text-primary-700 border-primary-200'
                            }`}
                          >
                            {patient.urgencyLevel}
                          </span>
                        </td>
                        <td className="px-5 py-3.5 text-center">
                          <Button size="sm" variant="ghost" onClick={() => setSelectedPatient(patient)}>
                            View Files &amp; Medicals
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
            <Card className="p-5 space-y-5 sticky top-6">
              {/* Profile Header */}
              <div className="flex items-center gap-3 pb-4 border-b border-surface-200">
                <div className="w-10 h-10 rounded-full bg-surface-100 text-surface-700 border border-surface-200 flex items-center justify-center font-semibold text-sm shrink-0">
                  {selectedPatient.user.fullName.charAt(0)}
                </div>
                <div className="min-w-0">
                  <h2 className="font-semibold text-surface-900 text-sm sm:text-base leading-tight truncate">
                    {selectedPatient.user.fullName}
                  </h2>
                  <p className="text-xs text-surface-500 truncate">{selectedPatient.user.email}</p>
                  {selectedPatient.user.phone && (
                    <p className="text-xs text-surface-500 tabular-nums">{selectedPatient.user.phone}</p>
                  )}
                </div>
              </div>

              {/* Personal details */}
              <div className="space-y-2.5">
                <h3 className="text-xs font-semibold text-surface-900">Travel &amp; Vital Data</h3>
                <div className="grid grid-cols-2 gap-3 text-xs">
                  <div className="bg-surface-50 p-3 rounded-md border border-surface-200">
                    <p className="text-surface-500 font-medium">DOB</p>
                    <p className="font-semibold text-surface-900 mt-0.5 tabular-nums">
                      {new Date(selectedPatient.dob).toLocaleDateString(undefined, {
                        year: 'numeric',
                        month: 'short',
                        day: 'numeric',
                      })}
                    </p>
                  </div>
                  <div className="bg-surface-50 p-3 rounded-md border border-surface-200">
                    <p className="text-surface-500 font-medium">Blood Group</p>
                    <p className="font-semibold text-surface-900 mt-0.5">{selectedPatient.bloodGroup || '—'}</p>
                  </div>
                </div>
              </div>

              {/* Emergency Contact */}
              <div className="space-y-2">
                <h3 className="text-xs font-semibold text-surface-900">Emergency Contact</h3>
                {selectedPatient.emergencyContact ? (
                  <div className="p-3 bg-surface-50 rounded-md border border-surface-200 text-xs space-y-1">
                    <p className="font-semibold text-surface-900">
                      {selectedPatient.emergencyContact.name || '—'}
                    </p>
                    <p className="text-surface-600">
                      Relation: {selectedPatient.emergencyContact.relation || '—'}
                    </p>
                    <p className="text-surface-600 font-mono tabular-nums">
                      Phone: {selectedPatient.emergencyContact.phone || '—'}
                    </p>
                  </div>
                ) : (
                  <p className="text-xs text-surface-500">No emergency contact registered.</p>
                )}
              </div>

              {/* Medical Profile Chips */}
              <div className="space-y-3.5 pt-4 border-t border-surface-200">
                <h3 className="text-xs font-semibold text-surface-900">Medical History Dossier</h3>

                {/* Allergies */}
                <div className="space-y-1">
                  <p className="text-xs font-medium text-surface-600">Allergies</p>
                  <div className="flex flex-wrap gap-1.5">
                    {formatJSONList(selectedPatient.medicalProfile?.allergies).length === 0 ? (
                      <span className="text-xs text-surface-500">None declared</span>
                    ) : (
                      formatJSONList(selectedPatient.medicalProfile?.allergies).map((item) => (
                        <span key={item} className="bg-red-50 text-red-700 border border-red-200 text-[11px] px-2 py-0.5 rounded font-medium">
                          {item}
                        </span>
                      ))
                    )}
                  </div>
                </div>

                {/* Chronic conditions */}
                <div className="space-y-1">
                  <p className="text-xs font-medium text-surface-600">Chronic Conditions</p>
                  <div className="flex flex-wrap gap-1.5">
                    {formatJSONList(selectedPatient.medicalProfile?.chronicConditions).length === 0 ? (
                      <span className="text-xs text-surface-500">None declared</span>
                    ) : (
                      formatJSONList(selectedPatient.medicalProfile?.chronicConditions).map((item) => (
                        <span key={item} className="bg-amber-50 text-amber-700 border border-amber-200 text-[11px] px-2 py-0.5 rounded font-medium">
                          {item}
                        </span>
                      ))
                    )}
                  </div>
                </div>

                {/* Active medications */}
                <div className="space-y-1.5">
                  <p className="text-xs font-medium text-surface-600">Current Medications</p>
                  {formatJSONMedications(selectedPatient.medicalProfile?.medications).length === 0 ? (
                    <p className="text-xs text-surface-500">None listed</p>
                  ) : (
                    <div className="space-y-1.5">
                      {formatJSONMedications(selectedPatient.medicalProfile?.medications).map((med, idx) => (
                        <div key={idx} className="bg-surface-50 p-2.5 rounded-md border border-surface-200 text-xs flex justify-between gap-2">
                          <span className="font-medium text-surface-800">{med.name}</span>
                          <span className="text-surface-500">{med.dosage} ({med.frequency})</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Document vault */}
              <div className="space-y-2 pt-4 border-t border-surface-200">
                <h3 className="text-xs font-semibold text-surface-900">Document Vault</h3>
                {selectedPatient.documents.length === 0 ? (
                  <p className="text-xs text-surface-500">No medical reports uploaded.</p>
                ) : (
                  <div className="space-y-1.5">
                    {selectedPatient.documents.map((doc) => (
                      <div key={doc.id} className="flex items-center justify-between p-2.5 bg-surface-50 border border-surface-200 rounded-md text-xs">
                        <div className="min-w-0 flex-1 mr-2">
                          <p className="font-medium text-surface-800 truncate">{doc.fileName}</p>
                          <p className="text-[11px] text-surface-500">{doc.category.replace(/_/g, ' ')}</p>
                        </div>
                        <a
                          href={doc.fileUrl}
                          download
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-primary-700 hover:text-primary-800 font-medium shrink-0"
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
            <Card className="bg-surface-50 border border-dashed border-surface-300 text-center py-16 px-6 shadow-none sticky top-6">
              <svg className="w-9 h-9 text-surface-400 mx-auto mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 9h3.75M15 12h3.75M15 15h3.75M4.5 19.5h15a2.25 2.25 0 002.25-2.25V6.75A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25v10.5A2.25 2.25 0 004.5 19.5zm6-10.125a1.875 1.875 0 11-3.75 0 1.875 1.875 0 013.75 0zm1.294 6.336a6.721 6.721 0 01-3.17.789 6.721 6.721 0 01-3.168-.789 3.376 3.376 0 016.338 0z" />
              </svg>
              <h2 className="text-sm font-semibold text-surface-700 mb-1">No Patient Selected</h2>
              <p className="text-xs text-surface-500 max-w-xs mx-auto">
                Select a patient record from the cohort list to review their emergency details, medical profiles, and vault uploads.
              </p>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
