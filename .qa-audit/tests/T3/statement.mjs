// T3 statement consistency: same customer, PLE-based period vs an empty period (falls back to Sale+Payment tables).
// usage: node statement.mjs  (t3 after lifecycle.mjs; customers 6 = scenario A, 7 = B)
import { connect, BASE, q1, log, pdfText, save } from './lib.mjs';
const a = await connect(BASE, 'admin', 'admin123');
const grab = (t) => {
  const s = t.replace(/\s+/g, ' ');
  const o = s.match(/Opening Balance (-?[\d,]+\.\d\d)/g);
  const c = s.match(/Closing Balance (-?[\d,]+\.\d\d)/);
  return { opening: o?.[o.length - 1], closing: c?.[1], tail: s.slice(-160) };
};
for (const cid of [6, 7, 9]) {
  const ple = q1(`select coalesce(sum(amount),0) s from payment_ledger_entries where party_type='customer' and party_id=? and delinked=0`, cid).s;
  const bal = q1(`select current_balance b from customers where id=?`, cid).b;
  const p1 = await pdfText(a, `/customers/${cid}/statement/pdf?language=en&startDate=2026-01-01&endDate=2026-12-31`);
  const p2 = await pdfText(a, `/customers/${cid}/statement/pdf?language=en&startDate=2027-01-01&endDate=2027-01-31`);
  log(`customer ${cid} PLE sum=${ple} currentBalance=${bal}`, '');
  log('  statement 2026 (PLE path)', grab(p1.text));
  log('  statement Jan-2027 (empty period -> fallback path); opening should equal 2026 closing', grab(p2.text));
}
save('E:/DEV/Chicken FMS/.qa-audit/tests/T3/statement.out.txt');
