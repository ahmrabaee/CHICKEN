// T6-12: crafted archives through POST /system/backups/import (validation-only extraction, NO restore):
// corrupted gzip, tar without db, non-sqlite db, path traversal entries, absolute path, symlink, wrong extension, large file.
// NOTE: archives never contain assets/* (restore of assets writes into app/backend/data — forbidden for QA).
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { connect, meta, tee, outFor, QA } from './lib.mjs';
const require = createRequire('E:/DEV/Chicken FMS/app/backend/package.json');
const tar = require('tar'); // read-only use of the app's own tar dependency (v7.5.9) to BUILD archives
const log = tee(outFor(import.meta.url));
const m = meta();
const c = await connect(m.baseUrl, 'admin', 'admin123');
const W = `${QA}/tests/R2/t6/_craft`; fs.rmSync(W, { recursive: true, force: true }); fs.mkdirSync(W + '/src/db', { recursive: true });
const MARK = 'T6-TRAVERSAL-MARKER';
fs.copyFileSync(m.db, W + '/src/db/app.db'); // a valid sqlite db
fs.writeFileSync(W + '/src/evil.txt', MARK);
const upload = async (file, name, restore = false) => {
  const fd = new FormData();
  fd.append('file', new Blob([fs.readFileSync(file)]), name);
  if (restore) fd.append('restoreAfterImport', 'true');
  const r = await fetch(m.baseUrl + '/system/backups/import', { method: 'POST', headers: { Authorization: 'Bearer ' + c.token }, body: fd });
  const t = await r.text(); return { status: r.status, body: t.slice(0, 220) };
};
const mk = async (out, entries, mutate) => {
  // build with tar, then rewrite header paths via onWriteEntry/portable
  await tar.c({ gzip: true, file: out, cwd: W + '/src', portable: true, preservePaths: true, onWriteEntry: mutate }, entries);
  return out;
};
const cases = [];
fs.writeFileSync(W + '/garbage.tar.gz', Buffer.from('this is not gzip at all'));
cases.push(['garbage bytes .tar.gz', W + '/garbage.tar.gz', 'x.tar.gz']);
const good = await mk(W + '/good.tar.gz', ['db/app.db']);
const trunc = fs.readFileSync(good); fs.writeFileSync(W + '/trunc.tar.gz', trunc.subarray(0, Math.floor(trunc.length / 2)));
cases.push(['truncated valid archive', W + '/trunc.tar.gz', 't.tar.gz']);
cases.push(['valid archive but .zip name', good, 'backup.zip']);
fs.mkdirSync(W + '/src2/db', { recursive: true }); fs.writeFileSync(W + '/src2/db/app.db', 'SQLite format 3\u0000' + 'x'.repeat(5000));
await tar.c({ gzip: true, file: W + '/fakesqlite.tar.gz', cwd: W + '/src2' }, ['db/app.db']);
cases.push(['header-only fake sqlite (passes isLikelySqliteFile)', W + '/fakesqlite.tar.gz', 'f.tar.gz']);
await mk(W + '/trav.tar.gz', ['db/app.db', 'evil.txt'], (e) => { if (e.path === 'evil.txt') e.path = '../../../../T6-evil-traversal.txt'; });
cases.push(['path traversal ../../../../T6-evil-traversal.txt', W + '/trav.tar.gz', 'trav.tar.gz']);
await mk(W + '/abs.tar.gz', ['db/app.db', 'evil.txt'], (e) => { if (e.path === 'evil.txt') e.path = 'E:/DEV/Chicken FMS/.qa-audit/tests/R2/t6/_craft/T6-evil-absolute.txt'; });
cases.push(['absolute path entry', W + '/abs.tar.gz', 'abs.tar.gz']);
try { fs.symlinkSync('../../../../', W + '/src/db/up'); } catch (e) { log('symlink create failed (Windows priv):', e.code); }
if (fs.existsSync(W + '/src/db/up')) { await mk(W + '/sym.tar.gz', ['db/app.db', 'db/up']); cases.push(['symlink db/up -> ../../../../', W + '/sym.tar.gz', 'sym.tar.gz']); }
for (const [name, file, upName] of cases) log(`${name} → ${JSON.stringify(await upload(file, upName))}`);
// search for escaped marker files
const hits = [];
const scan = (d, depth) => { if (depth < 0) return; let ents = []; try { ents = fs.readdirSync(d, { withFileTypes: true }); } catch { return; } for (const e of ents) { const p = path.join(d, e.name); if (/T6-evil/.test(e.name)) hits.push(p); if (e.isDirectory() && !/node_modules|\.git$/.test(e.name)) scan(p, depth - 1); } };
scan(`${QA}/envs/r2`, 6); scan(`${QA}`, 2); scan('E:/DEV/Chicken FMS', 1); scan('E:/DEV', 0);
log('escaped marker files found:', hits);
log('staging leftovers:', fs.readdirSync(`${QA}/envs/r2/backups/.staging`));
log('files in backup dir:', fs.readdirSync(`${QA}/envs/r2/backups`));
log.save();
