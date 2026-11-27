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
      if (Number.isFinite(code) && code > 0 && code <= 0x10ffff) {
        return String.fromCodePoint(code);
      }
      return code > 0x10ffff ? '\uFFFD' : '';
    })
    .replace(/&#(\d+);?/g, (_, dec: string) => {
      const code = parseInt(dec, 10);
      if (Number.isFinite(code) && code > 0 && code <= 0x10ffff) {
        return String.fromCodePoint(code);
      }
      return code > 0x10ffff ? '\uFFFD' : '';
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

function replaceAttributeMatches(
  input: string,
  pattern: RegExp,
  transform: (prefix: string, attr: string, value: string) => string | null
): string {
  const re = new RegExp(pattern.source, 'gi');
  let out = '';
  let cursor = 0;
  let match: RegExpExecArray | null;

  while ((match = re.exec(input)) !== null) {
    const [full, prefix, attr, doubleQuoted, singleQuoted, unquoted] = match;
    const value = doubleQuoted ?? singleQuoted ?? unquoted ?? '';
    const replacement = transform(prefix, attr, value);

    if (replacement !== null) {
      out += input.slice(cursor, match.index) + replacement;
      cursor = match.index + full.length;
    } else if (full.endsWith('"') || full.endsWith("'")) {
      // Step back 1 char so a quote-adjacent following attribute still sees its leading quote
      re.lastIndex = Math.max(match.index + 1, re.lastIndex - 1);
    }
  }

  return out + input.slice(cursor);
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

  // Strip all inline event-handler attributes (quoted, single-quoted, unquoted, or quote-adjacent)
  prev = '';
  while (sanitized !== prev) {
    prev = sanitized;
    sanitized = sanitized.replace(
      /(^|[\s/"'])on[a-z]+\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+)/gi,
      '$1'
    );
  }

  // Neutralize dangerous URI schemes inside href, src, xlink:href, action, and formaction
  prev = '';
  while (sanitized !== prev) {
    prev = sanitized;
    sanitized = replaceAttributeMatches(
      sanitized,
      /(^|[\s/"'])(href|src|xlink:href|action|formaction)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/gi,
      (prefix, attr, value) => {
        if (!isDangerousUri(value)) return null;
        const sep = prefix === '"' || prefix === "'" ? `${prefix} ` : prefix;
        return `${sep}${attr}="#"`;
      }
    );
  }

  // Strip inline style attributes containing expression(...) or script URIs
  prev = '';
  while (sanitized !== prev) {
    prev = sanitized;
    sanitized = replaceAttributeMatches(
      sanitized,
      /(^|[\s/"'])(style)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/gi,
      (prefix, _attr, value) => (isDangerousStyle(value) ? prefix : null)
    );
  }

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
