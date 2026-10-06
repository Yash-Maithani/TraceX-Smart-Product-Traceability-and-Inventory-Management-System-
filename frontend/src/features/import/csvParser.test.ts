import { describe, expect, it } from 'vitest';
import {
  detectDelimiter,
  escapeCsvCell,
  MAX_IMPORT_ROWS,
  neutraliseFormulaCell,
  parseAndValidateCsv,
  parseCsvRows,
  parseCsvToObjects,
  stripBom,
  toCsv,
  toErrorReportCsv,
  validateCsvFileName
} from './csvParser';

describe('csvParser (Phase 8 Part C & D)', () => {
  it('strips UTF-8 BOM (0xFEFF) when present', () => {
    const withBom = '\uFEFFsourceLotCode,productSku\nLOT-1,JAM-BERRY-500G';
    expect(stripBom(withBom)).toBe('sourceLotCode,productSku\nLOT-1,JAM-BERRY-500G');
    expect(stripBom('normal,text')).toBe('normal,text');
    expect(stripBom('')).toBe('');
  });

  it('auto-detects comma, semicolon, and tab delimiters while ignoring quoted delimiters', () => {
    expect(detectDelimiter('a,b,c\n1,2,3')).toBe(',');
    expect(detectDelimiter('a;b;c\n1;2;3')).toBe(';');
    expect(detectDelimiter('a\tb\tc\n1\t2\t3')).toBe('\t');
    // Semicolons inside quotes should not outweigh real comma delimiters
    expect(detectDelimiter('"a;b;c;d",e,f\n"1;2;3;4",5,6')).toBe(',');
  });

  it('parses RFC-4180 quoted fields, escaped quotes (""), commas inside quotes, and newlines inside quotes', () => {
    const csv = [
      'sourceLotCode,village,notes',
      '"LOT-001","Sopore, Baramulla","Said ""Grade A"" harvest\nLine two"',
      '  LOT-002  ,"  Preserved Interior Space  ",Simple'
    ].join('\r\n');

    const rows = parseCsvRows(csv);
    expect(rows).toHaveLength(3);
    expect(rows[1]).toEqual([
      'LOT-001',
      'Sopore, Baramulla',
      'Said "Grade A" harvest\nLine two'
    ]);
    // Unquoted fields trimmed, quoted fields preserve leading/trailing whitespace
    expect(rows[2]).toEqual(['LOT-002', '  Preserved Interior Space  ', 'Simple']);
  });

  it('supports CRLF, LF, and CR line endings identically', () => {
    const crlf = 'a,b\r\n1,2\r\n3,4';
    const lf = 'a,b\n1,2\n3,4';
    const cr = 'a,b\r1,2\r3,4';

    expect(parseCsvRows(crlf)).toEqual([
      ['a', 'b'],
      ['1', '2'],
      ['3', '4']
    ]);
    expect(parseCsvRows(lf)).toEqual(parseCsvRows(crlf));
    expect(parseCsvRows(cr)).toEqual(parseCsvRows(crlf));
  });

  it('skips blank lines while preserving 1-based __sheetRow, renames empty headers, pads short rows, and ignores extra cells', () => {
    const csv = [
      'sourceLotCode,,quantityProduced',
      'LOT-A,val1,100',
      '   ,   ,   ',
      'LOT-B',
      'LOT-C,val3,300,EXTRA-IGNORED-CELL'
    ].join('\n');

    const parsed = parseCsvToObjects(csv);
    expect(parsed.headers).toEqual(['sourceLotCode', 'Column 2', 'quantityProduced']);
    expect(parsed.rows).toHaveLength(3);
    // Row 1 is header, Row 2 is LOT-A, Row 3 is blank (skipped), Row 4 is LOT-B, Row 5 is LOT-C
    expect(parsed.rows[0]).toEqual({
      __sheetRow: 2,
      sourceLotCode: 'LOT-A',
      'Column 2': 'val1',
      quantityProduced: '100'
    });
    expect(parsed.rows[1]).toEqual({
      __sheetRow: 4,
      sourceLotCode: 'LOT-B',
      'Column 2': '',
      quantityProduced: ''
    });
    expect(parsed.rows[2]).toEqual({
      __sheetRow: 5,
      sourceLotCode: 'LOT-C',
      'Column 2': 'val3',
      quantityProduced: '300'
    });
  });

  it('rejects .xls, .xlsx, and non-.csv file extensions client-side (D-5)', () => {
    const xlsCheck = validateCsvFileName('batches.xls');
    expect(xlsCheck.valid).toBe(false);
    expect(xlsCheck.error).toMatch(/Excel files \(\.xls, \.xlsx\) are not supported/i);

    const xlsxCheck = parseAndValidateCsv('a,b\n1,2', 'batches.xlsx');
    expect(xlsxCheck.ok).toBe(false);
    if (!xlsxCheck.ok) {
      expect(xlsxCheck.error).toMatch(/Excel files \(\.xls, \.xlsx\) are not supported/i);
    }

    const txtCheck = validateCsvFileName('batches.txt');
    expect(txtCheck.valid).toBe(false);
    expect(txtCheck.error).toMatch(/Only \.csv files are accepted/i);

    expect(validateCsvFileName('Batches_2026.CSV').valid).toBe(true);
  });

  it('rejects CSV files with more than 10,000 data rows client-side', () => {
    const lines = ['sourceLotCode,productSku'];
    for (let i = 1; i <= MAX_IMPORT_ROWS + 1; i += 1) {
      lines.push(`LOT-${i},JAM-BERRY-500G`);
    }
    const result = parseAndValidateCsv(lines.join('\n'), 'oversize.csv');
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toMatch(/exceeds the 10,000-row limit/i);
    }
  });

  it('neutralises formula-injection cells starting with =, +, -, @, tab, or CR in error report CSV', () => {
    expect(neutraliseFormulaCell('=CMD|\' /C calc\'!A0')).toBe("'=CMD|' /C calc'!A0");
    expect(neutraliseFormulaCell('+SUM(A1:A2)')).toBe("'+SUM(A1:A2)");
    expect(neutraliseFormulaCell('-10+20')).toBe("'-10+20");
    expect(neutraliseFormulaCell('@HYPERLINK("http://evil")')).toBe("'@HYPERLINK(\"http://evil\")");
    expect(neutraliseFormulaCell('\tTAB_FORMULA')).toBe("'\tTAB_FORMULA");
    expect(neutraliseFormulaCell('\rCR_FORMULA')).toBe("'\rCR_FORMULA");
    expect(neutraliseFormulaCell('SAFE-LOT-01')).toBe('SAFE-LOT-01');

    const reportCsv = toErrorReportCsv([
      {
        rowNumber: 2,
        sourceLotCode: '=1+1',
        field: 'productSku',
        message: '+Unknown product, check quote "X"'
      }
    ]);

    const lines = reportCsv.split('\r\n');
    expect(lines[0]).toBe('rowNumber,sourceLotCode,field,message');
    expect(lines[1]).toBe('2,\'=1+1,productSku,"\'+Unknown product, check quote ""X"""');

    expect(escapeCsvCell('normal', true)).toBe('normal');
    expect(toCsv(['col'], [{ col: '@danger' }])).toBe("col\r\n'@danger");
  });
});
