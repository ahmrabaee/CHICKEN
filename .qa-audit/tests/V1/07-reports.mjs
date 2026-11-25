import * as L from './lib.mjs';
import fs from 'node:fs'; import { execSync } from 'node:child_process';
const a = await L.admin();
const today = new Date().toISOString().slice(0, 10);
const pdf = async (path, name) => { const r = await a.raw('GET', path, { raw: true }); const buf = Buffer.from(await r.arrayBuffer()); fs.mkdirSync('pdf', { recursive: true }); fs.writeFileSync(`pdf/${name}.pdf`, buf); return { status: r.status, text: execSync(`pdftotext -layout pdf/${name}.pdf -`, { encoding: 'utf8' }) }; };
// Raw GL truth
const rows = L.sql(`select a.code,a.root_type rt,coalesce(sum(l.debit_amount),0)-coalesce(sum(l.credit_amount),0) net from accounts a left join journal_entry_lines l on l.account_id=a.id and l.journal_entry_id in (select id from journal_entries where is_posted=1) group by a.id`);
const sum = (rt) => rows.filter(r => r.rt === rt).reduce((s, r) => s + r.net, 0);
const A = sum('Asset'), Lb = -sum('Liability'), E = -sum('Equity'), Rev = -sum('Income'), Exp = sum('Expense');
L.say('GL truth: assets / liabilities / equity(3xxx) / net income', { A, Lb, E, NI: Rev - Exp, 'L+E+NI': Lb + E + Rev - Exp });
const bs = await pdf(`/accounting/reports/balance-sheet/pdf?asOfDate=${today}`, 'bs-today');
L.say('BS pdf status', bs.status);
console.log(bs.text.split('\n').filter(l => l.trim()).join('\n'));
// TB asOfDate semantic
const tbY = await a.get(`/accounting/trial-balance?asOfDate=2025-12-31`);
const tbT = await a.get(`/accounting/trial-balance?asOfDate=${today}`);
const tbE = await a.get(`/accounting/trial-balance?endDate=2025-12-31`);
const show = (r) => JSON.stringify(r.data).slice(0, 500);
L.say('TB asOfDate=2025-12-31 (past; GL empty then) ', L.st(tbY)); console.log(show(tbY));
L.say('TB endDate=2025-12-31', L.st(tbE)); console.log(show(tbE));
const bsOld = await pdf(`/accounting/reports/balance-sheet/pdf?asOfDate=2025-12-31`, 'bs-2025');
console.log('--- BS as of 2025-12-31 ---'); console.log(bsOld.text.split('\n').filter(l => l.trim()).join('\n'));
