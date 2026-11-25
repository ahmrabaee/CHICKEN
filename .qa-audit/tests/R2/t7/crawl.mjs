// Visit every route as a given user; record console errors, page errors, failed/4xx/5xx API calls, and access-denied state.
// usage: node crawl.mjs [username] [password] [outName]
import { launch, instrument, uiLogin, shot, out, UI, sleep } from './lib.mjs';
const [user = 'admin', pass = 'admin123', name = 'crawl-admin'] = process.argv.slice(2);
const routes = ['/', '/inventory', '/inventory?tab=categories', '/inventory?tab=stock-transfer', '/inventory/new', '/inventory/1',
  '/sales/new', '/sales', '/sales/1', '/purchasing', '/purchasing/1', '/purchasing/new', '/purchasing/1/edit',
  '/customers', '/customers/new', '/customers/1', '/traders', '/traders/new', '/traders/1',
  '/payments', '/payments/new', '/payments/1', '/reconciliation', '/credit-notes', '/credit-notes/new',
  '/expenses', '/expenses/new', '/expenses/1', '/debts', '/wastage', '/wastage/new', '/stock-transfer/new',
  '/reports', '/reports/sales', '/reports/purchases', '/reports/inventory', '/reports/expenses', '/reports/profit-loss',
  '/reports/wastage', '/reports/vat', '/reports/stock-vs-gl', '/accounting', '/accounting/journal/new', '/audit',
  '/settings', '/users', '/branches', '/branches/new', '/branches/1', '/categories', '/adjustments', '/stock-transfer', '/nonexistent'];
const { browser, context } = await launch();
const page = await context.newPage();
const log = instrument(page);
await uiLogin(page, user, pass);
const results = [];
for (const r of routes) {
  const c0 = log.console.length, e0 = log.pageErrors.length, a0 = log.apiErrors.length, q0 = log.requests.length;
  await page.goto(UI + r).catch((e) => {});
  await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {});
  await sleep(700);
  const body = await page.evaluate(() => document.body.innerText.slice(0, 20000));
  const denied = /لا يمكن لغير المسؤول|غير مصرح|ليس لديك صلاحية|Access Denied|لا تملك/.test(body);
  const crashed = /Something went wrong|حدث خطأ غير متوقع|Unexpected Application Error/.test(body) || body.trim().length < 20;
  const res = {
    route: r, finalUrl: page.url().replace(UI, ''), denied, crashed,
    consoleErrors: log.console.slice(c0).filter((x) => x.type === 'error').map((x) => x.text),
    pageErrors: log.pageErrors.slice(e0).map((x) => x.msg),
    apiErrors: log.apiErrors.slice(a0).map((x) => `${x.method} ${x.url} -> ${x.status} ${x.resBody?.slice(0, 200) || ''}`),
    apiCalls: log.requests.slice(q0).map((x) => `${x.method} ${x.url} ${x.status}`),
  };
  if (res.pageErrors.length || res.crashed || res.apiErrors.length) await shot(page, `${name}${r.replace(/[\/?=]/g, '_')}`);
  results.push(res);
  console.log(`${r} -> ${res.finalUrl} denied=${denied} crashed=${crashed} cErr=${res.consoleErrors.length} pErr=${res.pageErrors.length} api4xx5xx=${res.apiErrors.length}`);
}
out(name + '.json', results);
out(name + '.out.txt', results.map((r) => `${r.route} -> ${r.finalUrl} denied=${r.denied} crashed=${r.crashed}\n  pageErrors: ${JSON.stringify(r.pageErrors)}\n  apiErrors: ${JSON.stringify(r.apiErrors)}\n  consoleErrors(${r.consoleErrors.length}): ${JSON.stringify(r.consoleErrors.slice(0, 4))}`).join('\n'));
await browser.close();
