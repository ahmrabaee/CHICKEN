import fs from 'node:fs'; import path from 'node:path';
const root = 'E:/DEV/Chicken FMS/.qa-audit/tests';
const files = []; (function walk(d){ for (const f of fs.readdirSync(d,{withFileTypes:true})) { const p=path.join(d,f.name); if (f.isDirectory()) { if (f.name==='node_modules'||f.name==='G') continue; walk(p);} else if (/\.(mjs|js|ts)$/.test(f.name)) files.push(p);} })(root);
const bytester = {}; for (const f of files) { const t = path.relative(root,f).split(path.sep)[0]; (bytester[t] ||= []).push(fs.readFileSync(f,'utf8')); }
const gfiles = fs.readdirSync(root+'/G').filter(f=>f.endsWith('.mjs')).map(f=>fs.readFileSync(root+'/G/'+f,'utf8')).join('\n');
const rows = fs.readFileSync(root+'/K3/endpoints.md','utf8').split('\n').slice(2).filter(Boolean).map(l=>l.split('|').map(s=>s.trim())).map(c=>({m:c[1],p:c[2].replace('/v1','')}));
const seen=new Set(); const out=[];
for (const r of rows) { const k=r.m+' '+r.p; if (seen.has(k)) continue; seen.add(k);
  // build regex from path: static prefix before first :param
  const stat = r.p.split('/:')[0]; const hasParam = r.p.includes('/:');
  const tail = r.p.split('/').filter(s=>!s.startsWith(':')).pop();
  const hits = Object.entries(bytester).filter(([t,srcs])=>srcs.some(s=> hasParam ? (s.includes(stat) && (r.p.split('/:').length===2 && r.p.split('/:')[1].includes('/') ? s.includes('/'+r.p.split('/:')[1].split('/').slice(1).join('/')) : true)) : s.includes(r.p)||s.includes(r.p.replace('/accounting','')) )).map(([t])=>t);
  const g = gfiles.includes(stat) ? ['G'] : [];
  out.push([r.m, r.p, [...hits, ...g].join(',')]);
}
for (const o of out) console.log(o[0].padEnd(6), o[1].padEnd(52), o[2] || '*** NONE ***');
