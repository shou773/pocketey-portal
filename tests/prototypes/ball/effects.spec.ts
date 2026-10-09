import { test, expect, type Page } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';
import { track, SAVE_KEY } from '../../../src/games/prototypes/ball/model';
const evidence = 'test-results/ball-effects';
async function open(page: Page) {
  const assets = Promise.all(['observatory.glb', 'wind-rock.glb'].map(name => page.waitForResponse(r => r.url().endsWith(name) && r.status() === 200)));
  await page.goto('/games/tilttrail/?lang=en'); await assets; await page.waitForTimeout(300);
}
async function sample(page: Page) {
  return page.locator('#tilttrail').evaluate(el => {
    const d = (el as HTMLElement).dataset;
    return { phase: d.phase, stage: +d.stage!, x: +d.x!, z: +d.z!, vx: +d.vx!, speed: +d.speed!, trail: +d.trailPoints!, trailLength: +d.trailLength!, brake: +d.brakeOpacity!, calls: +d.drawCalls!, triangles: +d.triangles! };
  });
}
async function noEffects(page: Page) { await expect.poll(async () => { const s = await sample(page); return s.trail + s.brake; }).toBe(0); }

test('effects respect fall, retry, pause, menu, stage, hidden return and live reduced motion', async ({ page }) => {
  await mkdir(evidence, { recursive: true }); await open(page);
  await noEffects(page);
  await page.locator('[data-stage="2"]').click(); await page.getByRole('button', { name: 'Play this stage' }).click();
  await page.keyboard.down('Space');
  await expect.poll(async () => (await sample(page)).trail).toBeGreaterThan(1);
  await expect.poll(async () => (await sample(page)).brake).toBeGreaterThan(.8);
  const normal = await sample(page); expect(normal.trail).toBeLessThanOrEqual(8); expect(normal.trailLength).toBeLessThanOrEqual(1.2); expect(normal.calls).toBeLessThanOrEqual(16); expect(normal.triangles).toBeLessThan(6000);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await expect.poll(async () => (await sample(page)).trail).toBe(0);
  await expect.poll(async () => (await sample(page)).brake).toBe(.85);
  await page.keyboard.up('Space'); await noEffects(page);
  await page.emulateMedia({ reducedMotion: 'no-preference' }); await expect.poll(async () => (await sample(page)).trail).toBeGreaterThan(1);
  await page.keyboard.press('Escape'); await noEffects(page);
  await page.getByRole('button', { name: 'Stages', exact: true }).click(); await noEffects(page);
  await page.locator('[data-stage="0"]').click(); await noEffects(page);
  await page.getByRole('button', { name: 'Play this stage' }).click();
  await page.keyboard.down('ArrowRight'); await expect(page.locator('#tilttrail')).toHaveAttribute('data-phase', 'falling'); await noEffects(page); await page.keyboard.up('ArrowRight');
  await expect(page.locator('#tilttrail')).toHaveAttribute('data-phase', 'failed');
  await page.getByRole('button', { name: 'Retry now' }).click(); await expect.poll(async () => (await sample(page)).trail).toBeGreaterThan(1);
  // Browser lifecycle simulation changes visibility only, never game state.
  await page.evaluate(() => { Object.defineProperty(document, 'hidden', { configurable: true, get: () => true }); document.dispatchEvent(new Event('visibilitychange')); });
  await expect(page.locator('#tilttrail')).toHaveAttribute('data-phase', 'paused'); await noEffects(page);
  await page.evaluate(() => { delete (document as unknown as { hidden?: boolean }).hidden; document.dispatchEvent(new Event('visibilitychange')); });
  await page.getByRole('button', { name: 'Resume', exact: true }).last().click();
  await expect.poll(async () => (await sample(page)).trail).toBeGreaterThan(1);
  await writeFile(`${evidence}/lifecycle-budget.json`, JSON.stringify({ normal, final: await sample(page) }, null, 2));
});

for (const reduced of [false, true]) test(`ordinary clear burst is one-shot; language/sound rerenders do not replay (reduced=${reduced})`, async ({ page }) => {
  await mkdir(evidence, { recursive: true }); await page.emulateMedia({ reducedMotion: reduced ? 'reduce' : 'no-preference' }); await open(page);
  const errors: string[] = []; page.on('pageerror', e => errors.push(e.message));
  await page.evaluate(() => {
    const burst = document.querySelector('#tt-clear-burst')!;
    burst.setAttribute('data-observed-starts', '0');
    burst.addEventListener('animationstart', () => burst.setAttribute('data-observed-starts', String(Number(burst.getAttribute('data-observed-starts')) + 1)));
  });
  await page.getByRole('button', { name: 'Play this stage' }).click();
  let active = '';
  const begin = Date.now();
  while (Date.now() - begin < 60000) {
    const s = await sample(page); if (s.phase !== 'playing') break;
    const road = track(s.stage, s.z), future = track(s.stage, s.z + .7);
    const diff = (future.x - road.x) / .7 * s.speed + (road.x - s.x) * 3 - s.vx;
    const next = diff > .3 ? 'ArrowRight' : diff < -.3 ? 'ArrowLeft' : '';
    if (active !== next) { if (active) await page.keyboard.up(active); if (next) await page.keyboard.down(next); active = next; }
    await page.waitForTimeout(65);
  }
  if (active) await page.keyboard.up(active);
  await expect(page.locator('#tilttrail')).toHaveAttribute('data-phase', 'clear');
  await noEffects(page);
  const burst = page.locator('#tt-clear-burst');
  if (!reduced) {
    await expect(burst).toHaveAttribute('data-observed-starts', '8');
    const session = await page.context().newCDPSession(page);
    const shot = await session.send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false });
    await writeFile(`${evidence}/production-clear-burst.png`, Buffer.from(shot.data, 'base64')); await session.detach();
  } else { await expect(burst).not.toHaveClass('active'); await expect(burst).toHaveAttribute('data-observed-starts', '0'); }
  const saved = await page.evaluate(key => localStorage.getItem(key), SAVE_KEY);
  await page.waitForTimeout(650); await expect(burst).not.toHaveClass('active');
  await page.getByRole('button', { name: '日本語', exact: true }).click(); await page.locator('#tt-sound').click();
  await expect(burst).toHaveAttribute('data-observed-starts', reduced ? '0' : '8');
  // Sound preference may change, but a render never writes another best time.
  const before = JSON.parse(saved!).best, after = await page.evaluate(key => JSON.parse(localStorage.getItem(key)!).best, SAVE_KEY); expect(after).toEqual(before);
  await page.getByRole('button', { name: 'もう一度', exact: true }).click(); await expect(burst).not.toHaveClass('active');
  expect(errors).toEqual([]);
  await writeFile(`${evidence}/clear-reduced-${reduced}.json`, JSON.stringify({ animationStarts: reduced ? 0 : 8, before, after, errors }, null, 2));
});