import { test, expect, type Page } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';
import { SAVE_KEY, track, length } from '../../../src/games/prototypes/ball/model';

const route = '/games/tilttrail/';
const evidence = process.env.NEW_GAME_EVIDENCE || 'test-results/ball/evidence';
async function snapshot(page: Page) {
  return page.locator('#tilttrail').evaluate(el => {
    const d = (el as HTMLElement).dataset;
    return { phase: d.phase, stage: Number(d.stage), x: Number(d.x), z: Number(d.z), vx: Number(d.vx), speed: Number(d.speed), time: Number(d.time) };
  });
}
async function drive(page: Page, touch: boolean) {
  const session = touch ? await page.context().newCDPSession(page) : null;
  const bounds = await Promise.all(['left', 'right', 'brake'].map(async type => ({ type, bounds: (await page.locator(`[data-tt-input="${type}"]`).boundingBox())! })));
  let active: string[] = [], samples: unknown[] = [], screenshot = false;
  const initial = await snapshot(page);
  const measurement = initial.stage === 2 ? page.evaluate(async () => {
    const samples: number[] = []; let previous = performance.now();
    await new Promise<void>(resolve => { function frame(now: number) { samples.push(now - previous); previous = now; if (samples.length < 180) requestAnimationFrame(frame); else resolve(); } requestAnimationFrame(frame); });
    const sorted = samples.slice(10).sort((a,b) => a-b), canvas = document.querySelector('canvas')!;
    const gl = canvas.getContext('webgl2')!, ext = gl.getExtension('WEBGL_debug_renderer_info');
    const d = (document.querySelector('#tilttrail') as HTMLElement).dataset;
    return { fps: 1000 / (sorted.reduce((a,b) => a+b, 0) / sorted.length), p95: sorted[Math.floor(sorted.length * 0.95)], intervals: samples, renderer: ext ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER), viewport: [innerWidth,innerHeight], framebuffer: [canvas.width,canvas.height], drawCalls: Number(d.drawCalls), triangles: Number(d.triangles) };
  }) : null;
  const begin = Date.now();
  while (Date.now() - begin < 110000) {
    const s = await snapshot(page); samples.push({...s,observedAt:Date.now()});
    if (s.phase !== 'playing') break;
    const road = track(s.stage, s.z), future = track(s.stage, s.z + 0.7);
    const target = (future.x - road.x) / 0.7 * s.speed + (road.x - s.x) * 3;
    const diff = target - s.vx;
    const next = [diff > 0.3 ? 'right' : diff < -0.3 ? 'left' : '', road.width < 4 ? 'brake' : ''].filter(Boolean);
    if (touch && session) {
      if (next.join() !== active.join()) {
        const points = bounds.filter(b => next.includes(b.type)).map(b => ({ id: b.type === 'left' ? 1 : b.type === 'right' ? 2 : 3, x: b.bounds.x + b.bounds.width / 2, y: b.bounds.y + b.bounds.height / 2, radiusX: 5, radiusY: 5, force: 1 }));
        // CDP requires empty touchPoints on touchEnd. Re-contact both fingers
        // when the steering changes, rather than inventing a partial touchEnd.
        if (active.length) await session.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
        if (points.length) await session.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: points });
      }
    } else {
      const key = (c: string) => c === 'left' ? 'ArrowLeft' : c === 'right' ? 'ArrowRight' : 'Space';
      for (const c of active.filter(a => !next.includes(a))) await page.keyboard.up(key(c));
      for (const c of next.filter(a => !active.includes(a))) await page.keyboard.down(key(c));
    }
    active = next;
    if (!screenshot && s.z > length(s.stage) * 0.3) {
      // Screenshot font/compositor waits can last seconds on software-GPU CI.
      // Use the real Pause/Resume controls while capturing; never hold stale
      // steering through an unbounded screenshot await or alter the simulation.
      await page.locator('#tt-pause').click();
      if(session&&active.length)await session.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
      else for(const key of ['ArrowLeft','ArrowRight','Space'])await page.keyboard.up(key);
      active=[];
      await page.screenshot({ path: `${evidence}/${touch ? 'mobile' : 'desktop'}-stage${s.stage + 1}-paused.png` });
      await page.getByRole('button',{name:'Resume',exact:true}).last().click();
      screenshot=true;continue;
    }
    await page.waitForTimeout(65);
  }
  if (session) { if (active.length) await session.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] }); await session.detach(); }
  else for (const key of ['ArrowLeft', 'ArrowRight', 'Space']) await page.keyboard.up(key);
  const end = await snapshot(page);
  await writeFile(`${evidence}/${touch ? 'touch' : 'keyboard'}-stage${end.stage + 1}.json`, JSON.stringify({ end, samples }, null, 2));
  if (measurement) {
    const result = await measurement; await writeFile(`${evidence}/${touch ? 'mobile' : 'desktop'}-performance.json`, JSON.stringify(result, null, 2));
    expect(result.drawCalls).toBeLessThanOrEqual(16); expect(result.triangles).toBeLessThan(6000);
    expect.soft(result.fps).toBeGreaterThanOrEqual(45); expect.soft(result.p95).toBeLessThanOrEqual(40);
  }
  expect(end.phase, JSON.stringify(end)).toBe('clear');
  await expect(page.locator('#tt-stages')).toBeHidden();
}

