'use client';

/**
 * Afzal Healthcare — 1-Click Lead → Patient & Case Conversion Modal
 * Supports NEW_PATIENT (with AES-256-GCM passport capture & 6m visa expiry warning)
 * and EXISTING_PATIENT (returning patient case creation).
 */

import React, { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Select, type SelectOption } from '@/components/ui/Select';
import { Badge } from '@/components/ui/Badge';
import { toast } from '@/components/ui/Toast';
import { MVT_SPECIALTY_OPTIONS } from '@/lib/constants';
import {
  formatDoctorDisplayName,
  isPassportValidForMedicalVisa,
} from '@/lib/validation/booking-helpers';
import type {
  DoctorDirectoryItem,
  DuplicateMatchItem,
  HospitalDirectoryItem,
  LeadRecord,
} from './crm-helpers';
import { AlertTriangle, CheckCircle2, UserCheck, UserPlus } from 'lucide-react';

export interface ConvertLeadModalProps {
  open: boolean;
  onClose: () => void;
  role: 'MANAGER' | 'ADMIN';
  lead: LeadRecord;
  duplicatePatients: DuplicateMatchItem[];
  hospitals: HospitalDirectoryItem[];
  doctors: DoctorDirectoryItem[];
  initialMode?: 'NEW_PATIENT' | 'EXISTING_PATIENT';
  preselectedPatientId?: string;
}

const BLOOD_GROUP_OPTIONS: SelectOption[] = [
  { value: '', label: 'Unknown / Not Provided' },
  { value: 'A+', label: 'A+' },
  { value: 'A-', label: 'A-' },
  { value: 'B+', label: 'B+' },
  { value: 'B-', label: 'B-' },
  { value: 'AB+', label: 'AB+' },
  { value: 'AB-', label: 'AB-' },
  { value: 'O+', label: 'O+' },
  { value: 'O-', label: 'O-' },
];

