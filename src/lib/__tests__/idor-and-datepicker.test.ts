import { calculateHotelStayNights } from '@/lib/validation/booking-helpers';
import { parseLocalCalendarDate } from '@/components/ui/DatePicker';

describe('Hotel Booking Date Integrity & DatePicker Local Parsing', () => {
  it('calculates positive stay nights and rejects reversed, identical, or invalid dates', () => {
    expect(calculateHotelStayNights('2026-12-01', '2026-12-06').numNights).toBe(5);
    expect(() => calculateHotelStayNights('2026-12-10', '2026-12-05')).toThrow();
    expect(() => calculateHotelStayNights('2026-12-10', '2026-12-10')).toThrow();
    expect(() => calculateHotelStayNights('not-a-date', '2026-12-10')).toThrow();
  });

  it('parses YYYY-MM-DD strings in local calendar date without UTC -1 day shift', () => {
    const d = parseLocalCalendarDate('1984-03-15');
    expect(d.getFullYear()).toBe(1984);
    expect(d.getMonth()).toBe(2);
    expect(d.getDate()).toBe(15);
  });
});
