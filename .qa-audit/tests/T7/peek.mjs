import { launch, uiLogin, UI, sleep, shot } from './lib.mjs';
const { browser, context } = await launch(); const page = await context.newPage();
await uiLogin(page); await page.goto(UI + process.argv[2]); await page.waitForLoadState('networkidle'); await sleep(1500);
console.log((await page.evaluate(() => document.body.innerText)).replace(/\s+/g, ' ').slice(0, Number(process.argv[3] || 1500)));
console.log('BUTTONS', JSON.stringify((await page.getByRole('button').allInnerTexts()).map(s=>s.trim()).filter(Boolean)));
await shot(page, 'peek'); await browser.close();
