/**
 * Afzal Healthcare — CSV Helper
 * Utility for generating OWASP formula-injection-safe CSV content from structured data.
 */

const FORMULA_TRIGGER_CHARS = new Set(['=', '+', '@', '|', '%']);
const PLAIN_NEGATIVE_NUMBER_RE = /^-\d+(\.\d+)?$/;

/**
 * Neutralize OWASP spreadsheet formula injection while preserving plain numeric
 * values (such as negative balances like -125.5) and properly quoting CSV fields.
 */
export function sanitizeCsvCell(
  val: string | number | boolean | null | undefined
): string {
  if (val === null || val === undefined) return '';
  if (typeof val === 'number' || typeof val === 'boolean') {
    return String(val);
  }

  const raw = String(val);
  const trimmed = raw.trim();
  const startsWithRawTabOrCr = raw.startsWith('\t') || raw.startsWith('\r');
  const startsWithFormulaTrigger =
    trimmed.length > 0 &&
    (FORMULA_TRIGGER_CHARS.has(trimmed[0]) ||
      (trimmed[0] === '-' && !PLAIN_NEGATIVE_NUMBER_RE.test(trimmed)));

  const safe =
    startsWithRawTabOrCr || startsWithFormulaTrigger ? `'${raw}` : raw;

  if (
    safe.includes(',') ||
    safe.includes('"') ||
    safe.includes('\n') ||
    safe.includes('\r')
  ) {
    return `"${safe.replace(/"/g, '""')}"`;
  }

  return safe;
}

/**
 * Generate a CSV string from headers and rows.
 */
export function generateCSV(
  headers: string[],
  rows: (string | number | boolean | null | undefined)[][]
): string {
  const headerLine = headers.map(sanitizeCsvCell).join(',');
  const dataLines = rows.map((row) => row.map(sanitizeCsvCell).join(','));
  return [headerLine, ...dataLines].join('\n');
}

/**
 * Create a CSV Response for Next.js API routes with sanitized filename and nosniff header.
 */
export function csvResponse(csv: string, filename: string): Response {
  const safeFilename = filename.replace(/[^a-zA-Z0-9._-]/g, '_');
  return new Response(csv, {
    status: 200,
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${safeFilename}"`,
      'X-Content-Type-Options': 'nosniff',
    },
  });
}