for (const touch of [false, true]) test(`all three stages clear with ordinary ${touch ? 'multi-touch' : 'keyboard'}; bests persist independently`, async ({ page }) => {
  await mkdir(evidence, { recursive: true });
  const errors: string[] = []; page.on('pageerror', e => errors.push(e.message));
  await page.goto(`${route}?lang=en`);
  await page.evaluate(() => localStorage.setItem('pocketey-orbit-amber-v1', 'untouched-sentinel'));
  await page.setViewportSize(touch ? { width: 390, height: 844 } : { width: 1280, height: 800 });
  await page.locator('#tt-sound').click();
  await page.getByRole('button', { name: 'Play this stage' }).click();
  await drive(page, touch);
  await page.getByRole('button', { name: 'Next stage' }).click();
  await drive(page, touch);
  await page.getByRole('button', { name: 'Next stage' }).click();
  await drive(page, touch);
  await page.screenshot({ path: `${evidence}/${touch ? 'mobile' : 'desktop'}-all-clear.png` });
  const saved = await page.evaluate(key => JSON.parse(localStorage.getItem(key)!), SAVE_KEY);
  expect(saved.best.every((v: unknown) => typeof v === 'number' && v > 0)).toBe(true);
  expect(await page.evaluate(() => localStorage.getItem('pocketey-orbit-amber-v1'))).toBe('untouched-sentinel');
  await page.reload();
  await expect(page.locator('#tt-stages')).toContainText('BEST');
  const reloaded=await page.evaluate(key=>JSON.parse(localStorage.getItem(key)!),SAVE_KEY);expect(reloaded).toEqual(saved);
  expect(errors).toEqual([]);
  await writeFile(`${evidence}/${touch?'mobile':'desktop'}-functional-completion.json`,JSON.stringify({threeNativeClears:true,saved,reloaded,errors},null,2));
});

