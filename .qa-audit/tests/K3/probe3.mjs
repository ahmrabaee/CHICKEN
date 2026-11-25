import { connect } from 'file:///E:/DEV/Chicken%20FMS/.qa-audit/harness/client.mjs';
import { DatabaseSync } from 'node:sqlite';
const q = (s) => { const d = new DatabaseSync('E:/DEV/Chicken FMS/.qa-audit/envs/k3/app.db', { readOnly: true }); try { return d.prepare(s).all(); } finally { d.close(); } };
const acc = await connect('http://localhost:3192/v1', 'k3acc', 'Password@123');
const lot = q(`select id from inventory_lots where item_id=4 and remaining_quantity_grams>1000 limit 1`)[0];
const r = await acc.post('/wastage', { lotId: lot.id, quantityGrams: 1000, reason: 'spoilage' });
console.log('wastage by accountant', r.status, JSON.stringify(r.body?.error ?? ''), 'SLE wastage', q(`select count(*) n from stock_ledger_entries where voucher_type='wastage'`)[0].n, 'JE wastage', q(`select count(*) n from journal_entries where source_type='wastage'`)[0].n);
