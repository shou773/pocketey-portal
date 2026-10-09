import { test, expect, type Page } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

const saveKey = 'pocketey-alpine-campaign-v2';
const snapshot = (page: Page) => page.locator('#alpine').evaluate(root => ({ ...(root as HTMLElement).dataset }));
const saved = (page: Page) => page.evaluate(key => localStorage.getItem(key), saveKey);

// Production build, real Three.js and wall clock. No renderer interception,
// controlled clock, state setters or storage seeding. This is not an FPS gate.
test('real-rendered touch clear saves once, retries and survives reload', async ({ page, browser }, info) => {
  const errors: string[] = [];
  const turns: Array<Record<string, unknown>> = [];
  const report: Record<string, unknown> = {
    sourceHead: process.env.GITHUB_SHA ?? null,
    browser: browser.version(),
    renderer: 'Real Three.js / SwiftShader',
    clock: 'Ordinary wall clock; not an FPS or physical-device benchmark',
    input: 'CDP touch flicks and visible UI buttons only',
    turns, errors, passed: false,
  };
  page.on('pageerror', error => errors.push(error.message));
  page.on('console', message => {
    if (message.type() === 'error' && /Shader Error|shader is not compiled/i.test(message.text())) errors.push(message.text());
  });
  const root = page.locator('#alpine');
  try {
    await page.goto('/prototypes/alpine-drive/?lang=ja');
    await expect(root).toHaveAttribute('data-phase', 'ready');
    await page.waitForFunction(() => {
      const d = document.querySelector<HTMLElement>('#alpine')?.dataset;
      return Number(d?.drawCalls) > 0 && Number(d?.triangles) > 0;
    });
    await expect(page.locator('#ad-save')).toContainText('このコースの完走：0');
    report.initial = await snapshot(page);
    await page.screenshot({ path: info.outputPath('01-ready.png'), fullPage: true });
    await page.getByRole('button', { name: 'ドライブ開始', exact: true }).click();

    for (const [index, direction] of ([-1, 1, 1, -1] as const).entries()) {
      await page.waitForFunction(i => {
        const d = document.querySelector<HTMLElement>('#alpine')!.dataset;
        return d.phase === 'failed' || (Number(d.gate) === i && d.window === 'true');
      }, index, { timeout: 15000 });
      const before = await snapshot(page);
      expect(before.phase).toBe('playing');
      expect(before.gate).toBe(String(index));
      expect(before.window).toBe('true');
      const rect = await page.locator('#ad-canvas').boundingBox();
      expect(rect).not.toBeNull();
      const x = rect!.x + rect!.width * .5, y = rect!.y + rect!.height * .6;
      const session = await page.context().newCDPSession(page);
      try {
        await session.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y, id: 1 }] });
        await session.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: x + direction * 80, y: y + 3, id: 1 }] });
        await session.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
      } finally { await session.detach(); }
      const queued = await snapshot(page);
      expect(queued.queued).toBe(String(direction));
      await page.waitForFunction(i => {
        const d = document.querySelector<HTMLElement>('#alpine')!.dataset;
        return d.phase === 'failed' || Number(d.gate) > i;
      }, index, { timeout: 10000 });
      const after = await snapshot(page);
      expect(after.phase).toBe('playing');
      expect(after.gate).toBe(String(index + 1));
      turns.push({ index, direction, before, queued, after });
    }

    await page.waitForFunction(() => ['failed', 'clear'].includes(document.querySelector<HTMLElement>('#alpine')!.dataset.phase!), undefined, { timeout: 15000 });
    const goal = await snapshot(page);
    expect(goal.phase).toBe('clear');
    expect(goal.gate).toBe('4');
    expect(Number(goal.z)).toBe(50);
    expect(Number(goal.drawCalls)).toBeGreaterThan(0);
    expect(Number(goal.triangles)).toBeGreaterThan(0);
    await expect(page.locator('#ad-title')).toHaveText('ゴール！');
    await expect(page.locator('#ad-save')).toContainText('このコースの完走：1');
    const savedRaw = await saved(page);
    expect(savedRaw).not.toBeNull();
    expect(JSON.parse(savedRaw!)).toMatchObject({version:2,muted:true,records:{'mountain-pass':{clears:1,best:0}}});
    expect(await page.evaluate(()=>localStorage.getItem('pocketey-alpine-prototype-v1'))).toBeNull();
    await page.waitForTimeout(1200);
    expect(await saved(page)).toBe(savedRaw);
    report.goal = goal;
    report.saved = JSON.parse(savedRaw!);
    await page.screenshot({ path: info.outputPath('02-goal.png'), fullPage: true });

    await page.getByRole('button', { name: 'すぐリトライ', exact: true }).click();
    const retry = await snapshot(page);
    expect(retry).toMatchObject({ phase: 'playing', gate: '0', heading: '0', queued: 'null' });
    expect(Number(retry.z)).toBeLessThan(1);
    await page.waitForFunction(z => Number(document.querySelector<HTMLElement>('#alpine')!.dataset.z) > z, Number(retry.z), { timeout: 5000 });
    await page.locator('#ad-pause').click();
    await expect(root).toHaveAttribute('data-phase', 'paused');
    expect(await saved(page)).toBe(savedRaw);
    report.retry = retry;
    report.retryAfterAdvance = await snapshot(page);
    await page.screenshot({ path: info.outputPath('03-retry-paused.png'), fullPage: true });

    await page.reload();
    await expect(root).toHaveAttribute('data-phase', 'ready');
    await page.waitForFunction(() => Number(document.querySelector<HTMLElement>('#alpine')!.dataset.drawCalls) > 0);
    await expect(page.locator('#ad-save')).toContainText('このコースの完走：1');
    expect(await saved(page)).toBe(savedRaw);
    expect(await snapshot(page)).toMatchObject({ phase: 'ready', gate: '0', heading: '0', queued: 'null', z: '0.000' });
    report.reloaded = await snapshot(page);
    await page.screenshot({ path: info.outputPath('04-reloaded.png'), fullPage: true });
    await page.getByRole('button', { name: 'ドライブ開始', exact: true }).click();
    await expect(root).toHaveAttribute('data-phase', 'playing');
    await page.waitForFunction(() => Number(document.querySelector<HTMLElement>('#alpine')!.dataset.z) > 0, undefined, { timeout: 5000 });
    await page.locator('#ad-pause').click();
    await expect(root).toHaveAttribute('data-phase', 'paused');
    expect(await saved(page)).toBe(savedRaw);
    expect(errors).toEqual([]);
    report.passed = true;
  } finally {
    report.finalState = await snapshot(page).catch(() => null);
    const file = info.outputPath('journey.json');
    await mkdir(path.dirname(file), { recursive: true });
    await writeFile(file, JSON.stringify(report, null, 2) + '\n');
  }
});
