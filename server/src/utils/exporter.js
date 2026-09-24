const PDFDocument = require('pdfkit');
const csvCell = (v) => {
  if (v == null) return '';
  let s = v instanceof Date ? v.toISOString() : String(v);
  if (/^[=+\-@\t\r]/.test(s)) s = "'" + s; // neutralise spreadsheet formula injection
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};
function sendCsv(res, { filename, columns, rows }) {
  const lines = [columns.map((c) => csvCell(c.label)).join(',')];
  rows.forEach((r) => lines.push(columns.map((c) => csvCell(c.get ? c.get(r) : r[c.key])).join(',')));
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}.csv"`);
  res.send('\ufeff' + lines.join('\r\n'));
}
function sendPdf(res, { filename, title, columns, rows }) {
  const doc = new PDFDocument({ size: 'A4', layout: 'landscape', margin: 30 });
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}.pdf"`);
  doc.pipe(res);
  doc.font('Helvetica-Bold').fontSize(16).fillColor('#16223b').text(title);
  doc.font('Helvetica').fontSize(9).fillColor('#6b7692').text(`ServiceDesk Pro  |  Generated ${new Date().toLocaleString()}  |  ${rows.length} records`);
  const W = doc.page.width - 60, total = columns.reduce((a, c) => a + (c.width || 1), 0);
  const widths = columns.map((c) => (W * (c.width || 1)) / total);
  const drawRow = (cells, y, header) => {
    if (header) doc.rect(30, y - 4, W, 16).fill('#eaf0ff');
    doc.fillColor(header ? '#1f3a8a' : '#16223b').font(header ? 'Helvetica-Bold' : 'Helvetica').fontSize(8);
    let x = 30;
    cells.forEach((t, i) => { doc.text(String(t ?? ''), x + 3, y, { width: widths[i] - 6, height: 10, ellipsis: true }); x += widths[i]; });
  };
  let y = doc.y + 12;
  drawRow(columns.map((c) => c.label), y, true); y += 18;
  rows.forEach((r, idx) => {
    if (y > doc.page.height - 45) { doc.addPage(); y = 34; drawRow(columns.map((c) => c.label), y, true); y += 18; }
    if (idx % 2) doc.rect(30, y - 4, W, 16).fill('#f6f8fc');
    drawRow(columns.map((c) => (c.get ? c.get(r) : r[c.key])), y, false); y += 16;
  });
  doc.end();
}
const sendExport = (res, format, opts) => (format === 'pdf' ? sendPdf(res, opts) : sendCsv(res, opts));
module.exports = { sendExport };
