import { connect, BASE } from './lib.mjs';
const a = await connect(BASE, 'admin', 'Hacked12345');
const names = (r)=> (Array.isArray(r.data)?r.data:(r.data.items||r.data.branches||[])).map(x=>x.name||x.username||x.id+'');
for (const p of ['/items?pageSize=100','/customers?pageSize=100','/suppliers?pageSize=100','/users','/categories','/branches']) {
  const base = await a.get(p); 
  const res = {};
  for (const v of ['true','false','1','0','']) { const r = await a.get(p+(p.includes('?')?'&':'?')+'isActive='+v); res[v||'(empty)'] = r.status===200? names(r).length : r.status; }
  console.log(p.padEnd(26),'no-filter', names(base).length, JSON.stringify(res));
}
console.log('items lowStock=false', (await a.get('/items?lowStock=false&pageSize=100')).data.length, 'lowStock=true', (await a.get('/items?lowStock=true&pageSize=100')).data.length, 'none', (await a.get('/items?pageSize=100')).data.length);
console.log('customers hasBalance=false', (await a.get('/customers?hasBalance=false&pageSize=100')).data.length, 'true', (await a.get('/customers?hasBalance=true&pageSize=100')).data.length);
// does items default list include inactive?
const all = (await a.get('/items?pageSize=100')).data; console.log('default items list includes inactive?', all.filter(i=>i.isActive===false).length);
const cl = (await a.get('/customers?pageSize=100')).data; console.log('default customers list includes inactive?', (cl.items||cl).filter(i=>i.isActive===false).length);