test('fall → instant retry, pause, input release, mute, language and rapid actions', async ({ page }) => {
  await page.goto(`${route}?lang=en`); await page.getByRole('button', { name: 'Play this stage' }).click();
  await expect(page.locator('#tilttrail')).toHaveAttribute('data-audio', 'off');
  await page.keyboard.down('ArrowRight'); await expect(page.locator('#tilttrail')).toHaveAttribute('data-phase', 'failed', { timeout: 5000 }); await page.keyboard.up('ArrowRight');
  await page.getByRole('button', { name: 'Retry now' }).click(); await expect(page.locator('#tilttrail')).toHaveAttribute('data-phase', 'playing');
  await page.keyboard.down('ArrowLeft'); await page.waitForTimeout(150); await page.keyboard.press('Escape'); await page.keyboard.up('ArrowLeft');
  const frozen = await snapshot(page); await page.waitForTimeout(500); const after = await snapshot(page); expect(after.x).toBe(frozen.x); expect(after.z).toBe(frozen.z);
  await page.getByRole('button', { name: 'Resume', exact: true }).last().click(); await page.waitForTimeout(250); const resumed = await snapshot(page); expect(resumed.vx).toBeLessThan(0); expect(Math.abs(resumed.vx)).toBeLessThan(Math.abs(frozen.vx));
  await page.getByRole('button', { name: 'Pause', exact: true }).click();
  await page.getByRole('button', { name: '日本語', exact: true }).click(); await expect(page.locator('#tt-title')).toHaveText('ひと休み');
  await page.getByRole('button', { name: '音 OFF', exact: true }).click(); await expect(page.getByRole('button', { name: '音 ON', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('#tilttrail')).toHaveAttribute('data-audio', 'running');
  await page.getByRole('button', { name: 'やり直す', exact: true }).click();
  await page.locator('[data-tt-input="left"]').tap(); await page.locator('[data-tt-input="right"]').tap(); await page.locator('[data-tt-input="brake"]').tap();
  await page.evaluate(() => window.dispatchEvent(new Event('blur'))); await expect(page.locator('#tilttrail')).toHaveAttribute('data-phase', 'paused');
  await page.getByRole('button', { name: 'ステージ選択', exact: true }).click();
  await page.getByRole('button', { name: 'このステージを遊ぶ' }).dblclick(); await expect(page.locator('#tilttrail')).toHaveAttribute('data-phase', 'playing');
  await page.keyboard.press('KeyP'); await expect(page.locator('#tilttrail')).toHaveAttribute('data-phase', 'paused');
});

test('two-finger controls, touch cancellation, orientation and page return release input', async ({ page }) => {
  await page.goto(`${route}?lang=en`); await page.getByRole('button', { name: 'Play this stage' }).click();
  const session = await page.context().newCDPSession(page);
  const point = async (type: string, id: number) => { const b = (await page.locator(`[data-tt-input="${type}"]`).boundingBox())!; return { id, x: b.x+b.width/2, y: b.y+b.height/2, radiusX: 5, radiusY: 5, force: 1 }; };
  await session.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [await point('left', 1), await point('brake', 2)] });
  await page.waitForTimeout(200); await expect(page.locator('[data-tt-input="left"]')).toHaveAttribute('aria-pressed', 'true'); await expect(page.locator('[data-tt-input="brake"]')).toHaveAttribute('aria-pressed', 'true');
  const moving = await snapshot(page); expect(moving.vx).toBeLessThan(0);
  await session.send('Input.dispatchTouchEvent', { type: 'touchCancel', touchPoints: [] });
  for (const type of ['left', 'right', 'brake']) await expect(page.locator(`[data-tt-input="${type}"]`)).toHaveAttribute('aria-pressed', 'false');
  // Brake speed converges smoothly, so test its settled value after releasing
  // steering rather than assuming an instantaneous cap after contact setup.
  await session.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [await point('brake', 1)] });
  await page.waitForTimeout(1000); expect((await snapshot(page)).speed).toBeLessThan(2.2);
  await session.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  await page.setViewportSize({ width: 844, height: 390 }); await page.waitForTimeout(150); await expect(page.locator('#tilttrail')).toHaveAttribute('data-phase', 'playing');
  // Simulate the pagehide/pageshow pair of a bfcache return; no state is set.
  await page.evaluate(() => window.dispatchEvent(new PageTransitionEvent('pagehide', { persisted: true })));
  await expect(page.locator('#tilttrail')).toHaveAttribute('data-phase', 'paused'); const paused = await snapshot(page); await page.waitForTimeout(250); expect((await snapshot(page)).z).toBe(paused.z);
  await page.evaluate(() => window.dispatchEvent(new PageTransitionEvent('pageshow', { persisted: true })));
  await page.getByRole('button', { name: 'Resume', exact: true }).last().click(); await page.waitForTimeout(150); expect((await snapshot(page)).z).toBeGreaterThan(paused.z);
  await session.detach();
  await page.evaluate(() => { const gl = document.querySelector('canvas')!.getContext('webgl2')!; gl.getExtension('WEBGL_lose_context')!.loseContext(); });
  await expect(page.locator('#tt-title')).toHaveText('3D view unavailable'); await expect(page.locator('#tilttrail')).toHaveAttribute('data-phase', 'paused');
});

