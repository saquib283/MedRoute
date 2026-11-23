export function calculateHotelStayNights(
  checkInStr: string,
  checkOutStr: string
): { start: Date; end: Date; numNights: number } {
  const start = new Date(checkInStr);
  const end = new Date(checkOutStr);
  if (isNaN(start.getTime()) || isNaN(end.getTime())) {
    throw new Error('Invalid check-in or check-out date');
  }
  const diffMs = end.getTime() - start.getTime();
  if (diffMs <= 0) {
    throw new Error('Check-out date must be after check-in date');
  }
  const numNights = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
  return { start, end, numNights };
}

const UTC_DAYS = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'] as const;

export function formatDoctorDisplayName(fullName: string): string {
  const trimmed = (fullName || '').trim();
  if (!trimmed) return 'Dr.';
  if (/^dr\.?\s+/i.test(trimmed)) {
    return trimmed.replace(/^dr\.?\s+/i, 'Dr. ');
  }
  return `Dr. ${trimmed}`;
}

export function isDoctorAvailableOnDate(
  availableDays: unknown,
  scheduledAt: Date
): boolean {
  if (!Array.isArray(availableDays) || availableDays.length === 0) {
    return true;
  }
  const normalized = availableDays
    .filter((d): d is string => typeof d === 'string')
    .map((d) => d.trim().toUpperCase());
  if (normalized.length === 0) return true;
  const utcDay = UTC_DAYS[scheduledAt.getUTCDay()];
  const localDay = UTC_DAYS[scheduledAt.getDay()];
  return normalized.includes(utcDay) || normalized.includes(localDay);
}
