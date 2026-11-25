// V2: T6-011 — two backups within the same second overwrite each other's archive file
import { connect } from 'file:///E:/DEV/Chicken%20FMS/.qa-audit/harness/client.mjs';
const BASE = 'http://localhost:3125/v1';
const admin = await connect(BASE, 'admin', 'admin123');

async function triggerAndWait() {
  const t0 = Date.now();
  const r = await admin.post('/system/backup', {});
  let item;
  for (let i = 0; i < 20 && !item; i++) {
    await new Promise((res) => setTimeout(res, 150));
    const list = await admin.get('/system/backups');
    const items = list.data?.items ?? [];
    item = items.find((x) => (x.status === 'success') && new Date(x.startedAt).getTime() >= t0 - 50);
  }
  return item;
}

const b1 = await triggerAndWait();
console.log('backup1:', JSON.stringify(b1));
const b2 = await triggerAndWait();
console.log('backup2:', JSON.stringify(b2));

if (b1 && b2) {
  console.log('T6-011: same filename?', b1.filename === b2.filename, '| same checksum?', b1.checksumSha256 === b2.checksumSha256);
  console.log('b1.filename=', b1.filename, 'b2.filename=', b2.filename);
  // check disk: which checksum does the actual file on disk now have?
  const fs = await import('node:fs');
  const crypto = await import('node:crypto');
  const dir = 'E:/DEV/Chicken FMS/.qa-audit/envs/r2/backups';
  if (b1.filename === b2.filename) {
    const buf = fs.readFileSync(`${dir}/${b1.filename}`);
    const hash = crypto.createHash('sha256').update(buf).digest('hex');
    console.log('actual file on disk sha256 =', hash);
    console.log('matches b1 checksum (first run)?', hash === b1.checksumSha256);
    console.log('matches b2 checksum (second run)?', hash === b2.checksumSha256);
    console.log('==> if it matches b2 only, backup run #1 (id=' + b1.id + ') is now a DANGLING restore point: its DB row says success but the file on disk is actually run #2\'s content.');
  }
}
console.log('DONE');
