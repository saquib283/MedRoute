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

function formatUtcYmd(date: Date): string {
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, '0');
  const day = String(date.getUTCDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function getDefaultStayDates(now: Date = new Date()): {
  checkInDate: string;
  checkOutDate: string;
} {
  const utcMidnightMs = Date.UTC(
    now.getUTCFullYear(),
    now.getUTCMonth(),
    now.getUTCDate()
  );
  const oneDayMs = 24 * 60 * 60 * 1000;
  return {
    checkInDate: formatUtcYmd(new Date(utcMidnightMs + oneDayMs)),
    checkOutDate: formatUtcYmd(new Date(utcMidnightMs + 6 * oneDayMs)),
  };
}

export function previewHotelStayCost(
  checkInStr: string,
  checkOutStr: string,
  nightlyRateUsd: number
): { valid: boolean; numNights: number; totalUsd: number; error?: string } {
  if (!Number.isFinite(nightlyRateUsd) || nightlyRateUsd < 0) {
    return {
      valid: false,
      numNights: 0,
      totalUsd: 0,
      error: 'Invalid nightly hotel rate',
    };
  }
  try {
    const { numNights } = calculateHotelStayNights(checkInStr, checkOutStr);
    const totalUsd = Math.round(numNights * nightlyRateUsd * 100) / 100;
    return { valid: true, numNights, totalUsd };
  } catch (err) {
    return {
      valid: false,
      numNights: 0,
      totalUsd: 0,
      error:
        err instanceof Error
          ? err.message
          : 'Check-out date must be after check-in date',
    };
  }
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
