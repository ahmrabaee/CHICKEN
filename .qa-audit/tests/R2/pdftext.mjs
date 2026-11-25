import { createRequire } from 'node:module';
import fs from 'node:fs';
const require = createRequire('file:///E:/DEV/Chicken%20FMS/.qa-audit/tests/T7/package.json');
const pdf = require('pdf-parse/lib/pdf-parse.js');
for (const f of process.argv.slice(2)) { const t=(await pdf(fs.readFileSync(f))).text.replace(/\s+/g,' '); console.log(f,'\n ',t.slice(0,Number(process.env.N||900))); }
