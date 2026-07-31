/**
 * Afzal Healthcare — CSV Helper
 * Utility for generating CSV content from structured data.
 */

/**
 * Generate a CSV string from headers and rows.
 */
export function generateCSV(
  headers: string[],
  rows: (string | number | boolean | null | undefined)[][]
): string {
  const escapeField = (val: string | number | boolean | null | undefined): string => {
    if (val === null || val === undefined) return '';
    const str = String(val);
    // Escape fields containing commas, quotes, or newlines
    if (str.includes(',') || str.includes('"') || str.includes('\n')) {
      return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
  };

  const headerLine = headers.map(escapeField).join(',');
  const dataLines = rows.map((row) => row.map(escapeField).join(','));
  return [headerLine, ...dataLines].join('\n');
}

/**
 * Create a CSV Response for Next.js API routes.
 */
export function csvResponse(csv: string, filename: string): Response {
  return new Response(csv, {
    status: 200,
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${filename}"`,
    },
  });
}
