import { chromium } from '@playwright/test';
import fs from 'node:fs/promises';
const browser = await chromium.launch({ executablePath: '/usr/bin/chromium', args: ['--no-sandbox', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
try {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 1 });
  const page = await context.newPage(); const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  await page.route('**/games/assets/amber/stone-arch.glb', route => route.abort('failed'));
  await page.goto('http://127.0.0.1:4344/games/amber-step/?lang=ja');
  await page.waitForFunction(() => document.querySelector('canvas')?.dataset.artAdopted === 'true');
  await page.locator('#actions button.primary').click();
  await page.keyboard.down('ArrowRight'); await page.waitForTimeout(300); await page.keyboard.up('ArrowRight');
  await page.keyboard.press('Space'); await page.waitForTimeout(100);
  const result = await page.evaluate(() => ({ art: { ...document.querySelector('canvas').dataset }, state: { ...document.querySelector('#game').dataset } }));
  if (result.art.amberLandmark !== 'procedural' || result.state.status !== 'running' || Number(result.state.x) <= 0 || Number(result.state.y) <= 0 || errors.length) throw Error(JSON.stringify({ ...result, errors }));
  await page.screenshot({ path: new URL('landmark-fallback.png', import.meta.url).pathname });
  await fs.writeFile(new URL('landmark-fallback.json', import.meta.url), JSON.stringify({ ...result, errors }, null, 2));
} finally { await browser.close(); }
