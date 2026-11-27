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
import { EmptyState } from '@/components/ui/EmptyState';
import { Modal } from '@/components/ui/Modal';
import { toast } from '@/components/ui/Toast';
import {
  Plane,
  Send,
  PlusCircle,
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
  const [patientPassportNo, setPatientPassportNo] = useState('');
  const [attendantName, setAttendantName] = useState('');
  const [attendantPassportNo, setAttendantPassportNo] = useState('');
  const [embassyLocation, setEmbassyLocation] = useState('');
  const [doctorName, setDoctorName] = useState('');
  const [procedureName, setProcedureName] = useState('');
  const [estimatedDurationDays, setEstimatedDurationDays] = useState('21');

  const fetchVisaLetters = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/v1/hospital/visa');
      const json = await res.json();
      if (json.success && json.data?.visaLetters) {
        setVisaLetters(json.data.visaLetters);
        if (json.data.visaLetters.length > 0) {
          setCaseId((prev) => prev || json.data.visaLetters[0].case.id);
        }
      }
    } catch {
      toast.error('Failed to load visa letters');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    queueMicrotask(() => fetchVisaLetters());
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
    <div className="space-y-6 animate-fade-in">
      <PageHeader
        title="Visa Invitation Letters (VIL)"
        subtitle="Issue embassy-addressed Medical Visa (MED) and Medical Attendant Visa (MED-X) letters"
        breadcrumbs={[
          { label: 'Hospital IPS', href: '/hospital/dashboard' },
          { label: 'Visa Letters (VIL)' },
        ]}
        actions={
          <Button size="sm" onClick={() => setShowModal(true)}>
            <PlusCircle className="w-4 h-4" /> Issue New VIL
          </Button>
        }
      />

      <div className="p-4 bg-primary-50 border border-primary-200 rounded-xl flex items-start gap-3">
        <ShieldCheck className="w-5 h-5 text-primary-700 shrink-0 mt-0.5" />
        <div>
          <h2 className="text-sm font-semibold text-primary-950">FRRO / BoI Medical Visa Authorization</h2>
          <p className="text-xs text-primary-800 mt-0.5">
            Generated letters include the hospital registration details and a verifiable digital code.
          </p>
        </div>
      </div>

      {/* Issued Visa Letters Table */}
      <Card className="space-y-4">
        <div className="pb-3 border-b border-surface-200">
          <h2 className="text-base font-semibold text-surface-900">Issued Visa Invitation Letters</h2>
          <p className="text-xs text-surface-500">
            Inspect or print consular letters issued by your International Patient Services desk
          </p>
        </div>

        {loading ? (
          <div className="py-16 flex justify-center"><div className="w-8 h-8 border-4 border-primary-600 border-t-transparent rounded-full animate-spin" /></div>
        ) : visaLetters.length === 0 ? (
          <EmptyState
            icon={<Plane className="w-6 h-6" />}
            title="No visa invitation letters issued"
            description="Issue an invitation letter to begin a patient's Medical Visa application."
            action={
              <Button size="sm" onClick={() => setShowModal(true)}>
                <PlusCircle className="w-4 h-4" /> Issue New VIL
              </Button>
            }
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="uppercase text-surface-500 font-semibold border-b border-surface-200">
                  <th className="pb-2.5 px-3">Patient &amp; Nationality</th>
                  <th className="pb-2.5 px-3">Attendant (MED-X)</th>
                  <th className="pb-2.5 px-3">Indian Embassy / Consulate</th>
                  <th className="pb-2.5 px-3">Status</th>
                  <th className="pb-2.5 px-3">Valid Until</th>
                  <th className="pb-2.5 px-3 text-right">Document</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-surface-200">
                {visaLetters.map((v) => (
                  <tr key={v.id} className="hover:bg-surface-50">
                    <td className="py-3 px-3 font-semibold text-surface-900">
                      {v.case?.patient?.user?.fullName || 'Patient'}
                      <span className="block text-[11px] font-normal text-surface-500">{v.case?.patient?.nationality}</span>
                    </td>
                    <td className="py-3 px-3">
                      {v.attendantName ? (
                        <>
                          <span className="font-medium text-surface-800">{v.attendantName}</span>
                          <span className="block text-[11px] text-surface-400 font-mono">Passport: {v.attendantPassportNo || 'On file'}</span>
                        </>
                      ) : (
                        <span className="text-surface-400">None registered</span>
                      )}
                    </td>
                    <td className="py-3 px-3 text-surface-700 font-medium">{v.embassyLocation || 'Embassy of India'}</td>
                    <td className="py-3 px-3"><StatusBadge status={v.letterStatus} /></td>
                    <td className="py-3 px-3 text-surface-600 font-mono">
                      {v.expiryDate ? new Date(v.expiryDate).toLocaleDateString() : '90 Days'}
                    </td>
                    <td className="py-3 px-3 text-right">
                      <Button size="sm" variant="secondary" onClick={() => setPreviewLetter(v)}>
                        <Printer className="w-3.5 h-3.5" /> View &amp; Print
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* Issue VIL Modal */}
      <Modal
        open={showModal}
        onClose={() => setShowModal(false)}
        title="Issue Visa Invitation Letter"
        subtitle="Consular authorization letter for Medical Visa (MED / MED-X)"
        maxWidth="xl"
      >
        <form onSubmit={handleIssueVIL} className="space-y-4 text-xs">
          <div>
            <label className="block font-semibold text-surface-700 mb-1">Case ID</label>
            <input
              type="text"
              value={caseId}
              onChange={(e) => setCaseId(e.target.value)}
              placeholder="Enter case ID"
              className="w-full px-3 py-2 bg-white border border-surface-300 rounded-lg focus:border-primary-600 font-mono"
              required
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block font-semibold text-surface-700 mb-1">Patient Passport Number</label>
              <input
                type="text"
                value={patientPassportNo}
                onChange={(e) => setPatientPassportNo(e.target.value)}
                placeholder="Passport number"
                className="w-full px-3 py-2 bg-white border border-surface-300 rounded-lg focus:border-primary-600 font-mono"
                required
              />
            </div>

            <div>
              <label className="block font-semibold text-surface-700 mb-1">Attending Specialist</label>
              <input
                type="text"
                value={doctorName}
                onChange={(e) => setDoctorName(e.target.value)}
                placeholder="Treating doctor name"
                className="w-full px-3 py-2 bg-white border border-surface-300 rounded-lg focus:border-primary-600"
                required
              />
            </div>
          </div>

          <div>
            <label className="block font-semibold text-surface-700 mb-1">Proposed Medical / Surgical Procedure</label>
            <input
              type="text"
              value={procedureName}
              onChange={(e) => setProcedureName(e.target.value)}
              placeholder="Recommended procedure"
              className="w-full px-3 py-2 bg-white border border-surface-300 rounded-lg focus:border-primary-600"
              required
            />
          </div>

          <div>
            <label className="block font-semibold text-surface-700 mb-1">Indian Embassy / Consulate</label>
            <input
              type="text"
              value={embassyLocation}
              onChange={(e) => setEmbassyLocation(e.target.value)}
              placeholder="e.g. High Commission of India, Nairobi"
              className="w-full px-3 py-2 bg-white border border-surface-300 rounded-lg focus:border-primary-600"
              required
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block font-semibold text-surface-700 mb-1">Medical Attendant Name (Optional)</label>
              <input
                type="text"
                value={attendantName}
                onChange={(e) => setAttendantName(e.target.value)}
                placeholder="Full legal name"
                className="w-full px-3 py-2 bg-white border border-surface-300 rounded-lg focus:border-primary-600"
              />
            </div>

            <div>
              <label className="block font-semibold text-surface-700 mb-1">Attendant Passport Number</label>
              <input
                type="text"
                value={attendantPassportNo}
                onChange={(e) => setAttendantPassportNo(e.target.value)}
                placeholder="Passport number"
                className="w-full px-3 py-2 bg-white border border-surface-300 rounded-lg focus:border-primary-600 font-mono"
              />
            </div>
          </div>

          <div>
            <label className="block font-semibold text-surface-700 mb-1">Estimated Treatment Duration (Days)</label>
            <input
              type="number"
              value={estimatedDurationDays}
              onChange={(e) => setEstimatedDurationDays(e.target.value)}
              className="w-full px-3 py-2 bg-white border border-surface-300 rounded-lg focus:border-primary-600 font-mono"
              required
            />
          </div>

          <div className="pt-3 border-t border-surface-200 flex items-center justify-end gap-2">
            <Button type="button" variant="secondary" onClick={() => setShowModal(false)} size="sm">
              Cancel
            </Button>
            <Button type="submit" isLoading={submitting} disabled={submitting} size="sm">
              <Send className="w-3.5 h-3.5" /> Generate VIL
            </Button>
          </div>
        </form>
      </Modal>

      {/* Printable VIL Letterhead Modal */}
      <Modal
        open={Boolean(previewLetter)}
        onClose={() => setPreviewLetter(null)}
        title={previewLetter?.hospital?.name || 'Hospital Visa Invitation Letter'}
        subtitle={
          previewLetter
            ? `${previewLetter.hospital?.city || ''} ${previewLetter.hospital?.accreditation ? `· ${previewLetter.hospital.accreditation}` : ''}`
            : undefined
        }
        maxWidth="3xl"
      >
        {previewLetter && (
          <div className="space-y-6">
            <div className="flex items-center justify-between pb-4 border-b-2 border-primary-900">
              <div>
                <h3 className="text-lg font-bold text-primary-950">{previewLetter.hospital?.name || 'Partner Hospital'}</h3>
                <p className="text-xs text-surface-500">
                  {previewLetter.hospital?.city}
                  {previewLetter.hospital?.accreditation ? ` · ${previewLetter.hospital.accreditation}` : ''} · International Patient Services
                </p>
              </div>
              <div className="text-right">
                <span className="text-[11px] font-bold uppercase px-2 py-1 rounded bg-primary-900 text-white block">
                  VISA INVITATION LETTER
                </span>
                <span className="text-[11px] font-mono text-surface-500 block mt-1">Ref: {previewLetter.id}</span>
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
                <strong>Subject:</strong> Medical Visa Invitation Letter for Patient <u>{previewLetter.case?.patient?.user?.fullName}</u> ({previewLetter.case?.patient?.nationality})
              </p>
              <p>Dear Sir / Madam,</p>
              <p>
                This is to certify that <strong>{previewLetter.case?.patient?.user?.fullName}</strong> is registered with our hospital for specialized medical evaluation and treatment. Our clinical team has reviewed the patient records and scheduled care accordingly.
              </p>
              {previewLetter.attendantName && (
                <p>
                  The patient will be accompanied by <strong>{previewLetter.attendantName}</strong> (Passport No: {previewLetter.attendantPassportNo || 'On file'}) as their designated Medical Attendant.
                </p>
              )}
              <p>
                We respectfully request consideration of a <strong>Medical Visa (MED)</strong> for the patient and a <strong>Medical Attendant Visa (MED-X)</strong> for the accompanying caregiver for travel to India.
              </p>
              <p>Thank you for your assistance.</p>
            </div>

            <div className="pt-4 border-t border-surface-200 flex items-center justify-between text-xs">
              <div>
                <span className="font-semibold text-surface-900 block">Authorized Signatory</span>
                <span className="text-surface-500">International Patient Services (IPS) Desk</span>
                <span className="text-surface-400 block">{previewLetter.hospital?.name}</span>
              </div>
              <div className="flex items-center gap-2 print:hidden">
                <Button size="sm" variant="secondary" onClick={() => window.print()}>
                  <Printer className="w-3.5 h-3.5" /> Print VIL
                </Button>
                <Button size="sm" onClick={() => setPreviewLetter(null)}>
                  Close
                </Button>
              </div>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
