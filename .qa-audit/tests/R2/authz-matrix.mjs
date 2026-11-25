// Full authorization matrix: every endpoint from Swagger, called as 5 principals.
// Safe probing: :id params use non-existent sentinel 99999; mutating bodies are empty/garbage,
// so guards (which run BEFORE the validation pipe) yield 403 when blocked and 400/404 when allowed.
// Status semantics: 401=unauth/invalid token, 403=role/page denied, 2xx/400/404/409=AUTH PASSED.
import { request } from 'file:///E:/DEV/Chicken%20FMS/.qa-audit/harness/client.mjs';
import fs from 'node:fs';
const BASE = 'http://localhost:3125/v1';
const P = JSON.parse(fs.readFileSync(new URL('./principals.json', import.meta.url)));

const principals = {
  admin: P.admin.token,
  accountant: P.accountant.token,
  revoked: P.revoked.token,
  deactivated: P.deactivated.token, // token issued before deactivation
  unauth: null,
};

// endpoints we must NOT actually fire destructively even with sentinels:
// createBackup really runs; restore/import need multipart; skip the truly dangerous POSTs from blind-firing
const SKIP_EXECUTE = new Set([
  'POST /system/backup',            // would create a real backup each principal (still test via dedicated script)
  'POST /system/backups/import',    // multipart restore
]);

function fillPath(p) {
  return p
    .replace(/\{[^}]*(id|Id)\}/g, '99999')
    .replace(/\{code\}/g, 'ZZZ')
    .replace(/\{customerNumber\}/g, 'ZZZ')
    .replace(/\{phone\}/g, '0000000')
    .replace(/\{barcode\}/g, '0000')
    .replace(/\{key\}/g, 'nonexistent_key')
    .replace(/\{group\}/g, 'nonexistent')
    .replace(/\{accountCode\}/g, '9999')
    .replace(/\{userId\}/g, '99999')
    .replace(/\{itemId\}/g, '99999');
}

async function run() {
  const docRes = await fetch(`http://localhost:3125/api/docs-json`);
  const doc = await docRes.json();
  const paths = doc.paths;
  const rows = [];
  for (const [rawPath, methods] of Object.entries(paths)) {
    for (const [method, def] of Object.entries(methods)) {
      const m = method.toUpperCase();
      if (!['GET', 'POST', 'PUT', 'PATCH', 'DELETE'].includes(m)) continue;
      // strip global /v1 prefix duplication: swagger paths already include /v1? check
      let apiPath = rawPath.startsWith('/v1') ? rawPath.slice(3) : rawPath;
      const filled = fillPath(apiPath);
      const key = `${m} ${filled}`;
      const row = { method: m, path: filled, op: def.operationId || '' };
      for (const [pname, token] of Object.entries(principals)) {
        if (SKIP_EXECUTE.has(`${m} ${apiPath.replace(/\{[^}]*\}/g, (x)=>x)}`) || SKIP_EXECUTE.has(key)) {
          row[pname] = 'skip';
          continue;
        }
        // avoid firing login/setup repeatedly destructively; still call to record status
        const body = (m === 'POST' || m === 'PUT' || m === 'PATCH') ? {} : undefined;
        try {
          const r = await request(BASE, m, filled, { token, body });
          row[pname] = r.status;
        } catch (e) {
          row[pname] = 'ERR';
        }
      }
      rows.push(row);
    }
  }
  // CSV
  const cols = ['method', 'path', 'op', 'admin', 'accountant', 'revoked', 'deactivated', 'unauth'];
  const csv = [cols.join(',')].concat(
    rows.map((r) => cols.map((c) => `"${String(r[c] ?? '').replace(/"/g, '""')}"`).join(',')),
  ).join('\n');
  fs.writeFileSync(new URL('./authz-matrix.csv', import.meta.url), csv);

  // Flag violations: non-admin principal got AUTH PASSED (not 401/403) on a path.
  const passed = (s) => typeof s === 'number' && s !== 401 && s !== 403;
  const flags = [];
  for (const r of rows) {
    const nonAdmin = ['accountant', 'revoked', 'deactivated', 'unauth'];
    for (const pr of nonAdmin) {
      if (passed(r[pr])) flags.push(`${pr}\t${r.method} ${r.path}\t(status ${r[pr]}; admin=${r.admin})`);
    }
  }
  fs.writeFileSync(new URL('./authz-violations.txt', import.meta.url), flags.join('\n'));
  console.log('endpoints tested:', rows.length);
  console.log('AUTH-PASSED-by-nonadmin count:', flags.length);
  // Summary per principal of how many endpoints they passed
  for (const pr of ['accountant', 'revoked', 'deactivated', 'unauth']) {
    const n = rows.filter((r) => passed(r[pr])).length;
    console.log(`  ${pr}: passed auth on ${n} endpoints`);
  }
}
run().catch((e) => { console.error('FATAL', e); process.exit(1); });
