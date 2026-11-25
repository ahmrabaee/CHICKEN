// Usage: node sql.mjs <db-file> "<SQL>" [--write] [--json]
// Read-only by default. Pass --write only for deliberate state seeding in YOUR OWN env DB.
import { DatabaseSync } from 'node:sqlite';
import { resolve } from 'node:path';

const args = process.argv.slice(2);
const write = args.includes('--write');
const asJson = args.includes('--json');
const [dbFile, sql] = args.filter((a) => !a.startsWith('--'));
if (!dbFile || !sql) {
  console.error('usage: node sql.mjs <db-file> "<SQL>" [--write] [--json]');
  process.exit(2);
}
const goldenGuard = resolve(dbFile).replace(/\\/g, '/').toLowerCase();
if (write && (goldenGuard.includes('/_golden/') || goldenGuard.includes('/app/backend/'))) {
  console.error('refusing --write on golden or developer database');
  process.exit(3);
}
const db = new DatabaseSync(dbFile, { readOnly: !write });
const stmt = db.prepare(sql);
const isRead = /^\s*(select|with|pragma)/i.test(sql);
if (isRead) {
  const rows = stmt.all();
  if (asJson) console.log(JSON.stringify(rows, (_, v) => (typeof v === 'bigint' ? Number(v) : v), 2));
  else if (rows.length === 0) console.log('(0 rows)');
  else console.table(rows);
} else {
  const r = stmt.run();
  console.log(`changes=${r.changes}`);
}
db.close();
