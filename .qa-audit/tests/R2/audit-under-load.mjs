// R2: are audit rows lost under concurrent load (fire-and-forget insert, errors swallowed)? + oversized legal body truncation
import fs from 'node:fs';
import { connect } from 'file:///E:/DEV/Chicken%20FMS/.qa-audit/harness/client.mjs';
import { DatabaseSync } from 'node:sqlite';
const m = JSON.parse(fs.readFileSync('E:/DEV/Chicken FMS/.qa-audit/envs/r2/meta.json', 'utf8'));
const a = await connect(m.baseUrl, 'admin', 'admin123');
const q = (sql) => { const d = new DatabaseSync(m.db, { readOnly: true }); try { return d.prepare(sql).all(); } finally { d.close(); } };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const b0 = q("select count(*) n from audit_logs where entity_type='sales' and action='create'")[0].n;
const s0 = q('select count(*) n from sales')[0].n;
let stop = false, ok = 0, bad = {};
const w = async () => { while (!stop) { const r = await a.post('/sales', { saleType: 'cash', lines: [{ itemId: 5, weightGrams: 10, pricePerKg: 2800 }], payments: [{ paymentMethod: 'cash', amount: 28 }] }); if (r.ok) ok++; else bad[r.status] = (bad[r.status] || 0) + 1; } };
const ws = [w(), w(), w(), w(), w()];
await sleep(Number(process.env.SECS || 20) * 1000); stop = true; await Promise.all(ws); await sleep(3000);
const b1 = q("select count(*) n from audit_logs where entity_type='sales' and action='create'")[0].n;
const s1 = q('select count(*) n from sales')[0].n;
console.log('sales 201:', ok, 'failures', JSON.stringify(bad), '| sales rows added', s1 - s0, '| audit sales/create rows added', b1 - b0, '| LOST audit rows', (s1 - s0) - (b1 - b0));
// big legal body: sale with 120 lines
const lines = Array.from({ length: 120 }, () => ({ itemId: 6, weightGrams: 10, pricePerKg: 2800 }));
const r = await a.post('/sales', { saleType: 'credit', customerId: 1, notes: 'r2 big', lines });
console.log('120-line sale ->', r.status);
const row = q("select id,length(changes) cl,changes from audit_logs where entity_type='sales' order by id desc limit 1")[0];
let valid = true; try { JSON.parse(row.changes); } catch { valid = false; }
console.log('last audit row len', row.cl, 'valid JSON', valid);
