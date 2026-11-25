import fs from 'node:fs';
const parse=(f)=>Object.fromEntries(fs.readFileSync(f,'utf8').split(/\r?\n/).filter(Boolean).slice(1).map(l=>{const c=l.split('","').map(s=>s.replace(/"/g,'').trim());return [c[0]+' '+c[1],c.slice(3).join(',')];}));
const o=parse('../T5/authz-matrix.csv'), n=parse('./authz-matrix.csv');
let chg=0;
for(const k of Object.keys(n)){ if(!(k in o)){console.log('NEW',k,n[k]);continue;} if(o[k]!==n[k]){chg++;console.log(k,'| old',o[k],'| new',n[k]);}}
console.log('changed',chg);
