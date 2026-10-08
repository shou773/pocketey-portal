// Focused visual regression: ordinary input and natural damage, no game-state writes.
// Run against an already built preview; --baseline records the old disappearance.
import { chromium } from '@playwright/test';
import sharp from 'sharp';
import fs from 'node:fs/promises';
import assert from 'node:assert/strict';

const baseline = process.argv.includes('--baseline');
const desktop = process.argv.includes('--desktop');
const base = process.env.PULSE_CORE_BASE_URL || 'http://localhost:4335';
const out = process.env.PULSE_CORE_EVIDENCE || 'test-results/pulse-damage-core';
const viewport = desktop ? { width: 1280, height: 900 } : { width: 390, height: 844 };
await fs.mkdir(out, { recursive: true });
const browser = await chromium.launch({
  executablePath: process.env.CI ? undefined : '/usr/bin/chromium',
  args: ['--no-sandbox', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
});
const context = await browser.newContext({ viewport, deviceScaleFactor: 1, hasTouch: !desktop, isMobile: !desktop });
const page = await context.newPage();
const errors = [];
page.on('pageerror', e => errors.push(e.message));
await page.goto(base + '/games/pulse-drift/?lang=en');
await page.locator('#sound').click();
await page.getByRole('button', { name: 'Stage 3', exact: true }).click();
await page.getByRole('button', { name: 'Launch', exact: true }).click();
const state = () => page.locator('#pulse').getAttribute('data-state').then(JSON.parse);
await page.waitForFunction(() => JSON.parse(document.querySelector('#pulse').dataset.state).time > .2);
const initial = await state(), cdp = await context.newCDPSession(page);
if (desktop) {
  await page.keyboard.down('ArrowLeft');
  await page.waitForTimeout(50);
  await page.keyboard.up('ArrowLeft');
} else {
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ ...initial.screen, id: 1 }] });
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: initial.screen.x - 18, y: initial.screen.y, id: 1 }] });
  await page.waitForTimeout(120);
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
}
await page.waitForFunction(() => JSON.parse(document.querySelector('#pulse').dataset.state).time >= 3.8);
// Position is stable during capture, so core ROI does not depend on approximate frame/diagnostic alignment.
let latest = await state();
const frames = [], pending = [], diagnostics = [latest];
cdp.on('Page.screencastFrame', event => {
  void cdp.send('Page.screencastFrameAck', { sessionId: event.sessionId });
  const index = frames.length, file = `frame-${String(index).padStart(3, '0')}.png`;
  const record = { file, timestamp: event.metadata.timestamp, diagnostic: latest };
  frames.push(record);
  pending.push((async () => {
    const buffer = Buffer.from(event.data, 'base64');
    await fs.writeFile(out + '/' + file, buffer);
    const { data, info } = await sharp(buffer).removeAlpha().raw().toBuffer({ resolveWithObject: true });
    const cx = Math.round(record.diagnostic.screen.x), cy = Math.round(record.diagnostic.screen.y);
    let coreWhitePixels = 0, hullBluePixels = 0;
    for (let y = cy - 15; y <= cy + 15; y++) for (let x = cx - 23; x <= cx + 23; x++) {
      const i = (y * info.width + x) * info.channels, r = data[i], g = data[i + 1], b = data[i + 2];
      if (Math.abs(x - cx) <= 7 && Math.abs(y - cy) <= 7 && Math.min(r, g, b) >= 230 && Math.max(r, g, b) - Math.min(r, g, b) < 15) coreWhitePixels++;
      if (Math.abs(x - cx) >= 9 && r < 115 && g > 85 && b > 110 && b > g) hullBluePixels++;
    }
    Object.assign(record, { coreWhitePixels, hullBluePixels });
  })());
});
await cdp.send('Page.startScreencast', { format: 'png', maxWidth: viewport.width, maxHeight: viewport.height, everyNthFrame: 2 });
let firstHit = latest.hp < 4 ? latest.time : null;
const deadline = Date.now() + 30000;
// Different native gestures can change the first collision time. Include the whole
// existing 1.35s grace window after an observed hit rather than ending at a fixed pre-hit time.
while (Date.now() < deadline && (latest.time < 6.1 || firstHit === null || latest.time < firstHit + 1.4)) {
  await page.waitForTimeout(25);
  latest = await state(); diagnostics.push(latest);
  if (firstHit === null && latest.hp < 4) firstHit = latest.time;
}
await cdp.send('Page.stopScreencast');
await Promise.all(pending);
const report = { baseline, desktop, sourceRuntimeSHA: process.env.PULSE_CORE_SHA || 'working-tree', viewport, input: desktop ? 'native ArrowLeft 50ms then release' : 'native touch left18CSSpx then release120ms', capture: 'Unpaused asynchronous real frames; diagnostics are nearest previous observations', firstHit, frames, diagnostics, errors };
await fs.writeFile(out + '/report.json', JSON.stringify(report, null, 2));
await browser.close();
assert.deepEqual(errors, []);
assert.ok(frames.length >= 12, 'Enough consecutive frames');
assert.ok(diagnostics.some(s => s.hp < 4), 'Natural hit observed');
assert.ok(diagnostics.every(s => s.status === 'playing'), 'All observations remain in play');
assert.ok(frames.some(f => f.hullBluePixels === 0), 'Existing hull blink off-phase captured');
assert.ok(frames.some(f => f.hullBluePixels > 10), 'Existing hull blink on-phase captured');
if (baseline) assert.ok(frames.some(f => f.coreWhitePixels === 0), 'Published regression reproduced');
else assert.ok(frames.every(f => f.coreWhitePixels >= 3), 'White core stays visible throughout natural damage/blinking');
console.log({ baseline, desktop, frames: frames.length, minCoreWhitePixels: Math.min(...frames.map(f => f.coreWhitePixels)), hullOffFrames: frames.filter(f => !f.hullBluePixels).length, hp: [...new Set(diagnostics.map(s => s.hp))], errors });
