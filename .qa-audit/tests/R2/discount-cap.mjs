// R2: discount cap variants as accountant vs admin (QA-008 / claim C-6)
import fs from 'node:fs';
import { connect } from 'file:///E:/DEV/Chicken%20FMS/.qa-audit/harness/client.mjs';
const m = JSON.parse(fs.readFileSync('E:/DEV/Chicken FMS/.qa-audit/envs/r2/meta.json','utf8'));
const adm = await connect(m.baseUrl,'admin','admin123');
const roles=(await adm.get('/users/roles')).data; const accRole=roles.find(r=>r.name==='accountant').id;
await adm.post('/users',{username:'r2disc',password:'password123',fullName:'R2 Disc',roleId:accRole});
const acc = await connect(m.baseUrl,'r2disc','password123');
const L=(g,p,d)=>({itemId:6,weightGrams:g,pricePerKg:p,...(d!=null?{discountAmount:d}:{})});
const ok=(r)=>r.ok?`201 total=${r.data.totalAmount} disc=${r.data.discountAmount} profit=${r.data.totalProfit}`:`${r.status} ${r.body?.error?.code}`;
async function t(label, who, body){ const r=await who.post('/sales',{saleType:'cash',...body}); console.log(label.padEnd(62), ok(r)); }
const P=4000; 
await t('acc pct 500 (5%) [expect allow]',acc,{discountPct:500,lines:[L(1000,P)],payments:[{paymentMethod:'cash',amount:3800}]});
await t('acc pct 501 [expect block]',acc,{discountPct:501,lines:[L(1000,P)]});
await t('acc header amount 200/4000 (5%) [allow]',acc,{discountAmount:200,lines:[L(1000,P)],payments:[{paymentMethod:'cash',amount:3800}]});
await t('acc header amount 400/4000 (10%) [block]',acc,{discountAmount:400,lines:[L(1000,P)]});
await t('acc header amount 2000/4000 (50%) [block]',acc,{discountAmount:2000,lines:[L(1000,P)]});
await t('acc line discount 3900/4000 [block]',acc,{lines:[L(1000,P,3900)]});
await t('acc line 150 + header 100 (6.25% combined) [block]',acc,{discountAmount:100,lines:[L(1000,P,150)]});
await t('acc two lines, one -2000 and one +2000 line disc (net 0) [?]',acc,{lines:[L(1000,P,-2000),L(1000,P,2000)],payments:[{paymentMethod:'cash',amount:8000}]});
await t('acc pricePerKg 1 agora x 10kg [price override]',acc,{lines:[L(10000,1)],payments:[{paymentMethod:'cash',amount:10}]});
await t('acc pricePerKg 100 (1.00/kg vs list ~?) 5kg',acc,{lines:[L(5000,100)],payments:[{paymentMethod:'cash',amount:5}]});
await t('acc pricePerKg 0 [?]',acc,{lines:[L(1000,0)]});
await t('acc pricePerKg 1 + discountAmount 0.. 100% via 2 lines: line A price 1 weight 1g',acc,{lines:[L(1,1)]});
await t('acc 100% pct 10000 [block]',acc,{discountPct:10000,lines:[L(1000,P)]});
await t('acc fractional weight 0.4g gross 0 + disc 99999 [?]',acc,{discountAmount:99999,lines:[L(0.4,P)]});
await t('acc: header discount on a zero-priced cheap line + other line',acc,{discountAmount:3900,lines:[L(1000,P),L(1000,1)]});
await t('admin 100% pct 10000 [admin unlimited]',adm,{discountPct:10000,lines:[L(1000,P)]});
