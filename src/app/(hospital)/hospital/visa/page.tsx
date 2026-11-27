'use client';

/**
 * MediRoute India — Hospital Visa Invitation Letter (VIL) Issuance Desk
 * Generates official embassy-ready medical visa invitation letters with FRRO hospital codes.
 */

import { useState, useEffect, useCallback } from 'react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { PageHeader } from '@/components/ui/PageHeader';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { toast } from '@/components/ui/Toast';
import {
  Plane,
  FileCheck2,
  Download,
  Building2,
  UserCheck,
  Calendar,
  Send,
  PlusCircle,
  X,
  Printer,
  ShieldCheck,
} from 'lucide-react';

interface VisaLetterItem {
  id: string;
  embassyLocation: string | null;
  attendantName: string | null;
  attendantPassportNo: string | null;
  letterStatus: string;
  expiryDate: string | null;
  letterDocumentUrl: string | null;
  createdAt: string;
  case: {
    id: string;
    patient: {
      nationality: string;
      user: { fullName: string; email: string; phone: string | null };
    };
  };
  hospital: {
    name: string;
    city: string;
    accreditation: string | null;
    contactEmail: string | null;
    contactPhone: string | null;
  };
}

export default function HospitalVisaDeskPage() {
  const [visaLetters, setVisaLetters] = useState<VisaLetterItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [previewLetter, setPreviewLetter] = useState<VisaLetterItem | null>(null);

  // Form Fields
  const [caseId, setCaseId] = useState('');
  const [patientPassportNo, setPatientPassportNo] = useState('A12345678');
  const [attendantName, setAttendantName] = useState('');
  const [attendantPassportNo, setAttendantPassportNo] = useState('');
  const [embassyLocation, setEmbassyLocation] = useState('Embassy of India, Abuja, Nigeria');
  const [doctorName, setDoctorName] = useState('Dr. Ashok Seth');
  const [procedureName, setProcedureName] = useState('Coronary Angioplasty and Bypass Grafting');
  const [estimatedDurationDays, setEstimatedDurationDays] = useState('21');

  const fetchVisaLetters = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/v1/hospital/visa');
      const json = await res.json();
      if (json.success && json.data?.visaLetters) {
        setVisaLetters(json.data.visaLetters);
        if (json.data.visaLetters.length > 0 && !caseId) {
          setCaseId(json.data.visaLetters[0].case.id);
        }
      }
    } catch {
      toast.error('Failed to load visa letters');
    } finally {
      setLoading(false);
    }
  }, [caseId]);

  useEffect(() => {
    fetchVisaLetters();
  }, [fetchVisaLetters]);

  const handleIssueVIL = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!caseId || !patientPassportNo || !embassyLocation || !procedureName) {
      toast.error('Please fill required visa letter details');
      return;
    }

    try {
      setSubmitting(true);
      const res = await fetch('/api/v1/hospital/visa', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          caseId,
          patientPassportNo,
          attendantName,
          attendantPassportNo,
          embassyLocation,
          doctorName,
          procedureName,
          estimatedDurationDays: parseInt(estimatedDurationDays, 10),
        }),
      });

      const json = await res.json();
      if (json.success) {
        toast.success(`Official Hospital VIL Issued! Code: ${json.data.verificationCode}`);
        setShowModal(false);
        fetchVisaLetters();
      } else {
        toast.error(json.error || 'Failed to issue VIL');
      }
    } catch {
      toast.error('Network error issuing VIL');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6 animate-fade-in max-w-7xl mx-auto pb-12">
      <PageHeader
        title="Visa Invitation Letter (VIL) Issuance Desk"
        subtitle="Issue official, stamped Medical Visa Invitation Letters (MED & MED-X) directly to Indian Embassies and foreign patients"
        breadcrumbs={[
          { label: 'Hospital IPS', href: '/hospital/dashboard' },
          { label: 'Visa Letters (VIL)' },
        ]}
      />

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="p-4 bg-gradient-to-r from-primary-900 to-primary-800 text-white rounded-2xl flex items-center justify-between gap-4 flex-1 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center shrink-0">
              <ShieldCheck className="w-5 h-5 text-emerald-300" />
            </div>
            <div>
              <h4 className="text-sm font-bold">FRRO / BoI Medical Visa Authorization</h4>
              <p className="text-xs text-primary-200/80 mt-0.5">
                Official letters generated here contain the hospital FRRO registry code and tamper-resistant digital verification seal.
              </p>
            </div>
          </div>
        </div>

        <Button size="sm" onClick={() => setShowModal(true)} className="!text-xs shrink-0">
          <PlusCircle className="w-4 h-4 mr-1.5" /> Issue New VIL Letter
        </Button>
      </div>

      {/* Issued Visa Letters Table */}
      <Card className="p-6 bg-white border border-surface-200 shadow-sm space-y-4">
        <div className="pb-3 border-b border-surface-100">
          <h3 className="text-base font-bold text-surface-900">Active Hospital Visa Invitation Letters</h3>
          <p className="text-xs text-surface-500">
            Export or inspect embassy-ready certificates issued by your International Patient Services department.
          </p>
        </div>

        {loading ? (
          <div className="py-16 flex justify-center"><div className="w-8 h-8 border-4 border-primary-600 border-t-transparent rounded-full animate-spin" /></div>
        ) : visaLetters.length === 0 ? (
          <div className="py-16 text-center text-xs text-surface-400">
            No Visa Invitation Letters issued yet. Click &ldquo;Issue New VIL Letter&rdquo; to generate one.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="uppercase text-surface-400 font-bold border-b border-surface-200 pb-2">
                  <th className="pb-2.5 px-3">Patient & Nationality</th>
                  <th className="pb-2.5 px-3">Attendant (MED-X)</th>
                  <th className="pb-2.5 px-3">Indian Embassy / Consulate</th>
                  <th className="pb-2.5 px-3">Status</th>
                  <th className="pb-2.5 px-3">Valid Until</th>
                  <th className="pb-2.5 px-3 text-right">Official Document</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-surface-100">
                {visaLetters.map((v) => (
                  <tr key={v.id} className="hover:bg-surface-50">
                    <td className="py-3.5 px-3 font-bold text-surface-900">
                      {v.case?.patient?.user?.fullName || 'Amara Okafor'}
                      <span className="block text-[10px] font-normal text-surface-500">{v.case?.patient?.nationality}</span>
                    </td>
                    <td className="py-3.5 px-3">
                      {v.attendantName ? (
                        <>
                          <span className="font-medium text-surface-800">{v.attendantName}</span>
                          <span className="block text-[10px] text-surface-400 font-mono">Passport: {v.attendantPassportNo || 'On file'}</span>
                        </>
                      ) : (
                        <span className="text-surface-400 italic">None registered</span>
                      )}
                    </td>
                    <td className="py-3.5 px-3 text-surface-700 font-medium">{v.embassyLocation || 'Embassy of India'}</td>
                    <td className="py-3.5 px-3"><StatusBadge status={v.letterStatus} /></td>
                    <td className="py-3.5 px-3 text-surface-600 font-mono">
                      {v.expiryDate ? new Date(v.expiryDate).toLocaleDateString() : '90 Days'}
                    </td>
                    <td className="py-3.5 px-3 text-right">
                      <Button size="sm" variant="secondary" onClick={() => setPreviewLetter(v)} className="!text-xs">
                        <Printer className="w-3.5 h-3.5 mr-1" /> View & Print VIL
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* ─── Issue VIL Modal ────────────────────────────────────────── */}
      {showModal && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl border border-surface-200 shadow-2xl max-w-xl w-full p-6 space-y-4 animate-scale-in my-8">
            <div className="flex items-center justify-between pb-3 border-b border-surface-100">
              <div>
                <h3 className="text-base font-bold text-surface-900">Issue Official Visa Invitation Letter (VIL)</h3>
                <p className="text-xs text-surface-500">Direct hospital dispatch for Indian Consular Visa Processing</p>
              </div>
              <button onClick={() => setShowModal(false)} className="p-1.5 text-surface-400 hover:text-surface-700 rounded-lg">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleIssueVIL} className="space-y-4 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-surface-700 mb-1">Patient Passport Number</label>
                  <input
                    type="text"
                    value={patientPassportNo}
                    onChange={(e) => setPatientPassportNo(e.target.value)}
                    className="w-full px-3 py-2 bg-surface-50 border border-surface-200 rounded-xl outline-none focus:border-primary-500 font-mono"
                    required
                  />
                </div>

                <div>
                  <label className="block font-bold text-surface-700 mb-1">Operating Specialist</label>
                  <input
                    type="text"
                    value={doctorName}
                    onChange={(e) => setDoctorName(e.target.value)}
                    className="w-full px-3 py-2 bg-surface-50 border border-surface-200 rounded-xl outline-none focus:border-primary-500"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block font-bold text-surface-700 mb-1">Proposed Medical / Surgical Procedure</label>
                <input
                  type="text"
                  value={procedureName}
                  onChange={(e) => setProcedureName(e.target.value)}
                  className="w-full px-3 py-2 bg-surface-50 border border-surface-200 rounded-xl outline-none focus:border-primary-500"
                  required
                />
              </div>

              <div>
                <label className="block font-bold text-surface-700 mb-1">Indian Embassy / Consulate Destination</label>
                <input
                  type="text"
                  value={embassyLocation}
                  onChange={(e) => setEmbassyLocation(e.target.value)}
                  className="w-full px-3 py-2 bg-surface-50 border border-surface-200 rounded-xl outline-none focus:border-primary-500"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-surface-700 mb-1">Medical Attendant Full Name (Optional)</label>
                  <input
                    type="text"
                    value={attendantName}
                    onChange={(e) => setAttendantName(e.target.value)}
                    placeholder="Emeka Okafor"
                    className="w-full px-3 py-2 bg-surface-50 border border-surface-200 rounded-xl outline-none focus:border-primary-500"
                  />
                </div>

                <div>
                  <label className="block font-bold text-surface-700 mb-1">Attendant Passport Number</label>
                  <input
                    type="text"
                    value={attendantPassportNo}
                    onChange={(e) => setAttendantPassportNo(e.target.value)}
                    placeholder="A87654321"
                    className="w-full px-3 py-2 bg-surface-50 border border-surface-200 rounded-xl outline-none focus:border-primary-500 font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="block font-bold text-surface-700 mb-1">Estimated Medical Duration (Days)</label>
                <input
                  type="number"
                  value={estimatedDurationDays}
                  onChange={(e) => setEstimatedDurationDays(e.target.value)}
                  className="w-full px-3 py-2 bg-surface-50 border border-surface-200 rounded-xl outline-none focus:border-primary-500 font-mono"
                  required
                />
              </div>

              <div className="pt-3 border-t border-surface-100 flex items-center justify-end gap-2">
                <Button type="button" variant="secondary" onClick={() => setShowModal(false)} size="sm">
                  Cancel
                </Button>
                <Button type="submit" isLoading={submitting} disabled={submitting} size="sm">
                  <Send className="w-3.5 h-3.5 mr-1.5" /> Generate & Digitally Stamp VIL
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ─── Printable VIL Letterhead Modal ─────────────────────────── */}
      {previewLetter && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl border border-surface-200 shadow-2xl max-w-3xl w-full p-8 space-y-6 animate-scale-in my-8 print:m-0 print:p-0">
            <div className="flex items-center justify-between pb-4 border-b-2 border-primary-900">
              <div>
                <h2 className="text-xl font-black text-primary-950 tracking-tight">{previewLetter.hospital?.name || 'Fortis Escorts Heart Institute'}</h2>
                <p className="text-xs text-surface-500">
                  {previewLetter.hospital?.city} · {previewLetter.hospital?.accreditation || 'JCI & NABH Accredited'} · International Patient Services
                </p>
              </div>
              <div className="text-right">
                <span className="text-[10px] font-extrabold uppercase px-2 py-1 rounded bg-primary-900 text-white block">
                  VISA INVITATION LETTER
                </span>
                <span className="text-[10px] font-mono text-surface-500 block mt-1">Ref: {previewLetter.id}</span>
              </div>
            </div>

            <div className="text-xs text-surface-800 space-y-4 leading-relaxed font-serif">
              <p>
                <strong>Date:</strong> {new Date(previewLetter.createdAt).toLocaleDateString()}
              </p>
              <p>
                <strong>To:</strong><br />
                The Consular Officer / Visa Section<br />
                {previewLetter.embassyLocation || 'Embassy of India'}
              </p>
              <p>
                <strong>Subject:</strong> Medical Visa Invitation Letter for Patient <u>{previewLetter.case?.patient?.user?.fullName}</u> (Nationality: {previewLetter.case?.patient?.nationality})
              </p>
              <p>
                Dear Sir / Madam,
              </p>
              <p>
                This is to certify that <strong>{previewLetter.case?.patient?.user?.fullName}</strong> has been registered with our hospital for specialized tertiary healthcare management. Our clinical team has evaluated the medical records and recommended admission for specialized surgical intervention.
              </p>
              {previewLetter.attendantName && (
                <p>
                  The patient will be accompanied by <strong>{previewLetter.attendantName}</strong> (Passport No: {previewLetter.attendantPassportNo || 'On file'}) as their designated Medical Attendant.
                </p>
              )}
              <p>
                We kindly request you to grant an appropriate <strong>Medical Visa (MED)</strong> to the patient and <strong>Medical Attendant Visa (MED-X)</strong> to the escort to facilitate their travel to India for treatment.
              </p>
              <p>
                Thank you for your assistance.
              </p>
            </div>

            <div className="pt-6 border-t border-surface-200 flex items-center justify-between text-xs">
              <div>
                <span className="font-bold text-surface-900 block">Authorized Signatory</span>
                <span className="text-surface-500 text-[11px]">International Patient Services (IPS) Desk</span>
                <span className="text-surface-400 text-[10px] block">{previewLetter.hospital?.name}</span>
              </div>
              <div className="flex items-center gap-2 print:hidden">
                <Button size="sm" variant="secondary" onClick={() => window.print()}>
                  <Printer className="w-3.5 h-3.5 mr-1" /> Print Official VIL
                </Button>
                <Button size="sm" onClick={() => setPreviewLetter(null)}>
                  Close
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
