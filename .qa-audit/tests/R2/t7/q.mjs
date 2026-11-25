import { connect } from './lib.mjs';
const c = await connect(process.env.T7_API || 'http://localhost:3125/v1', 'admin', 'admin123');
for (const p of process.argv.slice(2)) { const r = await c.get(p); console.log(p, r.status, JSON.stringify(r.body).slice(0, 1500)); }
