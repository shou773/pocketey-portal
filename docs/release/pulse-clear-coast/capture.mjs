import { chromium } from '@playwright/test';
import fs from 'node:fs/promises';

// Actual built game route and its unmodified app loop. Playwright's clock fixes
// elapsed time; no game state, camera, UI, or canvas is replaced for these images.
const phase = process.argv[2] || 'before';
const base = process.env.ART_BASE || 'http://127.0.0.1:4381';
const out = new URL('./evidence/', import.meta.url);
await fs.mkdir(out, { recursive: true });
const browser = await chromium.launch({ executablePath: '/usr/bin/chromium', args: ['--no-sandbox', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const reports = [];
for (const mobile of [true, false]) {
  const context = await browser.newContext({ viewport: mobile ? { width: 390, height: 844 } : { width: 1280, height: 900 }, deviceScaleFactor: 1, hasTouch: mobile, isMobile: mobile });
  const page = await context.newPage();
  const errors = []; page.on('pageerror', e => errors.push(e.message));
  await page.clock.install({ time: new Date('2026-10-08T12:00:00Z') });
  await page.clock.pauseAt(new Date('2026-10-08T12:00:10Z'));
  const assets = [page.waitForResponse(r => r.url().endsWith('pulse-vehicles.glb') && r.ok())];
  await page.goto(`${base}/games/pulse-drift/?lang=en`);
  await Promise.all(assets);
  await page.locator('canvas[data-pulse-art=ready]').waitFor();
  await page.getByRole('button', {name: 'Stage 2', exact: true}).evaluate(b => b.click());
  await page.getByRole('button', {name: 'Launch', exact: true}).evaluate(b => b.click());
  await page.clock.runFor(6000);
  const state = await page.locator('#pulse').evaluate(el => ({ mode: el.dataset.mode, ...JSON.parse(el.dataset.state) }));
  const canvas = await page.locator('canvas').evaluate(c => {
    const gl = c.getContext('webgl2'), ext = gl.getExtension('WEBGL_debug_renderer_info');
    return { css: [c.clientWidth, c.clientHeight], framebuffer: [c.width, c.height], renderer: ext ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER) };
  });
  await page.screenshot({ path: new URL(`${phase}-native-${mobile ? 'mobile' : 'desktop'}.png`, out).pathname });
  reports.push({ mobile, state, canvas, errors, protocol: 'Built native route, ordinary Stage 2 launch, Playwright clock runFor(6000), frozen clock screenshot; actual WebGL, not auxiliary render.' });
  await context.close();
}
await browser.close();
await fs.writeFile(new URL(`${phase}.json`, out), JSON.stringify(reports, null, 2));
console.log(JSON.stringify(reports, null, 2));
