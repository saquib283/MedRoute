'use client';

/**
 * Afzal Healthcare — Phase-Adaptive Medical Visa, MED-X Attendant & Travel Concierge Vault
 * Supports passport 6-month readiness checks, up to 2 MED-X attendants (preserving masked passports),
 * inbound/outbound flight itinerary, airport SSR assistance, and FRRO Form C status.
 * IMPORTANT: Never imports `@/lib/services/*` — uses only `@/lib/validation/*` and `@/lib/constants`.
 */

import React, { useEffect, useMemo, useState } from 'react';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Select, type SelectOption } from '@/components/ui/Select';
import { toast } from '@/components/ui/Toast';
import { SSR_ASSISTANCE_CODES, SSR_ASSISTANCE_LABELS } from '@/lib/constants';
import { isPassportValidForMedicalVisa } from '@/lib/validation/booking-helpers';
import type {
  MedicalAttendantRecord,
  TravelLogisticsPayload,
} from '@/lib/validation/lifecycle-schemas';
import {
  AlertCircle,
  CheckCircle2,
  Clock,
  Plane,
  Plus,
  ShieldCheck,
  Trash2,
  Users,
} from 'lucide-react';

export interface VisaAndTravelConciergeCardProps {
  caseId: string | null | undefined;
  passportExpiry?: string | null;
  travelLogistics?: TravelLogisticsPayload | null;
  role?: 'PATIENT' | 'STAFF';
  onSaved?: (snapshot: Record<string, unknown>) => void;
}

const SSR_OPTIONS: SelectOption[] = SSR_ASSISTANCE_CODES.map((code) => ({
  value: code,
  label: SSR_ASSISTANCE_LABELS[code],
}));

function toDateInputValue(val?: string | null): string {
  if (!val) return '';
  if (/^\d{4}-\d{2}-\d{2}$/.test(val.trim())) return val.trim();
  const parsed = new Date(val);
  if (Number.isNaN(parsed.getTime())) return '';
  return parsed.toISOString().slice(0, 10);
}

