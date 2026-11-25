// Shared Playwright helpers for T7
import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
export const HERE = path.dirname(fileURLToPath(import.meta.url));
export const SHOTS = path.join(HERE, 'shots');
fs.mkdirSync(SHOTS, { recursive: true });
export const UI = 'http://localhost:5173';
export const API = process.env.T7_API || 'http://localhost:3125/v1';
export { request, connect } from '../../../harness/client.mjs';

export async function launch({ headless = true } = {}) {
  const browser = await chromium.launch({ headless });
  const context = await browser.newContext({
    locale: 'ar', timezoneId: 'Asia/Jerusalem', viewport: { width: 1400, height: 950 },
  });
  await context.addInitScript(INIT);
  return { browser, context };
}

export const INIT = () => {
  if (window.top !== window) return;
  window.__toasts = []; window.__prints = []; window.__xss = 0;
  const seen = new WeakSet();
  const scan = () => document.querySelectorAll('li[role="status"], [data-sonner-toast], ol > li[data-state]').forEach((el) => {
    if (seen.has(el)) return; seen.add(el);
    setTimeout(() => window.__toasts.push({ t: Date.now(), text: el.innerText.trim() }), 80);
  });
  new MutationObserver(scan).observe(document, { childList: true, subtree: true });
  const origAppend = Node.prototype.appendChild;
  Node.prototype.appendChild = function (child) {
    const r = origAppend.call(this, child);
    if (child && child.tagName === 'IFRAME') {
      try {
        const w = child.contentWindow;
        const rec = { html: '', printed: false };
        window.__prints.push(rec);
        const d = w.document; const ow = d.write.bind(d);
        d.write = (h) => { rec.html += h; return ow(h); };
        w.print = () => { rec.printed = true; rec.bodyText = w.document.body ? w.document.body.innerText : ''; rec.imgs = w.document.images.length; };
      } catch (e) {}
    }
    return r;
  };
};
export async function getToasts(page) { return page.evaluate(() => window.__toasts.map((x) => x.text)); }
export async function clearToasts(page) { return page.evaluate(() => { window.__toasts = []; }); }

// Attach collectors to a page. Returns log object.
export function instrument(page, label = '') {
  const log = { console: [], pageErrors: [], failed: [], apiErrors: [], requests: [], dialogs: [], prints: 0 };
  page.on('console', (m) => {
    if (m.type() === 'error' || m.type() === 'warning') log.console.push({ type: m.type(), text: m.text().slice(0, 400), url: page.url() });
  });
  page.on('pageerror', (e) => log.pageErrors.push({ msg: String(e.message).slice(0, 400), url: page.url() }));
  page.on('requestfailed', (r) => log.failed.push({ url: r.url(), err: r.failure()?.errorText }));
  page.on('dialog', async (d) => { log.dialogs.push({ type: d.type(), msg: d.message() }); await d.accept().catch(() => {}); });
  page.on('response', async (r) => {
    const u = r.url();
    if (!u.includes('/v1/')) return;
    const req = r.request();
    const entry = { method: req.method(), url: u.replace(/^https?:\/\/[^/]+/, ''), status: r.status() };
    if (req.method() !== 'GET') { try { entry.reqBody = req.postData()?.slice(0, 2000); } catch {} }
    if (r.status() >= 400 || req.method() !== 'GET') {
      try { entry.resBody = (await r.text()).slice(0, 1500); } catch {}
    }
    log.requests.push(entry);
    if (r.status() >= 400) log.apiErrors.push(entry);
  });
  return log;
}

export async function uiLogin(page, username = 'admin', password = 'admin123') {
  await page.goto(UI + '/login');
  await page.waitForSelector('#username', { timeout: 20000 });
  await page.fill('#username', username);
  await page.fill('#password', password);
  await page.getByRole('button', { name: 'تسجيل الدخول' }).click();
  await page.waitForURL((u) => !u.pathname.startsWith('/login'), { timeout: 15000 }).catch(() => {});
}

// Collect visible toast texts (sonner + shadcn)
export async function toasts(page) {
  return page.evaluate(() => {
    const sel = '[data-sonner-toast], li[role="status"], [role="status"], ol[tabindex] > li, [data-radix-toast-announce-exclude]';
    return [...document.querySelectorAll(sel)].map((e) => e.innerText.trim()).filter(Boolean);
  });
}

export async function shot(page, name) {
  const f = path.join(SHOTS, name + '.png');
  await page.screenshot({ path: f, fullPage: true }).catch(() => {});
  return 'shots/' + name + '.png';
}

export function out(file, obj) {
  const f = path.join(HERE, file);
  fs.writeFileSync(f, typeof obj === 'string' ? obj : JSON.stringify(obj, null, 2));
}

export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
