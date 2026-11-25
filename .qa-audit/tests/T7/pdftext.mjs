import { connect, API } from './lib.mjs';
import pdf from 'pdf-parse/lib/pdf-parse.js';
const c = await connect(API, 'admin', 'admin123');
for (const p of process.argv.slice(2)) {
  const r = await fetch(API + p, { headers: { Authorization: 'Bearer ' + c.token } });
  const b = Buffer.from(await r.arrayBuffer());
  let t = ''; try { t = (await pdf(b)).text.replace(/\s+/g, ' '); } catch (e) { t = 'ERR ' + b.toString().slice(0, 200); }
  console.log(r.status, p, '\n  ', t.slice(0, 600));
}
