import { writeFileSync } from 'node:fs';
import { setup, log, logLines, q } from './lib.mjs';
const { c, db } = await setup('t2a', 3103, { reset: false });
for (const b of ['', '?branchId=1', '?branchId=2', '?branchId=999']) {
  const r = await c.get('/inventory' + b + (b ? '&' : '?') + 'pageSize=100');
  const d = r.body?.data; const arr = Array.isArray(d) ? d : d?.items;
  log(`GET /inventory${b}`, r.status, 'rows', arr?.length, 'meta', JSON.stringify(r.body?.meta?.pagination ?? r.body?.meta ?? {}).slice(0, 120));
}
log('lots by branch', JSON.stringify(q(db, 'SELECT branch_id, COUNT(*) n FROM inventory_lots GROUP BY branch_id')));
log('inventory rows by branch', JSON.stringify(q(db, 'SELECT branch_id, COUNT(*) n FROM inventory GROUP BY branch_id')));
const r = await c.get('/reports/stock-vs-gl?branchId=2'); log('stock-vs-gl branch 2', JSON.stringify(r.data?.summary));
writeFileSync(new URL('./t05b-branch.out.txt', import.meta.url), logLines.join('\n'));