function ConvertLeadModalBody({
  onClose,
  role,
  lead,
  duplicatePatients,
  hospitals,
  doctors,
  initialMode = 'NEW_PATIENT',
  preselectedPatientId,
}: Omit<ConvertLeadModalProps, 'open'>) {
  const router = useRouter();
  const [mode, setMode] = useState<'NEW_PATIENT' | 'EXISTING_PATIENT'>(initialMode);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  // NEW_PATIENT fields
  const [email, setEmail] = useState(lead.email || '');
  const [phone, setPhone] = useState(lead.phone || lead.whatsappNumber || '');
  const [passportNo, setPassportNo] = useState('');
  const [passportExpiry, setPassportExpiry] = useState('');
  const [dob, setDob] = useState('');
  const [bloodGroup, setBloodGroup] = useState('');

  // EXISTING_PATIENT fields
  const [existingPatientId, setExistingPatientId] = useState(
    preselectedPatientId || duplicatePatients[0]?.id || ''
  );

  // Shared clinical routing fields
  const [hospitalId, setHospitalId] = useState(lead.targetHospitalId || '');
  const [primaryDoctorId, setPrimaryDoctorId] = useState(lead.targetDoctorId || '');
  const [specialtyId, setSpecialtyId] = useState(lead.specialtyInterest || '');
  const [notes, setNotes] = useState('');

  const passportValidityWarning = useMemo(() => {
    if (!passportExpiry) return false;
    return !isPassportValidForMedicalVisa(passportExpiry);
  }, [passportExpiry]);

  const hospitalOptions: SelectOption[] = useMemo(
    () => [
      { value: '', label: 'Assign Hospital Later (INQUIRY_RECEIVED)' },
      ...hospitals.map((h) => ({
        value: h.id,
        label: h.name,
        description: [h.city, h.accreditation].filter(Boolean).join(' · ') || undefined,
      })),
    ],
    [hospitals]
  );

  const filteredDoctors = useMemo(() => {
    if (!hospitalId) return doctors;
    return doctors.filter((d) => d.hospitalId === hospitalId);
  }, [doctors, hospitalId]);

  const doctorOptions: SelectOption[] = useMemo(
    () => [
      { value: '', label: 'Assign Specialist Later' },
      ...filteredDoctors.map((d) => ({
        value: d.id,
        label: formatDoctorDisplayName(d.fullName),
        description: [d.specialisation?.name, d.qualification].filter(Boolean).join(' · ') || undefined,
      })),
    ],
    [filteredDoctors]
  );

  const specialtyOptions: SelectOption[] = useMemo(
    () => [
      { value: '', label: 'Standard 7-Stage MVT Pathway' },
      ...MVT_SPECIALTY_OPTIONS.map((opt) => ({
        value: opt.value,
        label: opt.label,
      })),
    ],
    []
  );

  const handleHospitalChange = (nextHospitalId: string) => {
    setHospitalId(nextHospitalId);
    if (
      nextHospitalId &&
      primaryDoctorId &&
      !doctors.some((d) => d.id === primaryDoctorId && d.hospitalId === nextHospitalId)
    ) {
      setPrimaryDoctorId('');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    if (mode === 'NEW_PATIENT') {
      if (!email.trim()) {
        setFormError('Patient email is required to provision portal access.');
        return;
      }
      if (passportNo.trim().length < 5) {
        setFormError('Passport number must be at least 5 characters.');
        return;
      }
      if (!dob) {
        setFormError('Date of birth is required.');
        return;
      }
    } else if (!existingPatientId.trim()) {
      setFormError('Select or enter an existing patient record.');
      return;
    }

    setSubmitting(true);
    try {
      const payload =
        mode === 'NEW_PATIENT'
          ? {
              mode: 'NEW_PATIENT' as const,
              email: email.trim(),
              passportNo: passportNo.trim(),
              dob,
              ...(passportExpiry ? { passportExpiry } : {}),
              ...(phone.trim() ? { phone: phone.trim() } : {}),
              ...(bloodGroup ? { bloodGroup } : {}),
              hospitalId: hospitalId || null,
              primaryDoctorId: primaryDoctorId || null,
              specialtyId: specialtyId || null,
              notes: notes.trim() || null,
            }
          : {
              mode: 'EXISTING_PATIENT' as const,
              existingPatientId: existingPatientId.trim(),
              hospitalId: hospitalId || null,
              primaryDoctorId: primaryDoctorId || null,
              specialtyId: specialtyId || null,
              notes: notes.trim() || null,
            };

      const res = await fetch(`/api/v1/leads/${lead.id}/convert`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const json = await res.json();

      if (!res.ok || !json.success) {
        const msg = json?.error?.message || 'Unable to convert lead. Please review inputs.';
        setFormError(msg);
        toast.apiError(json, msg, 'Conversion Failed');
        return;
      }

      const caseId = json.data?.caseId as string;
      const tempPwd = json.data?.generatedTemporaryPassword as string | undefined;
      toast.success(
        tempPwd
          ? `Converted to Patient & Case. Temporary portal credentials generated cleanly.`
          : `Lead ${lead.referenceNo} converted to Case #${caseId.slice(0, 8)}.`,
        'Conversion Complete'
      );
      onClose();
      router.push(`/${role === 'ADMIN' ? 'admin' : 'manager'}/cases/${caseId}`);
    } catch (err) {
      toast.apiError(err, 'Network error converting lead.', 'Connection Error');
      setFormError('Network error converting lead.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {/* Patient summary banner */}
      <div className="p-3.5 rounded-md bg-surface-50 border border-surface-200 flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="text-xs font-medium text-surface-500">Lead Reference · {lead.referenceNo}</p>
          <p className="text-sm font-semibold text-surface-900 mt-0.5">
            {lead.fullName} · {lead.nationality}
          </p>
        </div>
        <Badge variant={hospitalId && primaryDoctorId ? 'primary' : 'info'}>
          {hospitalId && primaryDoctorId ? 'Starts as UNDER_REVIEW' : 'Starts as INQUIRY_RECEIVED'}
        </Badge>
      </div>

      {/* Mode Switcher */}
      <div className="grid grid-cols-2 gap-2 p-1 rounded-md bg-surface-100 border border-surface-200">
        <button
          type="button"
          onClick={() => setMode('NEW_PATIENT')}
          className={`min-h-11 px-3 rounded-md text-xs font-medium flex items-center justify-center gap-2 transition-colors ${
            mode === 'NEW_PATIENT'
              ? 'bg-white text-primary-900 border border-surface-200 shadow-2xs'
              : 'text-surface-600 hover:text-surface-900'
          }`}
        >
          <UserPlus className="w-4 h-4 shrink-0" aria-hidden="true" />
          <span>New Patient &amp; Case</span>
        </button>
        <button
          type="button"
          onClick={() => setMode('EXISTING_PATIENT')}
          className={`min-h-11 px-3 rounded-md text-xs font-medium flex items-center justify-center gap-2 transition-colors ${
            mode === 'EXISTING_PATIENT'
              ? 'bg-white text-primary-900 border border-surface-200 shadow-2xs'
              : 'text-surface-600 hover:text-surface-900'
          }`}
        >
          <UserCheck className="w-4 h-4 shrink-0" aria-hidden="true" />
          <span>
            Existing Patient
            {duplicatePatients.length > 0 ? ` (${duplicatePatients.length})` : ''}
          </span>
        </button>
      </div>

      {mode === 'NEW_PATIENT' ? (
        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            <Input
              label="Portal Email Address"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="patient@example.com"
            />
            <Input
              label="Phone / WhatsApp"
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="+968 9123 4567"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
            <Input
              label="Passport Number"
              required
              value={passportNo}
              onChange={(e) => setPassportNo(e.target.value)}
              placeholder="Encrypted via AES-256-GCM"
            />
            <Input
              label="Passport Expiry"
              type="date"
              value={passportExpiry}
              onChange={(e) => setPassportExpiry(e.target.value)}
            />
            <Input
              label="Date of Birth"
              type="date"
              required
              value={dob}
              onChange={(e) => setDob(e.target.value)}
            />
          </div>

          {passportValidityWarning && (
            <div className="p-3 rounded-md bg-warning-50 border border-warning-200 text-xs text-warning-900 flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 text-warning-700 shrink-0 mt-0.5" aria-hidden="true" />
              <div>
                <p className="font-medium">Passport Expiry Below 6 Months</p>
                <p className="mt-0.5 text-warning-800">
                  Indian e-Medical (MED) visa issuance requires at least 6 months (180 days) of remaining passport validity. Remind the patient to renew before VIL issuance.
                </p>
              </div>
            </div>
          )}

          <Select
            label="Blood Group (Optional)"
            value={bloodGroup}
            onChange={setBloodGroup}
            options={BLOOD_GROUP_OPTIONS}
          />
        </div>
      ) : (
        <div className="space-y-3.5">
          {duplicatePatients.length > 0 ? (
            <div className="space-y-2">
              <p className="text-xs font-medium text-surface-700">
                Matched Returning Patient Records
              </p>
              {duplicatePatients.map((pat) => {
                const selected = existingPatientId === pat.id;
                return (
                  <button
                    key={pat.id}
                    type="button"
                    onClick={() => setExistingPatientId(pat.id)}
                    className={`w-full text-left p-3 rounded-md border min-h-11 flex items-center justify-between gap-3 transition-colors ${
                      selected
                        ? 'bg-primary-50 border-primary-300 text-primary-900'
                        : 'bg-white border-surface-200 hover:border-surface-300 text-surface-800'
                    }`}
                  >
                    <div className="min-w-0">
                      <p className="text-xs font-semibold truncate">{pat.fullName}</p>
                      <p className="text-[11px] text-surface-500 mt-0.5">
                        {[pat.maskedEmail, pat.maskedPhone].filter(Boolean).join(' · ')} · Matched by{' '}
                        {pat.matchedBy.join(' & ')}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <Badge variant="default" size="sm">
                        {pat.status}
                      </Badge>
                      {selected && (
                        <CheckCircle2 className="w-4 h-4 text-primary-600" aria-hidden="true" />
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          ) : (
            <div className="p-3 rounded-md bg-surface-50 border border-surface-200 text-xs text-surface-600">
              No automatic email/phone duplicates found. Enter an existing Patient ID below to attach a new clinical episode.
            </div>
          )}

          <Input
            label="Existing Patient ID"
            required
            value={existingPatientId}
            onChange={(e) => setExistingPatientId(e.target.value)}
            placeholder="Paste existing Patient ID"
          />
        </div>
      )}

      {/* Clinical Routing & Notes */}
      <div className="pt-4 border-t border-surface-200 space-y-3.5">
        <p className="text-xs font-semibold text-surface-800">
          Clinical Pathway &amp; Hospital Routing
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
          <Select
            label="Target Partner Hospital"
            value={hospitalId}
            onChange={handleHospitalChange}
            options={hospitalOptions}
            searchable
          />
          <Select
            label="Attending Specialist"
            value={primaryDoctorId}
            onChange={setPrimaryDoctorId}
            options={doctorOptions}
            searchable
          />
        </div>

        <Select
          label="Clinical Pathway Preset"
          value={specialtyId}
          onChange={setSpecialtyId}
          options={specialtyOptions}
        />

        <div className="space-y-1.5">
          <label htmlFor="convert-notes" className="block text-xs font-medium text-surface-700">
            Conversion Handover Notes (Optional)
          </label>
          <textarea
            id="convert-notes"
            rows={3}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Summarize pre-conversion discussions, uploaded reports, or special travel needs..."
            className="w-full p-2.5 rounded-md border border-surface-300 bg-white text-sm text-surface-900 placeholder:text-surface-400 focus:outline-none focus:border-primary-600"
          />
        </div>
      </div>

      {formError && (
        <div
          role="alert"
          className="p-3 rounded-md bg-danger-50 border border-danger-200 text-xs font-medium text-danger-800"
        >
          {formError}
        </div>
      )}

      <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-surface-200">
        <Button type="button" variant="secondary" onClick={onClose} disabled={submitting}>
          Cancel
        </Button>
        <Button type="submit" isLoading={submitting}>
          {mode === 'NEW_PATIENT' ? 'Create Patient & Open Case' : 'Create Case on Existing Patient'}
        </Button>
      </div>
    </form>
  );
}

export function ConvertLeadModal(props: ConvertLeadModalProps) {
  const modalKey = `${props.lead.id}-${props.initialMode || 'NEW_PATIENT'}-${
    props.preselectedPatientId || ''
  }-${props.open ? 'open' : 'closed'}`;

  return (
    <Modal
      open={props.open}
      onClose={props.onClose}
      title="Convert Lead to Patient & Case"
      subtitle="Atomically provisions the 7-stage MVT clinical pathway and preserves B2B attribution."
      maxWidthClass="max-w-2xl"
      preventClose={false}
    >
      {props.open && (
        <ConvertLeadModalBody
          key={modalKey}
          onClose={props.onClose}
          role={props.role}
          lead={props.lead}
          duplicatePatients={props.duplicatePatients}
          hospitals={props.hospitals}
          doctors={props.doctors}
          initialMode={props.initialMode}
          preselectedPatientId={props.preselectedPatientId}
        />
      )}
    </Modal>
  );
}
