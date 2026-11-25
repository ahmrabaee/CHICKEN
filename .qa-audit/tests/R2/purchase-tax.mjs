import fs from 'node:fs';
import { connect } from 'file:///E:/DEV/Chicken%20FMS/.qa-audit/harness/client.mjs';
import { DatabaseSync } from 'node:sqlite';
const m = JSON.parse(fs.readFileSync('E:/DEV/Chicken FMS/.qa-audit/envs/r2/meta.json', 'utf8'));
const a = await connect(m.baseUrl, 'admin', 'admin123');
const q = (sql) => { const d = new DatabaseSync(m.db, { readOnly: true }); try { return d.prepare(sql).all(); } finally { d.close(); } };
const bal=(code,sign)=>q(`select coalesce(sum(l.debit_amount)-sum(l.credit_amount),0) b from journal_entry_lines l join accounts a on a.id=l.account_id join journal_entries e on e.id=l.journal_entry_id where a.code like '${code}%' and e.is_posted=1`)[0].b;
const snap=()=>({cash:bal('1111'),vatIn:bal('1125'),ap:bal('2110'),inv:bal('113')});
const fund = await a.post('/accounting/journal-entries', { description: 'R2 fund', entryDate: new Date().toISOString(), lines: [{ accountId: 4, debit: 10000000, credit: 0 }, { accountId: 21, debit: 0, credit: 10000000 }] });
await a.post(`/accounting/journal-entries/${fund.data.id}/post`, {});
async function run(tag){
  let s0=snap();
  const mk=(extra)=>a.post('/purchases',{supplierId:1,purchaseDate:new Date().toISOString(),taxAmount:1500,lines:[{itemId:5,weightGrams:5000,pricePerKg:2000}],paymentMethod:'cash',...extra});
  const r1=await mk({amountPaid:0}); let s1=snap();
  console.log(tag,'credit purchase net 10000+15% ->',r1.status,r1.data?.purchaseNumber,'total',r1.data?.totalAmount,'tax',r1.data?.taxAmount,'dGL',JSON.stringify(Object.fromEntries(Object.keys(s1).map(k=>[k,s1[k]-s0[k]]))));
  const r2=await mk({amountPaid: r1.data?.totalAmount ?? 11500}); let s2=snap();
  console.log(tag,'paid-in-full purchase ->',r2.status,r2.data?.purchaseNumber||r2.body?.error?.code,'dGL',JSON.stringify(Object.fromEntries(Object.keys(s2).map(k=>[k,s2[k]-s1[k]]))));
  const unb=q('select count(*) n from (select journal_entry_id from journal_entry_lines group by 1 having sum(debit_amount)<>sum(credit_amount))')[0].n;
  console.log(tag,'unbalanced JEs',unb);
}
await run('[engine OFF]');
await a.put('/settings/gl_engine_enabled',{value:'true'}); await a.put('/settings/tax_engine_enabled',{value:'true'});
await run('[engine ON ]');