function toDateTimeLocalValue(val?: string | null): string {
  if (!val) return '';
  const parsed = new Date(val);
  if (Number.isNaN(parsed.getTime())) return '';
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${parsed.getFullYear()}-${pad(parsed.getMonth() + 1)}-${pad(
    parsed.getDate()
  )}T${pad(parsed.getHours())}:${pad(parsed.getMinutes())}`;
}

function isMaskedPassportValue(val: string): boolean {
  const trimmed = val.trim();
  return trimmed === '—' || /^\*+[A-Za-z0-9]{0,4}$/.test(trimmed);
}

export function VisaAndTravelConciergeCard({
  caseId,
  passportExpiry,
  travelLogistics,
  role = 'PATIENT',
  onSaved,
}: VisaAndTravelConciergeCardProps) {
  const [passportExpiryInput, setPassportExpiryInput] = useState(() =>
    toDateInputValue(passportExpiry)
  );
  const [attendants, setAttendants] = useState<MedicalAttendantRecord[]>(() =>
    Array.isArray(travelLogistics?.attendants)
      ? travelLogistics.attendants.slice(0, 2).map((a) => ({
          fullName: a.fullName || '',
          passportNo: a.passportNo || '',
          relation: a.relation || '',
        }))
      : []
  );

  const [arrivalAirline, setArrivalAirline] = useState(
    () => travelLogistics?.arrivalAirline || ''
  );
  const [arrivalFlightNo, setArrivalFlightNo] = useState(
    () => travelLogistics?.arrivalFlightNo || ''
  );
  const [arrivalAt, setArrivalAt] = useState(() =>
    toDateTimeLocalValue(travelLogistics?.arrivalAt)
  );
  const [arrivalAirport, setArrivalAirport] = useState(
    () => travelLogistics?.arrivalAirport || ''
  );
  const [airportPickupRequired, setAirportPickupRequired] = useState(
    () => travelLogistics?.airportPickupRequired ?? true
  );
  const [pickupConfirmed, setPickupConfirmed] = useState(
    () => Boolean(travelLogistics?.pickupConfirmed)
  );
  const [pickupDriverNotes, setPickupDriverNotes] = useState(
    () => travelLogistics?.pickupDriverNotes || ''
  );
  const [wheelchairSsrCode, setWheelchairSsrCode] = useState(
    () => travelLogistics?.wheelchairSsrCode || 'NONE'
  );
  const [dietaryPreferences, setDietaryPreferences] = useState(
    () => travelLogistics?.dietaryPreferences || ''
  );

  const [departureAirline, setDepartureAirline] = useState(
    () => travelLogistics?.departureAirline || ''
  );
  const [departureFlightNo, setDepartureFlightNo] = useState(
    () => travelLogistics?.departureFlightNo || ''
  );
  const [departureAt, setDepartureAt] = useState(() =>
    toDateTimeLocalValue(travelLogistics?.departureAt)
  );

  const [visaNumber, setVisaNumber] = useState(() => travelLogistics?.visaNumber || '');
  const [visaExpiryDate, setVisaExpiryDate] = useState(() =>
    toDateInputValue(travelLogistics?.visaExpiryDate)
  );

  const [isSaving, setIsSaving] = useState(false);
  const [formError, setFormError] = useState('');

  useEffect(() => {
    const timer = setTimeout(() => {
      setPassportExpiryInput(toDateInputValue(passportExpiry));
      setAttendants(
        Array.isArray(travelLogistics?.attendants)
          ? travelLogistics.attendants.slice(0, 2).map((a) => ({
              fullName: a.fullName || '',
              passportNo: a.passportNo || '',
              relation: a.relation || '',
            }))
          : []
      );
      setArrivalAirline(travelLogistics?.arrivalAirline || '');
      setArrivalFlightNo(travelLogistics?.arrivalFlightNo || '');
      setArrivalAt(toDateTimeLocalValue(travelLogistics?.arrivalAt));
      setArrivalAirport(travelLogistics?.arrivalAirport || '');
      setAirportPickupRequired(travelLogistics?.airportPickupRequired ?? true);
      setPickupConfirmed(Boolean(travelLogistics?.pickupConfirmed));
      setPickupDriverNotes(travelLogistics?.pickupDriverNotes || '');
      setWheelchairSsrCode(travelLogistics?.wheelchairSsrCode || 'NONE');
      setDietaryPreferences(travelLogistics?.dietaryPreferences || '');
      setDepartureAirline(travelLogistics?.departureAirline || '');
      setDepartureFlightNo(travelLogistics?.departureFlightNo || '');
      setDepartureAt(toDateTimeLocalValue(travelLogistics?.departureAt));
      setVisaNumber(travelLogistics?.visaNumber || '');
      setVisaExpiryDate(toDateInputValue(travelLogistics?.visaExpiryDate));
    }, 0);
    return () => clearTimeout(timer);
  }, [passportExpiry, travelLogistics]);

  const passportValidity = useMemo(() => {
    if (!passportExpiryInput.trim()) {
      return { status: 'MISSING' as const, label: 'Expiry Date Needed' };
    }
    const parsedArrival = arrivalAt ? new Date(arrivalAt) : null;
    const referenceDate =
      parsedArrival && !Number.isNaN(parsedArrival.getTime()) && parsedArrival > new Date()
        ? parsedArrival
        : new Date();
    const isValid = isPassportValidForMedicalVisa(passportExpiryInput, referenceDate);
    return isValid
      ? { status: 'VALID' as const, label: '6-Month Visa Rule Met' }
      : { status: 'EXPIRING_SOON' as const, label: 'Less than 6 Months Validity' };
  }, [passportExpiryInput, arrivalAt]);

  const handleAddAttendant = () => {
    if (attendants.length >= 2) return;
    setAttendants((prev) => [...prev, { fullName: '', passportNo: '', relation: '' }]);
  };

  const handleUpdateAttendant = (
    index: number,
    field: keyof MedicalAttendantRecord,
    value: string
  ) => {
    setAttendants((prev) =>
      prev.map((item, idx) => (idx === index ? { ...item, [field]: value } : item))
    );
  };

  const handleRemoveAttendant = (index: number) => {
    setAttendants((prev) => prev.filter((_, idx) => idx !== index));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');

    if (!caseId) {
      setFormError('No active treatment case found to attach travel logistics.');
      return;
    }

    for (let i = 0; i < attendants.length; i += 1) {
      const att = attendants[i];
      const name = att.fullName.trim();
      const passport = att.passportNo.trim();
      const relation = att.relation.trim();

      if (name.length < 2) {
        setFormError(`Attendant #${i + 1}: Please enter full name as shown on passport.`);
        return;
      }
      if (passport.length < 4) {
        setFormError(`Attendant #${i + 1}: Please enter a valid passport number (at least 4 characters).`);
        return;
      }
      if (!isMaskedPassportValue(passport) && passport.includes(':')) {
        setFormError(`Attendant #${i + 1}: Passport number cannot contain ':'.`);
        return;
      }
      if (relation.length < 2) {
        setFormError(`Attendant #${i + 1}: Please specify relationship to the patient.`);
        return;
      }
    }

    setIsSaving(true);
    try {
      const payload = {
        action: 'UPDATE_TRAVEL_LOGISTICS' as const,
        passportExpiry: passportExpiryInput.trim() ? passportExpiryInput.trim() : null,
        attendants: attendants.map((a) => ({
          fullName: a.fullName.trim(),
          passportNo: a.passportNo.trim(),
          relation: a.relation.trim(),
        })),
        arrivalAirline: arrivalAirline.trim() || null,
        arrivalFlightNo: arrivalFlightNo.trim() || null,
        arrivalAt: arrivalAt ? new Date(arrivalAt).toISOString() : null,
        arrivalAirport: arrivalAirport.trim() || null,
        airportPickupRequired,
        ...(role === 'STAFF'
          ? {
              pickupConfirmed,
              pickupDriverNotes: pickupDriverNotes.trim() || null,
            }
          : {}),
        wheelchairSsrCode: wheelchairSsrCode || 'NONE',
        dietaryPreferences: dietaryPreferences.trim() || null,
        departureAirline: departureAirline.trim() || null,
        departureFlightNo: departureFlightNo.trim() || null,
        departureAt: departureAt ? new Date(departureAt).toISOString() : null,
        visaNumber: visaNumber.trim() || null,
        visaExpiryDate: visaExpiryDate.trim() ? visaExpiryDate.trim() : null,
      };

      const res = await fetch(`/api/v1/cases/${caseId}/lifecycle`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const json = await res.json();

      if (!res.ok || !json.success) {
        const msg = json.error?.message || 'Unable to save travel and MED-X concierge details.';
        setFormError(msg);
        toast.error(msg, 'Save Error');
        return;
      }

      toast.success(
        'Travel itinerary, passport readiness, and MED-X companion details updated.',
        'Travel Concierge Saved'
      );
      onSaved?.((json.data ?? {}) as Record<string, unknown>);
    } catch (err) {
      const msg = 'Network error saving travel logistics. Please try again.';
      setFormError(msg);
      toast.apiError(err, msg, 'Connection Error');
    } finally {
      setIsSaving(false);
    }
  };

  const hasFormC = Boolean(travelLogistics?.formCSubmittedAt);

  return (
    <div id="travel-concierge">
      <Card className="p-5 space-y-5">
        <div className="border-b border-surface-100 pb-4 flex flex-col lg:flex-row lg:items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <Plane className="w-4 h-4 text-primary-600 shrink-0" aria-hidden="true" />
              <h2 className="text-sm sm:text-base font-semibold text-surface-900">
                Medical Visa (e-MED / MED-X) &amp; Travel Concierge Vault
              </h2>
            </div>
            <p className="text-xs font-normal text-surface-500 mt-1">
              Manage 6-month passport readiness, up to 2 MED-X medical attendants, inbound/outbound flights, and airport concierge reception.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2 shrink-0">
            <Badge
              variant={
                passportValidity.status === 'VALID'
                  ? 'success'
                  : passportValidity.status === 'EXPIRING_SOON'
                  ? 'danger'
                  : 'warning'
              }
              dot
            >
              {passportValidity.label}
            </Badge>

            {travelLogistics?.pickupConfirmed && (
              <Badge variant="success" dot>
                Pickup Confirmed
              </Badge>
            )}

            <Badge variant={hasFormC ? 'success' : 'info'} dot>
              {hasFormC ? 'FRRO Form C Filed' : 'FRRO Form C Pending'}
            </Badge>
          </div>
        </div>

        {!caseId ? (
          <div className="p-4 rounded-md bg-surface-50 border border-surface-200 text-xs text-surface-600">
            Once your care case is opened by your coordinator, you can manage MED-X attendants and airport pickup details here.
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-6">
            {formError && (
              <div
                role="alert"
                className="p-3 rounded-md bg-danger-50 border border-danger-200 text-danger-800 text-xs font-medium flex items-start gap-2"
              >
                <AlertCircle className="w-4 h-4 text-danger-600 shrink-0 mt-0.5" aria-hidden="true" />
                <span>{formError}</span>
              </div>
            )}

            {/* Section 1: Passport Validity & Approved Visa Details */}
            <div className="p-4 rounded-lg bg-surface-50 border border-surface-200 space-y-4">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <h3 className="text-xs font-semibold text-surface-900 flex items-center gap-1.5">
                  <ShieldCheck className="w-3.5 h-3.5 text-primary-600" aria-hidden="true" />
                  <span>Passport &amp; Medical Visa (M-Visa) Readiness</span>
                </h3>
                <span className="text-[11px] font-normal text-surface-500">
                  Indian Immigration requires ≥ 6 months (180 days) passport validity at entry
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <Input
                  label="Patient Passport Expiry Date"
                  type="date"
                  value={passportExpiryInput}
                  onChange={(e) => setPassportExpiryInput(e.target.value)}
                  helperText={
                    passportValidity.status === 'EXPIRING_SOON'
                      ? 'Warning: Renew passport before applying for your e-MED visa.'
                      : 'Verified against arrival or current date.'
                  }
                />
                <Input
                  label="Approved e-MED Visa Number"
                  type="text"
                  placeholder="e.g. IND-MED-992841"
                  value={visaNumber}
                  onChange={(e) => setVisaNumber(e.target.value)}
                />
                <Input
                  label="Visa Expiry Date"
                  type="date"
                  value={visaExpiryDate}
                  onChange={(e) => setVisaExpiryDate(e.target.value)}
                />
              </div>
            </div>

            {/* Section 2: MED-X Medical Attendants (Max 2) */}
            <div className="space-y-3">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div>
                  <h3 className="text-xs font-semibold text-surface-900 flex items-center gap-1.5">
                    <Users className="w-3.5 h-3.5 text-primary-600" aria-hidden="true" />
                    <span>MED-X Medical Attendants ({attendants.length} / 2)</span>
                  </h3>
                  <p className="text-[11px] font-normal text-surface-500 mt-0.5">
                    Indian MHA rules allow up to 2 family members or caregivers to receive co-sponsored MED-X visa invitation letters.
                  </p>
                </div>

                {attendants.length < 2 && (
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    onClick={handleAddAttendant}
                    className="self-start sm:self-auto shrink-0"
                  >
                    <Plus className="w-3.5 h-3.5" aria-hidden="true" />
                    <span>Add MED-X Attendant</span>
                  </Button>
                )}
              </div>

              {attendants.length === 0 ? (
                <div className="p-4 rounded-md border border-dashed border-surface-300 bg-surface-50/50 text-xs text-surface-500">
                  No MED-X medical attendants added yet. Add up to 2 companions if someone is accompanying you to India.
                </div>
              ) : (
                <div className="space-y-3">
                  {attendants.map((att, index) => {
                    const isMasked = isMaskedPassportValue(att.passportNo);
                    return (
                      <div
                        key={index}
                        className="p-4 rounded-lg border border-surface-200 bg-white space-y-3"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-xs font-medium text-surface-700 tabular-nums">
                            MED-X Companion #{index + 1}
                          </span>
                          <button
                            type="button"
                            onClick={() => handleRemoveAttendant(index)}
                            className="inline-flex items-center gap-1 min-h-11 px-2.5 rounded-md text-xs font-medium text-danger-700 hover:bg-danger-50 transition-colors"
                          >
                            <Trash2 className="w-3.5 h-3.5" aria-hidden="true" />
                            <span>Remove</span>
                          </button>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                          <Input
                            label="Full Name (as on Passport)"
                            type="text"
                            placeholder="e.g. Amina Al-Mansoor"
                            value={att.fullName}
                            onChange={(e) =>
                              handleUpdateAttendant(index, 'fullName', e.target.value)
                            }
                            required
                          />
                          <Input
                            label="Passport Number"
                            type="text"
                            placeholder="Enter full passport number"
                            value={att.passportNo}
                            onChange={(e) =>
                              handleUpdateAttendant(index, 'passportNo', e.target.value)
                            }
                            helperText={
                              isMasked
                                ? 'Encrypted on file — leave unchanged to keep, or enter new number to replace.'
                                : 'Encrypted at rest with AES-256.'
                            }
                            required
                          />
                          <Input
                            label="Relationship to Patient"
                            type="text"
                            placeholder="e.g. Spouse, Son, Sister"
                            value={att.relation}
                            onChange={(e) =>
                              handleUpdateAttendant(index, 'relation', e.target.value)
                            }
                            required
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Section 3: Inbound & Outbound Flight Itinerary + Airport Reception */}
            <div className="space-y-4">
              <h3 className="text-xs font-semibold text-surface-900">
                Inbound &amp; Return Flight Itinerary + Airport Concierge
              </h3>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <Input
                  label="Inbound Airline"
                  type="text"
                  placeholder="e.g. Emirates"
                  value={arrivalAirline}
                  onChange={(e) => setArrivalAirline(e.target.value)}
                />
                <Input
                  label="Inbound Flight No."
                  type="text"
                  placeholder="e.g. EK 512"
                  value={arrivalFlightNo}
                  onChange={(e) => setArrivalFlightNo(e.target.value)}
                />
                <Input
                  label="Arrival Date & Time"
                  type="datetime-local"
                  value={arrivalAt}
                  onChange={(e) => setArrivalAt(e.target.value)}
                />
                <Input
                  label="Arrival Airport"
                  type="text"
                  placeholder="e.g. DEL (New Delhi IGI)"
                  value={arrivalAirport}
                  onChange={(e) => setArrivalAirport(e.target.value)}
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Select
                  label="Airline / Airport Wheelchair & Medical Assistance (SSR)"
                  options={SSR_OPTIONS}
                  value={wheelchairSsrCode}
                  onChange={setWheelchairSsrCode}
                />
                <Input
                  label="Dietary & Cultural Preferences"
                  type="text"
                  placeholder="e.g. Halal, Low-Sodium, Soft Diet"
                  value={dietaryPreferences}
                  onChange={(e) => setDietaryPreferences(e.target.value)}
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2 border-t border-surface-100">
                <Input
                  label="Return Airline (Optional)"
                  type="text"
                  placeholder="e.g. Emirates"
                  value={departureAirline}
                  onChange={(e) => setDepartureAirline(e.target.value)}
                />
                <Input
                  label="Return Flight No. (Optional)"
                  type="text"
                  placeholder="e.g. EK 513"
                  value={departureFlightNo}
                  onChange={(e) => setDepartureFlightNo(e.target.value)}
                />
                <Input
                  label="Departure Date & Time (Optional)"
                  type="datetime-local"
                  value={departureAt}
                  onChange={(e) => setDepartureAt(e.target.value)}
                />
              </div>

              <div className="p-4 rounded-lg bg-surface-50 border border-surface-200 space-y-3">
                <label className="flex items-start gap-3 min-h-11 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={airportPickupRequired}
                    onChange={(e) => setAirportPickupRequired(e.target.checked)}
                    className="mt-1 h-4 w-4 rounded border-surface-300 text-primary-600 focus:ring-primary-600"
                  />
                  <span className="text-xs text-surface-700 leading-relaxed">
                    <strong className="font-medium text-surface-900 block">
                      Request Complimentary Hospital Airport Reception &amp; Transfer
                    </strong>
                    Our international patient concierge team meets you at arrivals with wheelchair support as requested.
                  </span>
                </label>

                {role === 'STAFF' && (
                  <div className="pt-3 border-t border-surface-200 space-y-3">
                    <label className="flex items-center gap-3 min-h-11 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={pickupConfirmed}
                        onChange={(e) => setPickupConfirmed(e.target.checked)}
                        className="h-4 w-4 rounded border-surface-300 text-primary-600 focus:ring-primary-600"
                      />
                      <span className="text-xs font-medium text-surface-900">
                        Coordinator: Confirm Airport Pickup Dispatch
                      </span>
                    </label>
                    <Input
                      label="Driver / Reception Dispatch Notes"
                      type="text"
                      placeholder="e.g. Driver Rajesh (+91-98xxx) waiting at Terminal 3 Gate 5 with placard"
                      value={pickupDriverNotes}
                      onChange={(e) => setPickupDriverNotes(e.target.value)}
                    />
                  </div>
                )}

                {travelLogistics?.pickupConfirmed && travelLogistics.pickupDriverNotes && (
                  <div className="p-3 rounded-md bg-success-50 border border-success-200 text-xs text-success-900 flex items-start gap-2">
                    <CheckCircle2 className="w-4 h-4 text-success-700 shrink-0 mt-0.5" aria-hidden="true" />
                    <div>
                      <span className="font-medium block">Airport Reception Confirmed</span>
                      <span className="font-normal text-success-800">
                        {travelLogistics.pickupDriverNotes}
                      </span>
                    </div>
                  </div>
                )}

                <div className="p-3 rounded-md bg-white border border-surface-200 text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div className="flex items-center gap-2 text-surface-700">
                    {hasFormC ? (
                      <CheckCircle2 className="w-4 h-4 text-success-600 shrink-0" aria-hidden="true" />
                    ) : (
                      <Clock className="w-4 h-4 text-surface-400 shrink-0" aria-hidden="true" />
                    )}
                    <div>
                      <span className="font-medium text-surface-900">
                        Statutory FRRO / Form C Arrival Registration
                      </span>
                      <span className="block text-[11px] text-surface-500 tabular-nums">
                        {hasFormC
                          ? `Filed ${new Date(travelLogistics!.formCSubmittedAt!).toLocaleString('en-US', {
                              month: 'short',
                              day: 'numeric',
                              year: 'numeric',
                              hour: '2-digit',
                              minute: '2-digit',
                            })}${travelLogistics?.frroNumber ? ` • Ref: ${travelLogistics.frroNumber}` : ''}`
                          : 'Logged by your hospital coordinator within 24 hours of arrival in India.'}
                      </span>
                    </div>
                  </div>
                  <Badge variant={hasFormC ? 'success' : 'default'}>
                    {hasFormC ? 'Compliant' : 'Pending Arrival'}
                  </Badge>
                </div>
              </div>
            </div>

            <div className="flex justify-end pt-2 border-t border-surface-100">
              <Button type="submit" size="sm" isLoading={isSaving}>
                {isSaving ? 'Saving Travel Details…' : 'Save Visa & Travel Details'}
              </Button>
            </div>
          </form>
        )}
      </Card>
    </div>
  );
}
