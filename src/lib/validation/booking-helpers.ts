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
