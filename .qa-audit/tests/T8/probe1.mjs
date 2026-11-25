import { connect, request } from 'file:///E:/DEV/Chicken%20FMS/.qa-audit/harness/client.mjs';
const B='http://localhost:3113/v1';
let r = await request(B,'POST','/auth/setup',{body:{businessName:'ملحمة الدجاج الطازج',businessNameEn:'Fresh Chicken Butcher',adminUsername:'owner',adminPassword:'Owner@12345',adminFullName:'صاحب المحل',preferredLanguage:'ar'}});
console.log('setup',r.status,JSON.stringify(r.body).slice(0,500));
const c = await connect(B,'owner','Owner@12345');
for (const p of ['/branches','/users/roles','/settings','/bank-accounts','/categories','/items','/expenses/categories','/barcode/config','/tax/templates']) { const x=await c.get(p); console.log(p,x.status,JSON.stringify(x.body).slice(0,1500)); }
