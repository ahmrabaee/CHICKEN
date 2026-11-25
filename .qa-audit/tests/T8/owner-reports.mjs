// T8 — what the owner reads at month end: PDFs (balance sheet, income statement, customer/supplier statements,
// receivables, inventory) + JSON reports, compared with the shadow truth saved by sim.mjs (out-<name>/final.json).
//   node owner-reports.mjs [--name=t8] [--port=3113] [--days=30]
process.removeAllListeners('warning'); process.on('warning', () => {});
import { connect } from 'file:///E:/DEV/Chicken%20FMS/.qa-audit/harness/client.mjs';
import { pdfRows } from './pdftext.mjs';
import fs from 'node:fs'; import path from 'node:path'; import { fileURLToPath } from 'node:url';
const HERE = path.dirname(fileURLToPath(import.meta.url));
const arg = (k, d) => { const a = process.argv.find((x) => x.startsWith(`--${k}=`)); return a ? a.split('=')[1] : d; };
const NAME = arg('name', 't8'); const PORT = arg('port', '3113'); const DAYS = Number(arg('days', 30));
const B = `http://localhost:${PORT}/v1`; const OUT = path.join(HERE, `out-${NAME}`);
const start = '2026-10-01'; const end = new Date(Date.UTC(2026, 9, DAYS)).toISOString().slice(0, 10);
await fetch(`http://localhost:${PORT}/__qaclock?set=${end}T19:30:00Z`);
const c = await connect(B, 'owner', 'Owner@12345');
const final = JSON.parse(fs.readFileSync(path.join(OUT, 'final.json'), 'utf8'));
const out = [];
async function pdf(label, p) {
  const r = await c.raw('GET', p, { raw: true });
  const buf = Buffer.from(await r.arrayBuffer());
  out.push(`\n===== ${label}  GET ${p}  -> ${r.status} ${buf.length} bytes`);
  if (r.status !== 200) { out.push(buf.toString().slice(0, 300)); return; }
  fs.writeFileSync(path.join(OUT, label.replace(/\W+/g, '_') + '.pdf'), buf);
  for (const row of await pdfRows(buf)) out.push(row);
}
await pdf('balance sheet', `/accounting/reports/balance-sheet/pdf?asOfDate=${end}&language=en`);
await pdf('income statement', `/accounting/reports/income-statement/pdf?startDate=${start}&endDate=${end}&language=en`);
await pdf('cash ledger 1111', `/accounting/reports/ledger/1111/pdf?startDate=${end}&endDate=${end}&language=en`);
await pdf('receivables', `/debts/receivables/pdf?language=en`);
await pdf('payables', `/debts/payables/pdf?language=en`);
const custs = (await c.get('/customers?pageSize=100')).data;
for (const cu of custs) await pdf(`customer statement ${cu.customerNumber}`, `/customers/${cu.id}/statement/pdf?startDate=${start}&endDate=${end}&language=en`);
const sups = (await c.get('/suppliers?pageSize=100')).data;
for (const s of (Array.isArray(sups) ? sups : sups.suppliers || sups.items || [])) await pdf(`supplier statement ${s.id}`, `/suppliers/${s.id}/statement/pdf?startDate=${start}&endDate=${end}&language=en`);
await pdf('inventory report', `/inventory/report/pdf?language=en`);
// JSON views
const j = async (p) => { const r = await c.get(p); out.push(`\n===== JSON ${p} -> ${r.status}\n` + JSON.stringify(r.data, null, 1).slice(0, 4000)); return r.data; };
await j('/reports/dashboard');
await j(`/reports/profit-loss?startDate=${start}&endDate=${end}`);
await j('/debts/summary');
await j(`/reports/stock-vs-gl?asOfDate=${end}`);
await j('/reports/inventory');
await j(`/accounting/trial-balance`);
await j(`/accounting/trial-balance?asOfDate=${end}`);
await j(`/tax/vat-report?startDate=${start}&endDate=${end}`);
out.push('\n===== SHADOW TRUTH (final.json)\n' + JSON.stringify({ customers: final.customers, suppliers: final.suppliers, items: final.items, shadowGL: final.shadowGL }, null, 1));
fs.writeFileSync(path.join(HERE, `owner-reports-${NAME}.out.txt`), out.join('\n'));
console.log('written', `owner-reports-${NAME}.out.txt`, out.length, 'lines');
