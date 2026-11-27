/**
 * Afzal Healthcare — Real PDF Text-Stream Medical Bill OCR Service
 * Extracts compressed (/FlateDecode) and uncompressed PDF BT...ET text operators
 * deterministically without external SDKs, falling back transparently on raster scans.
 */

import zlib from 'zlib';

export type OcrItemCategory =
  | 'SURGERY_OT'
  | 'BED_RENT'
  | 'PHARMACY'
  | 'DIAGNOSTICS'
  | 'CONSULTATION'
  | 'ADMIN_SERVICE';

export interface OcrLineItem {
  description: string;
  quantity: number;
  unitPrice: number;
  amount: number;
  category: OcrItemCategory;
  pageNumber?: number;
}

export interface PageOcrMetadata {
  pageNumber: number;
  fileName: string;
  itemsFound: number;
  pageSubtotal: number;
}

export interface MultiPageOcrExtractionResult {
  hospitalName?: string;
  invoiceNumber?: string;
  title: string;
  category: string;
  currency: string;
  totalAmount: number;
  items: OcrLineItem[];
  confidenceScore: number;
  extractionMode: 'PDF_TEXT' | 'SCANNED_FALLBACK';
  pageCount: number;
  pages: PageOcrMetadata[];
  fileNames: string[];
}

export interface OcrInputFile {
  name: string;
  type: string;
  buffer: Buffer;
}