test('320 portrait and landscape panels fit; blocked storage and WebGL show honest fallback', async ({ page, browser }) => {
  await mkdir(evidence, { recursive: true });
  for (const lang of ['ja', 'en']) for (const [width, height] of [[320, 720], [844, 390]]) {
    await page.setViewportSize({ width, height }); await page.goto(`${route}?lang=${lang}`);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.getByRole('button', { name: lang === 'ja' ? 'このステージを遊ぶ' : 'Play this stage' }).scrollIntoViewIfNeeded();
    await page.screenshot({ path: `${evidence}/menu-${lang}-${width}.png` });
    await page.getByRole('button', { name: lang === 'ja' ? 'このステージを遊ぶ' : 'Play this stage' }).click();
    for (const type of ['left', 'right', 'brake']) { const b = await page.locator(`[data-tt-input="${type}"]`).boundingBox(); expect(b!.x).toBeGreaterThanOrEqual(0); expect(b!.y + b!.height).toBeLessThanOrEqual(height); }
    await page.screenshot({ path: `${evidence}/play-${lang}-${width}.png` });
  }
  const blocked = await browser.newContext(); await blocked.addInitScript(() => { Storage.prototype.getItem = () => { throw new Error('blocked'); }; Storage.prototype.setItem = () => { throw new Error('blocked'); }; });
  const p = await blocked.newPage(); await p.goto(`http://127.0.0.1:4335${route}?lang=en`); await expect(p.locator('#tt-save')).toContainText('Storage unavailable'); await blocked.close();
  const noGL = await browser.newContext(); await noGL.addInitScript(() => { const original = HTMLCanvasElement.prototype.getContext; HTMLCanvasElement.prototype.getContext = function(this: HTMLCanvasElement, type: string, ...args: unknown[]) { if (type.includes('webgl')) return null; return original.apply(this, [type, ...args] as never); } as typeof original; });
  const fallback = await noGL.newPage(); await fallback.goto(`http://127.0.0.1:4335${route}?lang=en`); await expect(fallback.locator('#tt-title')).toHaveText('3D view unavailable'); await noGL.close();
});

test('WebGL loss freezes play and fall; header, P, Esc and touch cannot resume before reload', async ({ page }) => {
  for (const loseDuringFall of [false, true]) {
    await page.goto(`${route}?lang=en`); await page.getByRole('button', { name: 'Play this stage' }).click();
    if (loseDuringFall) {
      await page.keyboard.down('ArrowRight'); await expect(page.locator('#tilttrail')).toHaveAttribute('data-phase', 'falling'); await page.keyboard.up('ArrowRight');
    } else await page.waitForTimeout(100);
    await page.evaluate(() => document.querySelector('canvas')!.getContext('webgl2')!.getExtension('WEBGL_lose_context')!.loseContext());
    await expect(page.locator('#tt-title')).toHaveText('3D view unavailable');
    await expect(page.locator('#tilttrail')).toHaveAttribute('data-phase', 'paused');
    await expect(page.locator('#tt-pause')).toBeDisabled();
    await expect(page.locator('#tt-actions button')).toHaveText('Reload');
    const frozen = await snapshot(page), header = (await page.locator('#tt-pause').boundingBox())!;
    await page.mouse.click(header.x + header.width / 2, header.y + header.height / 2);
    await page.keyboard.press('KeyP'); await page.keyboard.press('Escape');
    const session = await page.context().newCDPSession(page);
    await session.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ id: 1, x: header.x + header.width / 2, y: header.y + header.height / 2, radiusX: 5, radiusY: 5, force: 1 }] });
    await session.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] }); await session.detach();
    await page.waitForTimeout(800);
    expect(await snapshot(page)).toEqual(frozen);
    await expect(page.locator('#tt-title')).toHaveText('3D view unavailable');
    await page.getByRole('button', { name: 'Reload', exact: true }).click();
    await expect(page.locator('#tilttrail')).toHaveAttribute('data-phase', 'ready');
    await page.getByRole('button', { name: 'Play this stage' }).click();
    await expect(page.locator('#tilttrail')).toHaveAttribute('data-phase', 'playing');
    await page.waitForTimeout(150); expect((await snapshot(page)).z).toBeGreaterThan(0);
  }
});
