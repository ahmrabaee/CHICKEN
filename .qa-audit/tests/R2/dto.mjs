const d = await (await fetch('http://localhost:3125/api/docs-json')).json();
const S=d.components.schemas;
const want=process.argv.slice(2);
for(const w of want){const s=S[w]; if(!s){console.log(w,'?');continue;} console.log(w, JSON.stringify(s.required), Object.entries(s.properties).map(([k,v])=>k+':'+(v.type||v.$ref||'')+(v.enum?'['+v.enum+']':'')).join(', '));}
console.log(Object.keys(S).filter(k=>/Adjust|Wastage|JournalEntry|CreditNote|ReturnSale|Bulk|Settings/i.test(k)).join(' '));
