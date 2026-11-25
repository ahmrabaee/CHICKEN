// T1-08: branch dimension — JE/SLE/inventory branch tagging and /reports/stock-vs-gl branch filter (t1)
import fs from 'node:fs';
import { env, connect, logger } from './lib.mjs';
const E = env('t1', 3101); const { log, lines } = logger();
const a = await connect(E.BASE, 'admin', 'Admin@12345');
log('JE branch_id by source_type:', JSON.stringify(E.q(`select source_type, coalesce(branch_id,'NULL') br, count(*) n from journal_entries group by 1,2`)));
log('SLE branch_id:', JSON.stringify(E.q(`select voucher_type, coalesce(branch_id,'NULL') br, count(*) n, sum(stock_value_difference) v from stock_ledger_entries group by 1,2`)));
log('inventory/lots branch:', JSON.stringify(E.q(`select 'inv' t, coalesce(branch_id,'NULL') br, count(*) n from inventory group by 2 union all select 'lot', coalesce(branch_id,'NULL'), count(*) from inventory_lots group by 2`)));
const tomorrow = new Date(Date.now() + 86400000).toISOString().slice(0, 10);
for (const q of [`asOfDate=${tomorrow}`, `asOfDate=${tomorrow}&branchId=1`]) {
  const r = await a.get(`/reports/stock-vs-gl?${q}`);
  log(`stock-vs-gl ${q}:`, r.status, JSON.stringify(r.data?.summary));
}
log('raw GL 1131:', E.bal('1131'), ' inventory.total_value:', E.q(`select sum(total_value) v from inventory`)[0].v, ' SLE total:', E.q(`select sum(stock_value_difference) v from stock_ledger_entries`)[0].v);
const r = await a.post('/branches', { code: 'BR2', name: 'فرع 2', nameEn: 'Branch 2' }); log('create branch 2:', r.status, JSON.stringify(r.data ?? r.body).slice(0, 200));
log('Sale DTO accepts branchId?', 'no (CreateSaleDto has no branchId; branch taken from user/default) — multi-branch posting not reachable via API for sales');
fs.writeFileSync(new URL('./08-branch.out.txt', import.meta.url), lines.join('\n'));
