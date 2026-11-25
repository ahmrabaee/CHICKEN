// Extract text rows from a PDF buffer (pdfjs), grouped by y coordinate. Used to read the owner-facing PDFs.
import { getDocument } from 'pdfjs-dist/legacy/build/pdf.mjs';
export async function pdfRows(buf) {
  const doc = await getDocument({ data: new Uint8Array(buf), verbosity: 0 }).promise;
  const rows = [];
  for (let p = 1; p <= doc.numPages; p++) {
    const page = await doc.getPage(p); const tc = await page.getTextContent();
    const byY = new Map();
    for (const it of tc.items) { if (!it.str.trim()) continue; const y = Math.round(it.transform[5]); if (!byY.has(y)) byY.set(y, []); byY.get(y).push({ x: it.transform[4], s: it.str }); }
    for (const y of [...byY.keys()].sort((a, b) => b - a)) rows.push(`p${p} ` + byY.get(y).sort((a, b) => a.x - b.x).map((i) => i.s).join(' | '));
  }
  return rows;
}
