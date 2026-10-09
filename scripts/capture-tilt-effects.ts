import { chromium, type Page } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';
import { track } from '../src/games/prototypes/ball/model';
const out = 'test-results/tilt-effects-visibility';
await mkdir(out, { recursive: true });
const browser = await chromium.launch({ args: ['--no-sandbox', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const evidence: unknown[] = [];
async function state(page: Page) { return page.locator('#tilttrail').evaluate(el => { const d = (el as HTMLElement).dataset; return { phase: d.phase, stage: +d.stage!, x: +d.x!, z: +d.z!, vx: +d.vx!, speed: +d.speed!, trail: +d.trailPoints!, length: +d.trailLength!, brake: +d.brakeOpacity!, calls: +d.drawCalls!, triangles: +d.triangles! }; }); }
async function capture(page: Page, name: string) {
  const session = await page.context().newCDPSession(page);
  const before = await state(page), shot = await session.send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false });
  await writeFile(`${out}/${name}.png`, Buffer.from(shot.data, 'base64')); await session.detach();
  evidence.push({ name, before, after: await state(page) });
}
try {
  for (const variant of ['before', 'after']) {
    const context = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1, hasTouch: true, reducedMotion: 'no-preference' });
    const page = await context.newPage(), errors: string[] = [];
    page.on('pageerror', e => errors.push(e.message));
    const assets = Promise.all(['observatory.glb', 'wind-rock.glb'].map(name => page.waitForResponse(r => r.url().endsWith(name) && r.status() === 200)));
    await page.goto(`http://127.0.0.1:${variant === 'before' ? 4336 : 4335}/games/tilttrail/?lang=en`); await assets; await page.waitForTimeout(300);
    await page.getByRole('button', { name: 'Play this stage' }).click();
    await page.waitForFunction(() => +(document.querySelector('#tilttrail') as HTMLElement).dataset.z! >= 5);
    await capture(page, `${variant}-390-rolling`);
    await page.keyboard.down('Space'); await page.waitForTimeout(220);
    await capture(page, `${variant}-390-braking`); await page.keyboard.up('Space');
    // Restart using ordinary UI so screenshot waits cannot feed stale steering.
    await page.keyboard.press('Escape'); await page.getByRole('button', { name: 'Retry', exact: true }).click();
    let active = ''; const start = Date.now();
    while (Date.now() - start < 60000) {
      const s = await state(page); if (s.phase !== 'playing') break;
      const road = track(s.stage, s.z), future = track(s.stage, s.z + .7);
      const diff = (future.x - road.x) / .7 * s.speed + (road.x - s.x) * 3 - s.vx;
      const next = diff > .3 ? 'ArrowRight' : diff < -.3 ? 'ArrowLeft' : '';
      if (active !== next) { if (active) await page.keyboard.up(active); if (next) await page.keyboard.down(next); active = next; }
      await page.waitForTimeout(30);
    }
    if (active) await page.keyboard.up(active);
    if ((await state(page)).phase !== 'clear') throw new Error(`${variant} ordinary input did not clear`);
    await page.waitForTimeout(120); await capture(page, `${variant}-390-clear`);
    await page.waitForTimeout(900);
    const controlCheck = await page.locator('#tt-actions').evaluate(el => { const r = el.getBoundingClientRect(); return { left: r.left, right: r.right, bottom: r.bottom, viewport: [innerWidth, innerHeight] }; });
    if (controlCheck.left < 0 || controlCheck.right > 390 || controlCheck.bottom > 844 || errors.length) throw new Error(JSON.stringify({ variant, controlCheck, errors }));
    evidence.push({ variant, controlCheck, errors }); await context.close();
  }
} finally { await browser.close(); await writeFile(`${out}/captures.json`, JSON.stringify(evidence, null, 2)); }
