// Parse NestJS controllers -> endpoint inventory with effective guards (static analysis)
// usage: node endpoints.mjs [--json]
import fs from 'node:fs';
import path from 'node:path';
const SRC = 'E:/DEV/Chicken FMS/app/backend/src';
const files = [];
(function walk(d) {
  for (const f of fs.readdirSync(d)) {
    const p = path.join(d, f);
    if (fs.statSync(p).isDirectory()) walk(p);
    else if (f.endsWith('.controller.ts')) files.push(p);
  }
})(SRC);

function parenDelta(s) { let d = 0; for (const c of s) { if (c === '(' || c === '{' || c === '[') d++; else if (c === ')' || c === '}' || c === ']') d--; } return d; }

const rows = [];
for (const file of files) {
  const lines = fs.readFileSync(file, 'utf8').split(/\r?\n/);
  const classIdx = lines.findIndex((l) => /export class \w*Controller/.test(l));
  if (classIdx < 0) continue;
  let headStart = 0;
  for (let i = 0; i < classIdx; i++) if (/^(export )?class /.test(lines[i]) || /^\}/.test(lines[i])) headStart = i + 1;
  const head = lines.slice(headStart, classIdx).join('\n');
  const ctrl = (head.match(/@Controller\(\s*['"`]?([^'"`)]*)['"`]?\s*\)/) || [])[1] ?? '';
  const cGuards = [...head.matchAll(/@UseGuards\(([^)]*)\)/g)].map((m) => m[1]).join(',');
  const cRoles = (head.match(/@Roles\(([^)]*)\)/) || [])[1] ?? '';
  const cPage = (head.match(/@RequirePageAccess\(([^)]*)\)/) || [])[1] ?? '';
  const cPublic = /@Public\(\)/.test(head);
  let pending = '';
  let pendingLine = -1;
  let depth = 0;
  for (let i = classIdx + 1; i < lines.length; i++) {
    const l = lines[i].trim();
    if (depth > 0) { pending += ' ' + l; depth += parenDelta(l); continue; }
    if (l.startsWith('@')) {
      if (pendingLine < 0) pendingLine = i;
      pending += ' ' + l;
      depth = parenDelta(l);
      continue;
    }
    const m = l.match(/^(?:public\s+|private\s+)?(?:async\s+)?([a-zA-Z0-9_]+)\s*\(/);
    if (m && pending) {
      const http = pending.match(/@(Get|Post|Put|Patch|Delete)\(\s*(?:['"`]([^'"`]*)['"`])?/);
      if (http) {
        const mRoles = (pending.match(/@Roles\(([^)]*)\)/) || [])[1];
        const mGuards = [...pending.matchAll(/@UseGuards\(([^)]*)\)/g)].map((x) => x[1]).join(',');
        const mPage = (pending.match(/@RequirePageAccess\(([^)]*)\)/) || [])[1];
        const pub = cPublic || /@Public\(\)/.test(pending);
        const guards = [cGuards, mGuards].filter(Boolean).join(',');
        const roles = (mRoles ?? cRoles).replace(/['"\s]/g, '');
        const page = (mPage ?? cPage).replace(/['"\s]/g, '');
        const full = ('/v1/' + [ctrl, http[2] || ''].filter(Boolean).join('/')).replace(/\/+/g, '/');
        rows.push({
          method: http[1].toUpperCase(), path: full, handler: m[1], public: pub,
          roles: roles || '-', rolesEnforced: /RolesGuard/.test(guards),
          page: page || '-', pageEnforced: /PageAccessGuard/.test(guards),
          guards: guards || '-',
          file: path.relative(SRC, file).split(path.sep).join('/') + ':' + (pendingLine + 1),
        });
      }
      pending = ''; pendingLine = -1;
    } else if (l && !l.startsWith('//') && !l.startsWith('*') && !l.startsWith('/*')) {
      // non-decorator, non-method line: reset only on statement ends
      if (/^}/.test(l) || /;$/.test(l)) { pending = ''; pendingLine = -1; }
    }
  }
}
if (process.argv[2] === '--json') {
  console.log(JSON.stringify(rows, null, 1));
} else {
  console.log('| Method | Path | Handler | Public | Roles (declared) | RolesGuard applied | Page (declared) | PageAccessGuard applied | File |');
  console.log('|---|---|---|---|---|---|---|---|---|');
  for (const r of rows) {
    console.log(`| ${r.method} | ${r.path} | ${r.handler} | ${r.public ? '**PUBLIC**' : ''} | ${r.roles} | ${r.roles === '-' ? '' : r.rolesEnforced ? 'yes' : '**NO**'} | ${r.page} | ${r.page === '-' ? '' : r.pageEnforced ? 'yes' : '**NO**'} | ${r.file} |`);
  }
  console.error('total', rows.length);
}