const MAX_INFLATE_BYTES = 10 * 1024 * 1024; // 10 MB decompression guard
const SUPPORTED_CURRENCIES = /\b(USD|INR|EUR|GBP|AED|OMR)\b/i;
const INVOICE_NUM_REGEX = /\b(?:INV|BILL)[-_A-Z0-9]*\d[-_A-Z0-9]*\b/i;
const HOSPITAL_LINE_REGEX =
  /\b[A-Za-z0-9 &.,'-]*(?:Hospital|Medical Center|Clinic|Institute|Healthcare)\b/i;
const SUMMARY_LINE_PREFIX =
  /^(?:total|sub\s*total|subtotal|grand\s*total|balance|amount\s*due|paid|tax|gst|discount)\b/i;

function unescapePdfLiteral(raw: string): string {
  let out = '';
  for (let i = 0; i < raw.length; i += 1) {
    const ch = raw[i];
    if (ch !== '\\') {
      out += ch;
      continue;
    }
    const next = raw[i + 1];
    if (next === undefined) break;

    if (next === 'n') {
      out += '\n';
      i += 1;
    } else if (next === 'r') {
      out += '\r';
      i += 1;
    } else if (next === 't') {
      out += '\t';
      i += 1;
    } else if (next === 'b') {
      out += '\b';
      i += 1;
    } else if (next === 'f') {
      out += '\f';
      i += 1;
    } else if (next === '(' || next === ')' || next === '\\') {
      out += next;
      i += 1;
    } else if (next === '\r') {
      i += raw[i + 2] === '\n' ? 2 : 1;
    } else if (next === '\n') {
      i += 1;
    } else if (/[0-7]/.test(next)) {
      const octalMatch = raw.slice(i + 1, i + 4).match(/^[0-7]{1,3}/);
      if (octalMatch) {
        out += String.fromCharCode(parseInt(octalMatch[0], 8));
        i += octalMatch[0].length;
      }
    } else {
      out += next;
      i += 1;
    }
  }
  return out;
}

function readBalancedParentheses(source: string, openIndex: number): { text: string; endIndex: number } {
  let depth = 0;
  let content = '';
  let i = openIndex;

  while (i < source.length) {
    const ch = source[i];
    if (ch === '\\') {
      const next = source[i + 1];
      if (next !== undefined) {
        content += ch + next;
        i += 2;
        continue;
      }
    }
    if (ch === '(') {
      if (depth > 0) content += ch;
      depth += 1;
    } else if (ch === ')') {
      depth -= 1;
      if (depth === 0) {
        return { text: unescapePdfLiteral(content), endIndex: i };
      }
      content += ch;
    } else {
      content += ch;
    }
    i += 1;
  }

  return { text: unescapePdfLiteral(content), endIndex: source.length - 1 };
}

function extractLinesFromContentStream(streamText: string): string[] {
  const lines: string[] = [];
  const btRegex = /\bBT\b([\s\S]*?)\bET\b/g;
  const blocks: string[] = [];

  let blockMatch: RegExpExecArray | null;
  while ((blockMatch = btRegex.exec(streamText)) !== null) {
    blocks.push(blockMatch[1]);
  }
  if (blocks.length === 0 && (streamText.includes('Tj') || streamText.includes('TJ'))) {
    blocks.push(streamText);
  }

  for (const block of blocks) {
    let currentLineTokens: string[] = [];
    const flushLine = () => {
      const joined = currentLineTokens.join(' ').replace(/\s+/g, ' ').trim();
      if (joined) lines.push(joined);
      currentLineTokens = [];
    };

    let i = 0;
    const len = block.length;
    const recentNumbers: number[] = [];

    while (i < len) {
      const ch = block[i];

      // Skip whitespace
      if (/\s/.test(ch)) {
        i += 1;
        continue;
      }

      // Skip PDF comments
      if (ch === '%') {
        const nl = block.indexOf('\n', i);
        i = nl === -1 ? len : nl + 1;
        continue;
      }

      // String literal (...) followed potentially by Tj, ', or "
      if (ch === '(') {
        const { text, endIndex } = readBalancedParentheses(block, i);
        i = endIndex + 1;
        const rest = block.slice(i);
        const opMatch = rest.match(/^\s*(Tj|'|")/);
        if (opMatch) {
          if (opMatch[1] === "'" || opMatch[1] === '"') {
            flushLine();
          }
          if (text.trim()) currentLineTokens.push(text.trim());
          i += opMatch[0].length;
        } else if (text.trim()) {
          currentLineTokens.push(text.trim());
        }
        continue;
      }

      // Array [...] TJ
      if (ch === '[') {
        let j = i + 1;
        const arrayStrings: string[] = [];
        while (j < len && block[j] !== ']') {
          if (block[j] === '(') {
            const { text, endIndex } = readBalancedParentheses(block, j);
            if (text.trim()) arrayStrings.push(text.trim());
            j = endIndex + 1;
          } else {
            j += 1;
          }
        }
        i = j < len ? j + 1 : len;
        const rest = block.slice(i);
        const tjMatch = rest.match(/^\s*TJ\b/);
        if (tjMatch) {
          i += tjMatch[0].length;
        }
        if (arrayStrings.length > 0) {
          currentLineTokens.push(arrayStrings.join(' '));
        }
        continue;
      }

      // Numeric token
      const numMatch = block.slice(i).match(/^[+-]?(?:\d+\.?\d*|\.\d+)(?=\s|$|\[|\(|\/)/);
      if (numMatch) {
        recentNumbers.push(parseFloat(numMatch[0]));
        if (recentNumbers.length > 8) recentNumbers.shift();
        i += numMatch[0].length;
        continue;
      }

      // Operator / keyword token
      const wordMatch = block.slice(i).match(/^[^\s()[\]<>\/%]+/);
      if (wordMatch) {
        const word = wordMatch[0];
        i += word.length;
        if (word === 'Td' || word === 'TD') {
          const dy = recentNumbers.length >= 1 ? recentNumbers[recentNumbers.length - 1] : 0;
          if (Math.abs(dy) > 0.01) {
            flushLine();
          }
          recentNumbers.length = 0;
        } else if (word === 'T*' || word === 'Tm') {
          flushLine();
          recentNumbers.length = 0;
        } else if (word === 'Tf' || word === 'TL' || word === 'Tc' || word === 'Tw' || word === 'Tz') {
          recentNumbers.length = 0;
        }
        continue;
      }

      i += 1;
    }

    flushLine();
  }

  return lines;
}

/**
 * Extract readable text lines from an uncompressed or /FlateDecode PDF buffer.
 */
export function extractTextFromPdfBuffer(buffer: Buffer): string[] {
  if (!buffer || buffer.length < 5) {
    return [];
  }

  const rawLatin1 = buffer.toString('latin1');
  const extractedLines: string[] = [];

  const streamRegex = /stream(?:\r\n|\n|\r)/g;
  let match: RegExpExecArray | null;

  while ((match = streamRegex.exec(rawLatin1)) !== null) {
    const streamStart = match.index + match[0].length;
    const endIdx = rawLatin1.indexOf('endstream', streamStart);
    if (endIdx === -1) break;

    let streamEnd = endIdx;
    if (streamEnd > streamStart && rawLatin1[streamEnd - 1] === '\n') streamEnd -= 1;
    if (streamEnd > streamStart && rawLatin1[streamEnd - 1] === '\r') streamEnd -= 1;

    const dictWindow = rawLatin1.slice(Math.max(0, match.index - 512), match.index);
    const isFlate = /\/FlateDecode\b/.test(dictWindow);
    const hasUnsupportedPredictor = /\/Predictor\s+\d+/.test(dictWindow);

    const rawSlice = buffer.subarray(streamStart, streamEnd);
    let contentText = '';

    if (isFlate && !hasUnsupportedPredictor) {
      try {
        const decompressed = zlib.inflateSync(rawSlice, {
          maxOutputLength: MAX_INFLATE_BYTES,
        });
        contentText = decompressed.toString('latin1');
      } catch {
        try {
          const decompressedRaw = zlib.inflateRawSync(rawSlice, {
            maxOutputLength: MAX_INFLATE_BYTES,
          });
          contentText = decompressedRaw.toString('latin1');
        } catch {
          contentText = '';
        }
      }
    } else if (!isFlate) {
      contentText = rawSlice.toString('latin1');
    }

    if (contentText) {
      extractedLines.push(...extractLinesFromContentStream(contentText));
    }

    streamRegex.lastIndex = endIdx + 'endstream'.length;
  }

  return extractedLines;
}

function parseNumericToken(value: string): number {
  const cleaned = value.replace(/,/g, '').trim();
  const parsed = parseFloat(cleaned);
  return Number.isFinite(parsed) ? Math.round(parsed * 100) / 100 : 0;
}

function classifyOcrCategory(description: string): OcrItemCategory {
  const lower = description.toLowerCase();
  if (/(pharmacy|drug|medication|medicine|antibiotic|anticoagulant|injection|capsule|tablet)/.test(lower)) {
    return 'PHARMACY';
  }
  if (/(surgery|surgical|catheter|ot\b|operating|anesthesia|implant|procedure|theater|theatre)/.test(lower)) {
    return 'SURGERY_OT';
  }
  if (/(bed|ward|icu|ccu|room\s*rent|room\s*charge|suite\s*rent)/.test(lower)) {
    return 'BED_RENT';
  }
  if (/(mri|ct\b|scan|x-ray|xray|pathology|diagnostic|echocardiogram|angiography|ecg|radiology|lab)/.test(lower)) {
    return 'DIAGNOSTICS';
  }
  if (/(consult|doctor|physician|surgeon|round|specialist|evaluation)/.test(lower)) {
    return 'CONSULTATION';
  }
  return 'ADMIN_SERVICE';
}

function parseLineItemFromText(line: string, pageNumber: number): OcrLineItem | null {
  const trimmed = line.trim();
  if (!trimmed || SUMMARY_LINE_PREFIX.test(trimmed)) {
    return null;
  }

  // Pattern 1: Pipe-delimited -> Description | qty | unitPrice | amount
  const pipeMatch = trimmed.match(
    /^(.+?)\s*\|\s*(\d+)\s*\|\s*(?:[$₹€£]?\s*([\d,]+(?:\.\d{1,2})?))(?:\s*\|\s*(?:[$₹€£]?\s*([\d,]+(?:\.\d{1,2})?)))?\s*$/
  );
  if (pipeMatch) {
    const description = pipeMatch[1].trim();
    const quantity = Math.max(1, parseInt(pipeMatch[2], 10) || 1);
    const unitPrice = parseNumericToken(pipeMatch[3]);
    const amount = pipeMatch[4]
      ? parseNumericToken(pipeMatch[4])
      : Math.round(quantity * unitPrice * 100) / 100;
    if (description && amount > 0) {
      return {
        description,
        quantity,
        unitPrice,
        amount,
        category: classifyOcrCategory(description),
        pageNumber,
      };
    }
  }

  // Pattern 2: Multiplication -> Description 2 x 400.00 = 800.00
  const multMatch = trimmed.match(
    /^(.+?)\s+(\d+)\s*[xX×*]\s*(?:[$₹€£]?\s*([\d,]+(?:\.\d{1,2})?))\s*(?:=\s*(?:[$₹€£]?\s*([\d,]+(?:\.\d{1,2})?)))?\s*$/
  );
  if (multMatch) {
    const description = multMatch[1].trim();
    const quantity = Math.max(1, parseInt(multMatch[2], 10) || 1);
    const unitPrice = parseNumericToken(multMatch[3]);
    const amount = multMatch[4]
      ? parseNumericToken(multMatch[4])
      : Math.round(quantity * unitPrice * 100) / 100;
    if (description && amount > 0) {
      return {
        description,
        quantity,
        unitPrice,
        amount,
        category: classifyOcrCategory(description),
        pageNumber,
      };
    }
  }

  // Pattern 3: Trailing currency amount -> Description $1,200.00 or Description USD 1,200.00
  const trailingMatch = trimmed.match(
    /^([A-Za-z][A-Za-z0-9\s,&()\/.-]{3,}?)\s+(?:USD|INR|EUR|GBP|AED|OMR|[$₹€£])\s*([\d,]+(?:\.\d{1,2})?)\s*$/i
  );
  if (trailingMatch) {
    const description = trailingMatch[1].trim();
    const amount = parseNumericToken(trailingMatch[2]);
    if (description && amount > 0 && !/^(?:currency|invoice|bill|date|case)\b/i.test(description)) {
      return {
        description,
        quantity: 1,
        unitPrice: amount,
        amount,
        category: classifyOcrCategory(description),
        pageNumber,
      };
    }
  }

  return null;
}

function isPdfBuffer(file: OcrInputFile): boolean {
  if (file.buffer.length >= 5 && file.buffer.subarray(0, 5).toString('ascii') === '%PDF-') {
    return true;
  }
  return (
    file.type.toLowerCase() === 'application/pdf' ||
    file.name.toLowerCase().endsWith('.pdf')
  );
}

/**
 * Parse uploaded medical bill files using real PDF text-stream extraction when available,
 * falling back transparently to editable starter items for raster/image-only scans.
 */
export function parseMultiPageMedicalBillOcr(
  files: OcrInputFile[]
): MultiPageOcrExtractionResult {
  const fileNames = files.map((f) => f.name);
  let hospitalName: string | undefined;
  let invoiceNumber: string | undefined;
  let currency = 'USD';

  const extractedItems: OcrLineItem[] = [];
  const pageItemsMap = new Map<number, OcrLineItem[]>();

  files.forEach((file, idx) => {
    const pageNumber = idx + 1;
    const currentPageItems: OcrLineItem[] = [];

    if (isPdfBuffer(file)) {
      const lines = extractTextFromPdfBuffer(file.buffer);
      for (const line of lines) {
        if (!invoiceNumber) {
          const invMatch = line.match(INVOICE_NUM_REGEX);
          if (invMatch) {
            invoiceNumber = invMatch[0].toUpperCase();
          }
        }

        const currMatch = line.match(SUPPORTED_CURRENCIES);
        if (currMatch && (/currency/i.test(line) || currency === 'USD')) {
          currency = currMatch[1].toUpperCase();
        }

        if (
          !hospitalName &&
          !/^AFZAL HEALTHCARE - OFFICIAL/i.test(line) &&
          !/^Verified by Afzal Healthcare/i.test(line)
        ) {
          const hospMatch = line.match(HOSPITAL_LINE_REGEX);
          if (hospMatch) {
            hospitalName = hospMatch[0].trim();
          }
        }

        const parsedItem = parseLineItemFromText(line, pageNumber);
        if (parsedItem) {
          currentPageItems.push(parsedItem);
          extractedItems.push(parsedItem);
        }
      }
    }

    pageItemsMap.set(pageNumber, currentPageItems);
  });

  if (extractedItems.length >= 1) {
    const pages: PageOcrMetadata[] = files.map((file, idx) => {
      const pageNumber = idx + 1;
      const pageItems = pageItemsMap.get(pageNumber) ?? [];
      const pageSubtotal = Math.round(
        pageItems.reduce((sum, item) => sum + item.amount, 0) * 100
      ) / 100;
      return {
        pageNumber,
        fileName: file.name,
        itemsFound: pageItems.length,
        pageSubtotal,
      };
    });

    const totalAmount = Math.round(
      extractedItems.reduce((sum, item) => sum + item.amount, 0) * 100
    ) / 100;

    return {
      hospitalName,
      invoiceNumber,
      title: hospitalName
        ? `${hospitalName} Medical Invoice${invoiceNumber ? ` (${invoiceNumber})` : ''}`
        : `Extracted Hospital Invoice${invoiceNumber ? ` (${invoiceNumber})` : ''}`,
      category: 'HOSPITAL_SURGERY',
      currency,
      totalAmount,
      items: extractedItems,
      confidenceScore: 0.94,
      extractionMode: 'PDF_TEXT',
      pageCount: files.length,
      pages,
      fileNames,
    };
  }

  // Transparent raster/image fallback: provide editable starter items per page
  const fallbackItems: OcrLineItem[] = files.map((file, idx) => ({
    description: `Scanned Page ${idx + 1} (${file.name}) — Enter Charge Description`,
    quantity: 1,
    unitPrice: 0,
    amount: 0,
    category: 'ADMIN_SERVICE',
    pageNumber: idx + 1,
  }));

  const fallbackPages: PageOcrMetadata[] = files.map((file, idx) => ({
    pageNumber: idx + 1,
    fileName: file.name,
    itemsFound: 1,
    pageSubtotal: 0,
  }));

  return {
    hospitalName,
    invoiceNumber,
    title: 'Scanned Medical Invoice (Verify Line Items)',
    category: 'HOSPITAL_SURGERY',
    currency,
    totalAmount: 0,
    items: fallbackItems,
    confidenceScore: 0.65,
    extractionMode: 'SCANNED_FALLBACK',
    pageCount: files.length,
    pages: fallbackPages,
    fileNames,
  };
}
