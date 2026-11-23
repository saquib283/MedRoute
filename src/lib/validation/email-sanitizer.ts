/**
 * Afzal Healthcare — Client/Server-Safe Email HTML Sanitizer & Template Interpolator
 * Zero Prisma or Node-only imports so 'use client' admin pages can import directly.
 */

export interface CampaignRecipientContext {
  fullName: string;
  email: string;
  role: string;
  nationality?: string | null;
  caseStatus?: string | null;
  portalUrl?: string;
  supportEmail?: string;
}

const DEFAULT_PORTAL_URL = 'https://portal.afzalhealthcare.in';
const DEFAULT_SUPPORT_EMAIL = 'concierge@afzalhealthcare.in';

const NAMED_ENTITIES: Record<string, string> = {
  tab: '\t',
  newline: '\n',
  colon: ':',
  quot: '"',
  apos: "'",
  amp: '&',
  lt: '<',
  gt: '>',
};

function decodeBasicEntities(value: string): string {
  return value
    .replace(/&#x([0-9a-f]+);?/gi, (_, hex: string) => {
      const code = parseInt(hex, 16);
      return Number.isFinite(code) && code > 0 ? String.fromCodePoint(code) : '';
    })
    .replace(/&#(\d+);?/g, (_, dec: string) => {
      const code = parseInt(dec, 10);
      return Number.isFinite(code) && code > 0 ? String.fromCodePoint(code) : '';
    })
    .replace(/&(tab|newline|colon|quot|apos|amp|lt|gt);/gi, (_, name: string) => {
      return NAMED_ENTITIES[name.toLowerCase()] ?? '';
    });
}

function isDangerousUri(rawUri: string): boolean {
  const decoded = decodeBasicEntities(rawUri);
  // Strip ASCII control characters (0x00-0x20, 0x7F) and whitespace before checking scheme
  const normalized = decoded.replace(/[\u0000-\u0020\u007f]+/g, '').toLowerCase();
  return (
    normalized.startsWith('javascript:') ||
    normalized.startsWith('vbscript:') ||
    normalized.startsWith('data:text/html')
  );
}

function isDangerousStyle(rawStyle: string): boolean {
  const decoded = decodeBasicEntities(rawStyle)
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/[\u0000-\u0020\u007f]+/g, '')
    .toLowerCase();
  return (
    decoded.includes('javascript:') ||
    decoded.includes('vbscript:') ||
    /expression\s*\(/i.test(decoded)
  );
}

/**
 * Deterministically strip dangerous HTML containers, inline event handlers,
 * unsafe style expressions, and javascript:/vbscript:/data:text/html URIs.
 */
export function sanitizeEmailHtml(html: string): string {
  if (!html) return '';

  let sanitized = html;
  let prev = '';

  // Repeat container stripping until stable to neutralize nested/obfuscated tags
  while (sanitized !== prev) {
    prev = sanitized;
    sanitized = sanitized.replace(
      /<(script|style|iframe|object|embed|form)\b[^>]*>[\s\S]*?<\/\1\s*>/gi,
      ''
    );
    sanitized = sanitized.replace(
      /<\/?(script|style|iframe|object|embed|form|meta|link|base)\b[^>]*(?:>|$)/gi,
      ''
    );
  }

  // Strip all inline event-handler attributes (quoted, single-quoted, or unquoted)
  prev = '';
  while (sanitized !== prev) {
    prev = sanitized;
    sanitized = sanitized.replace(
      /(^|[\s/])on[a-z]+\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+)/gi,
      '$1'
    );
  }

  // Neutralize dangerous URI schemes inside href, src, xlink:href, action, and formaction
  sanitized = sanitized.replace(
    /([\s/])(href|src|xlink:href|action|formaction)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/gi,
    (
      match,
      prefix: string,
      attr: string,
      doubleQuoted?: string,
      singleQuoted?: string,
      unquoted?: string
    ) => {
      const value = doubleQuoted ?? singleQuoted ?? unquoted ?? '';
      if (isDangerousUri(value)) {
        return `${prefix}${attr}="#"`;
      }
      return match;
    }
  );

  // Strip inline style attributes containing expression(...) or script URIs
  sanitized = sanitized.replace(
    /([\s/])style\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/gi,
    (
      match,
      prefix: string,
      doubleQuoted?: string,
      singleQuoted?: string,
      unquoted?: string
    ) => {
      const value = doubleQuoted ?? singleQuoted ?? unquoted ?? '';
      if (isDangerousStyle(value)) {
        return prefix;
      }
      return match;
    }
  );

  return sanitized;
}

/**
 * Escape HTML special characters in plain-text values before HTML interpolation.
 */
export function escapeHtmlText(val: string): string {
  return val
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * Interpolate all 7 supported campaign placeholders in a template subject or body.
 * Escapes recipient fields for HTML safety by default (`escapeHtml: true`).
 */
export function interpolateCampaignTemplate(
  templateText: string,
  ctx: CampaignRecipientContext,
  options?: { escapeHtml?: boolean }
): string {
  if (!templateText) return '';

  const shouldEscape = options?.escapeHtml !== false;
  const envPortalUrl =
    typeof process !== 'undefined' ? process.env?.NEXT_PUBLIC_APP_URL : undefined;

  const replacements: Record<string, string> = {
    fullName: ctx.fullName || '',
    email: ctx.email || '',
    role: ctx.role || '',
    nationality: ctx.nationality || 'International',
    caseStatus: ctx.caseStatus || 'INQUIRY_RECEIVED',
    portalUrl: ctx.portalUrl || envPortalUrl || DEFAULT_PORTAL_URL,
    supportEmail: ctx.supportEmail || DEFAULT_SUPPORT_EMAIL,
  };

  return templateText.replace(
    /\{\{(fullName|email|role|nationality|caseStatus|portalUrl|supportEmail)\}\}/g,
    (_, key: string) => {
      const rawValue = replacements[key] ?? '';
      return shouldEscape ? escapeHtmlText(rawValue) : rawValue;
    }
  );
}
