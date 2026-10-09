// RFC 4180 CSV with spreadsheet-formula neutralisation (audit M-04).
// Usernames are typed by customers; a cell like `=HYPERLINK(...)` would run when an admin opens
// the export in Excel/Sheets, so text cells starting with = + - @ (or tab/CR) get a leading quote.

const FORMULA_START = /^[=+\-@\t\r]/;

export function csvCell(value: unknown): string {
  if (value === null || value === undefined) return '';
  let s = typeof value === 'string' ? value : String(value);
  if (typeof value === 'string' && FORMULA_START.test(s)) s = `'${s}`;
  return /[",\r\n]/.test(s) || /^\s|\s$/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function toCSV(rows: Record<string, unknown>[]): string {
  if (rows.length === 0) return '';
  const headers = Object.keys(rows[0]);
  const lines = [headers.map(csvCell).join(','), ...rows.map(r => headers.map(h => csvCell(r[h])).join(','))];
  return lines.join('\r\n') + '\r\n';
}
