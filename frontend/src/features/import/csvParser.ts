export const MAX_IMPORT_ROWS = 10_000;
export const CHUNK_SIZE = 200;

export type CsvDelimiter = ',' | ';' | '\t';

export interface CsvRowObject {
  __sheetRow: number;
  [header: string]: string | number;
}

export interface ParsedCsvResult {
  headers: string[];
  rows: CsvRowObject[];
  delimiter: CsvDelimiter;
}

const FORMULA_TRIGGER_CHARS = new Set(['=', '+', '-', '@', '\t', '\r']);

/**
 * Strip UTF-8 BOM (0xFEFF) if present at the start of text.
 */
export function stripBom(text: string): string {
  if (!text) return '';
  return text.charCodeAt(0) === 0xfeff ? text.slice(1) : text;
}

/**
 * Detect delimiter among ',', ';', and '\t' by counting occurrences outside quotes
 * within the first 8192 characters.
 */
export function detectDelimiter(text: string): CsvDelimiter {
  const sample = stripBom(text).slice(0, 8192);
  const counts: Record<CsvDelimiter, number> = { ',': 0, ';': 0, '\t': 0 };
  let inQuotes = false;

  for (let i = 0; i < sample.length; i += 1) {
    const ch = sample[i]!;
    if (ch === '"') {
      if (inQuotes && sample[i + 1] === '"') {
        i += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }
    if (!inQuotes && (ch === ',' || ch === ';' || ch === '\t')) {
      counts[ch] += 1;
    }
  }

  let best: CsvDelimiter = ',';
  for (const delim of [',', ';', '\t'] as const) {
    if (counts[delim] > counts[best]) {
      best = delim;
    }
  }
  return best;
}

/**
 * Parse RFC-4180 CSV text into an array of string rows.
 * - Handles quoted fields containing delimiters or newlines
 * - Handles escaped double quotes ("")
 * - Handles CRLF, LF, and CR line endings
 * - Trims unquoted fields while preserving interior whitespace of quoted fields
 */
export function parseCsvRows(text: string, delimiter?: CsvDelimiter): string[][] {
  const clean = stripBom(String(text ?? ''));
  if (!clean.trim()) return [];
  const delim = delimiter ?? detectDelimiter(clean);

  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let inQuotes = false;
  let fieldWasQuoted = false;

  const pushField = () => {
    row.push(fieldWasQuoted ? field : field.trim());
    field = '';
    fieldWasQuoted = false;
  };

  const pushRow = () => {
    pushField();
    if (row.length === 1 && row[0] === '' && rows.length > 0) {
      // Skip trailing empty newline artifact
    } else {
      rows.push(row);
    }
    row = [];
  };

  for (let i = 0; i < clean.length; i += 1) {
    const ch = clean[i]!;

    if (inQuotes) {
      if (ch === '"') {
        if (clean[i + 1] === '"') {
          field += '"';
          i += 1;
        } else {
          inQuotes = false;
        }
      } else {
        field += ch;
      }
      continue;
    }

    if (ch === '"' && field.trim() === '') {
      inQuotes = true;
      fieldWasQuoted = true;
      field = '';
      continue;
    }

    if (ch === delim) {
      pushField();
      continue;
    }

    if (ch === '\r') {
      if (clean[i + 1] === '\n') {
        i += 1;
      }
      pushRow();
      continue;
    }

    if (ch === '\n') {
      pushRow();
      continue;
    }

    field += ch;
  }

  if (field.length > 0 || row.length > 0 || fieldWasQuoted) {
    pushRow();
  }

  return rows;
}

/**
 * Parse CSV text into header list and row objects.
 * - Skips blank lines while preserving 1-based `__sheetRow` (row 1 is header, data starts at 2)
 * - Renames empty header cells to 'Column N'
 * - Pads short rows with '' and ignores extra cells beyond headers.length
 */
export function parseCsvToObjects(text: string): ParsedCsvResult {
  const delimiter = detectDelimiter(text);
  const allRows = parseCsvRows(text, delimiter);
  if (allRows.length === 0) {
    return { headers: [], rows: [], delimiter };
  }

  const rawHeaders = allRows[0]!.map((h, idx) => {
    const trimmed = String(h ?? '').trim();
    return trimmed || `Column ${idx + 1}`;
  });

  const objects: CsvRowObject[] = [];
  for (let r = 1; r < allRows.length; r += 1) {
    const cells = allRows[r]!;
    const isBlank = cells.every((c) => String(c ?? '').trim() === '');
    if (isBlank) continue;

    const obj: CsvRowObject = { __sheetRow: r + 1 };
    for (let c = 0; c < rawHeaders.length; c += 1) {
      const key = rawHeaders[c]!;
      obj[key] = cells[c] !== undefined ? cells[c]! : '';
    }
    objects.push(obj);
  }

  return { headers: rawHeaders, rows: objects, delimiter };
}

/**
 * Validate file extension per D-5 (CSV only; reject .xls/.xlsx and any non-.csv file).
 */
export function validateCsvFileName(fileName: string): { valid: boolean; error?: string } {
  const lower = String(fileName ?? '').trim().toLowerCase();
  if (lower.endsWith('.xls') || lower.endsWith('.xlsx')) {
    return {
      valid: false,
      error:
        'Excel files (.xls, .xlsx) are not supported (D-5). Please save your spreadsheet as a UTF-8 .csv file and try again.'
    };
  }
  if (!lower.endsWith('.csv')) {
    return {
      valid: false,
      error: 'Only .csv files are accepted. Please select a valid UTF-8 .csv file.'
    };
  }
  return { valid: true };
}

/**
 * Validate file extension, parse CSV, and enforce the 10,000-row client-side cap.
 */
export function parseAndValidateCsv(
  text: string,
  fileName: string
): { ok: true; data: ParsedCsvResult } | { ok: false; error: string } {
  const nameCheck = validateCsvFileName(fileName);
  if (!nameCheck.valid) {
    return { ok: false, error: nameCheck.error! };
  }

  const parsed = parseCsvToObjects(text);
  if (parsed.headers.length === 0 || parsed.rows.length === 0) {
    return { ok: false, error: 'The CSV file has no data rows to import.' };
  }

  if (parsed.rows.length > MAX_IMPORT_ROWS) {
    return {
      ok: false,
      error: `CSV file contains ${parsed.rows.length.toLocaleString()} data rows, which exceeds the ${MAX_IMPORT_ROWS.toLocaleString()}-row limit per import job.`
    };
  }

  return { ok: true, data: parsed };
}

/**
 * Neutralise spreadsheet formula injection (CSV injection) by prefixing a single quote
 * when the first character is '=', '+', '-', '@', '\t', or '\r'.
 */
export function neutraliseFormulaCell(value: unknown): string {
  const str = String(value ?? '');
  if (str.length > 0 && FORMULA_TRIGGER_CHARS.has(str[0]!)) {
    return `'${str}`;
  }
  return str;
}

/**
 * Format a single CSV cell with optional formula neutralisation and RFC-4180 quoting.
 */
export function escapeCsvCell(value: unknown, neutraliseFormulas = true): string {
  const str = neutraliseFormulas ? neutraliseFormulaCell(value) : String(value ?? '');
  if (/[",\r\n]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

/**
 * Serialize headers and row objects to an RFC-4180 CSV string.
 */
export function toCsv(
  headers: string[],
  rows: Array<Record<string, unknown>>,
  options: { neutraliseFormulas?: boolean } = {}
): string {
  const neutralise = options.neutraliseFormulas ?? true;
  const headerLine = headers.map((h) => escapeCsvCell(h, false)).join(',');
  const bodyLines = rows.map((row) =>
    headers.map((h) => escapeCsvCell(row[h], neutralise)).join(',')
  );
  return [headerLine, ...bodyLines].join('\r\n');
}

/**
 * Build the downloadable error report CSV (`rowNumber,sourceLotCode,field,message`)
 * with formula-injection neutralisation applied to every cell.
 */
export function toErrorReportCsv(
  rowErrors: Array<{
    rowNumber: number | null;
    sourceLotCode?: string | null;
    field: string;
    message: string;
  }>
): string {
  const headers = ['rowNumber', 'sourceLotCode', 'field', 'message'];
  const rows = rowErrors.map((err) => ({
    rowNumber: err.rowNumber ?? '',
    sourceLotCode: err.sourceLotCode ?? '',
    field: err.field ?? '',
    message: err.message ?? ''
  }));
  return toCsv(headers, rows, { neutraliseFormulas: true });
}
