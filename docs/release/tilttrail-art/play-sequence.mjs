import { chromium } from '@playwright/test';
import fs from 'node:fs/promises';

const browser = await chromium.launch({ executablePath: '/usr/bin/chromium', args: ['--no-sandbox', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const context = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1, hasTouch: true, isMobile: true });
const page = await context.newPage(), errors = [], frames = [];
page.on('pageerror', e => errors.push(e.message));
await page.goto('http://127.0.0.1:4332/games/tilttrail/?lang=en');
await page.getByRole('button', { name: 'Play this stage' }).click();
const session = await context.newCDPSession(page);
async function hold(type) {
  const b = await page.locator(`[data-tt-input="${type}"]`).boundingBox();
  await session.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ id: 1, x: b.x + b.width / 2, y: b.y + b.height / 2, radiusX: 5, radiusY: 5, force: 1 }] });
}
async function release() { await session.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] }); }
async function snapshot() {
  return page.locator('#tilttrail').evaluate(el => ({ state: { ...el.dataset }, brakeHeld: el.querySelector('[data-tt-input="brake"]').getAttribute('aria-pressed'), rightHeld: el.querySelector('[data-tt-input="right"]').getAttribute('aria-pressed') }));
}
async function capture(name) {
  const before = await snapshot();
  await page.screenshot({ path: new URL(`./evidence/sequence-${name}.png`, import.meta.url).pathname });
  frames.push({ name, before, after: await snapshot() });
  await fs.writeFile(new URL('./evidence/play-sequence.json', import.meta.url), JSON.stringify({ ordinaryInput: true, input: 'native touch brake, native keyboard left/right', deliberatelyHeldRightOffRoad: true, errors, frames }, null, 2));
}
await hold('brake');
await page.waitForFunction(() => Number(document.querySelector('#tilttrail').dataset.time) >= 1.5); await capture('01-braking');
await page.waitForFunction(() => Number(document.querySelector('#tilttrail').dataset.time) >= 2.3); await capture('02-rolling');
await page.waitForFunction(() => Number(document.querySelector('#tilttrail').dataset.z) >= 10);
await page.keyboard.down('ArrowLeft'); await page.waitForTimeout(250); await page.keyboard.up('ArrowLeft'); await capture('02b-turning-braked');
await release(); await page.waitForTimeout(300); await capture('03-released');
await page.keyboard.down('ArrowRight');
await page.waitForFunction(() => ['falling', 'failed'].includes(document.querySelector('#tilttrail').dataset.phase), { }, { polling: 20, timeout: 5000 }); await page.keyboard.up('ArrowRight'); await capture('04-falling');
await page.waitForFunction(() => document.querySelector('#tilttrail').dataset.phase === 'failed'); await capture('05-failed');
await fs.writeFile(new URL('./evidence/play-sequence.json', import.meta.url), JSON.stringify({ ordinaryInput: true, input: 'native touch brake, native keyboard left/right', deliberatelyHeldRightOffRoad: true, errors, frames }, null, 2));
console.log({ errors, frames }); await browser.close();
