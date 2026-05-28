/**
 * Lightweight CSV + printable HTML (PDF) export helpers.
 *
 * No third-party libraries — keeps the bundle small and avoids loading large
 * PDF generators on the client. PDF output is produced by opening a
 * print-styled HTML document in a new tab and letting the user pick
 * "Save As PDF" from the browser print dialog.
 */

export interface ExportColumn {
  key: string;
  label: string;
}

/**
 * Escape a single CSV cell value per RFC 4180:
 *  - convert to string
 *  - wrap in double-quotes
 *  - double-up any internal double-quotes
 */
function escapeCSVCell(value: unknown): string {
  if (value === null || value === undefined) return '""';
  const str = String(value);
  return `"${str.replace(/"/g, '""')}"`;
}

/**
 * Convert a list of records into an RFC 4180 CSV string.
 * Uses CRLF line endings as the spec requires.
 */
export function exportCSV(
  rows: Array<Record<string, unknown>>,
  columns: ExportColumn[]
): string {
  const header = columns.map((c) => escapeCSVCell(c.label)).join(',');
  const body = rows.map((row) =>
    columns.map((c) => escapeCSVCell(row[c.key])).join(',')
  );
  return [header, ...body].join('\r\n');
}

/**
 * Trigger a browser download of a CSV string.
 * Client-only — guards against SSR by checking for `document`.
 */
export function downloadCSV(filename: string, content: string): void {
  if (typeof document === 'undefined') return;
  // BOM so Excel recognises UTF-8.
  const blob = new Blob(['﻿', content], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.setAttribute('download', filename);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  // Defer revoke so download can complete first.
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export interface PrintableSections {
  title: string;
  headerHtml: string;
  rowsHtml: string;
  footerHtml: string;
}

/**
 * Build a self-contained, print-friendly HTML document. When the document
 * loads it auto-fires the browser print dialog; the user can then save the
 * page as a PDF from there.
 */
export function printableHTML({
  title,
  headerHtml,
  rowsHtml,
  footerHtml,
}: PrintableSections): string {
  const safeTitle = title.replace(/</g, '&lt;');
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>${safeTitle}</title>
<style>
  * { box-sizing: border-box; }
  body {
    font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
    color: #1a1f2e;
    background: #ffffff;
    margin: 0;
    padding: 32px 40px;
    font-size: 12px;
    line-height: 1.5;
  }
  h1 { font-size: 22px; margin: 0 0 4px 0; color: #00736d; letter-spacing: 0.02em; }
  h2 { font-size: 14px; margin: 0 0 16px 0; color: #4a5568; font-weight: 500; }
  .brand {
    border-bottom: 2px solid #00C4BC;
    padding-bottom: 16px;
    margin-bottom: 24px;
    display: flex;
    justify-content: space-between;
    align-items: flex-end;
  }
  .brand .meta { text-align: right; font-size: 11px; color: #718096; }
  table { width: 100%; border-collapse: collapse; margin: 16px 0; }
  th, td { padding: 8px 12px; text-align: left; border-bottom: 1px solid #e2e8f0; }
  th { background: #f7fafc; text-transform: uppercase; font-size: 10px; letter-spacing: 0.05em; color: #4a5568; font-weight: 700; }
  td.num, th.num { text-align: right; font-variant-numeric: tabular-nums; }
  .footer { margin-top: 24px; padding-top: 16px; border-top: 2px solid #00C4BC; font-size: 12px; }
  .footer .total { font-size: 18px; color: #00736d; font-weight: 700; }
  .disclaimer { margin-top: 32px; font-size: 9px; color: #a0aec0; line-height: 1.4; }
  @media print {
    body { padding: 24px; }
    @page { margin: 12mm; }
  }
</style>
</head>
<body>
${headerHtml}
${rowsHtml}
${footerHtml}
<script>
  window.addEventListener('load', function () {
    setTimeout(function () { window.print(); }, 200);
  });
</script>
</body>
</html>`;
}

/**
 * Open a printable HTML document in a new tab. The browser print dialog will
 * auto-launch and the user picks "Save As PDF". Falls back to a Blob URL if
 * popups are blocked.
 */
export function downloadPrintablePDF(html: string, filename: string): void {
  if (typeof window === 'undefined') return;
  const blob = new Blob([html], { type: 'text/html;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const win = window.open(url, '_blank', 'noopener,noreferrer');
  if (!win) {
    // Popup blocked — degrade to an anchor download.
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', filename);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }
  setTimeout(() => URL.revokeObjectURL(url), 60000);
}
