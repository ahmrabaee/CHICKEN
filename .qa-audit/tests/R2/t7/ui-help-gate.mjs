import { launch, instrument, uiLogin, UI, API, sleep, connect } from './lib.mjs';
const c = await connect(API, 'admin', 'admin123');
const users=(await c.get('/users')).data; const u=(Array.isArray(users)?users:users.items).find(x=>x.username==='r2rev');
const pa=await c.get(`/page-access/user/${u.id}`);
await c.put('/page-access/bulk',{items:pa.data.pages.map(p=>({userId:u.id,pageKey:p.key,allowed:p.key==='dashboard'}))});
const { browser, context } = await launch(); const p = await context.newPage(); const log=instrument(p);
await uiLogin(p,'r2rev','password456'); await sleep(1500);
const sb=await p.evaluate(()=>[...document.querySelectorAll('aside a, nav a')].map(a=>a.getAttribute('href')));
console.log('sidebar (only dashboard allowed):',JSON.stringify(sb));
for (const path of ['/help','/inventory','/sales/new','/audit']) { await p.goto(UI+path); await sleep(1500); console.log(path,'->',p.url().replace(UI,''),'|',(await p.evaluate(()=>document.body.innerText.replace(/\s+/g,' '))).slice(0,110)); }
const fab=await p.evaluate(()=>[...document.querySelectorAll('button[aria-label]')].map(x=>x.getAttribute('aria-label')).filter(x=>/مساعدة|دليل/.test(x))); console.log('FAB on /audit-denied page:',JSON.stringify(fab));
const api=await fetch(API+'/inventory',{headers:{Authorization:'Bearer '+(await p.evaluate(()=>localStorage.getItem('access_token')))}}); console.log('API /inventory with that token',api.status);
await browser.close();
