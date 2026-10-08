// Read-only Amber timing diagnosis. Real CDP contacts, no physics/state writes.
import { chromium } from '@playwright/test';
import fs from 'node:fs/promises';
const browser = await chromium.launch({ executablePath: '/usr/bin/chromium', args: ['--no-sandbox', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const records = [];
try {
  // Fixed protocol, not reruns until a pass: two variants, three load modes.
  for (const variant of ['public', 'candidate']) for (const load of ['normal', 'cpu8', 'one-long-task']) {
    const context = await browser.newContext({ locale: 'ja-JP', viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 1 });
    const page = await context.newPage();
    await page.addInitScript(({ load }) => {
      window.touchProbe = { frames: [], events: [], longTasks: [], load };
      const raf = window.requestAnimationFrame.bind(window);
      window.requestAnimationFrame = callback => raf(now => {
        callback(now);
        const game = document.querySelector('#game');
        if (game) window.touchProbe.frames.push({ wall: performance.now(), raf: now, time: document.querySelector('#timer')?.textContent, ...game.dataset });
      });
      new PerformanceObserver(list => window.touchProbe.longTasks.push(...list.getEntries().map(e => ({ start: e.startTime, duration: e.duration })))).observe({ type: 'longtask', buffered: true });
      let imposed = false;
      for (const type of ['pointerdown', 'pointerup', 'pointercancel', 'lostpointercapture']) document.addEventListener(type, event => {
        window.touchProbe.events.push({ type, wall: performance.now(), input: event.target.dataset?.input, id: event.pointerId });
        // An explicitly synthetic renderer-load analogue, not a CI reproduction.
        if (load === 'one-long-task' && !imposed && event.target.dataset?.input === 'right') {
          imposed = true; setTimeout(() => { const until = performance.now() + 220; while (performance.now() < until) {} }, 0);
        }
      }, true);
    }, { load });
    const session = await context.newCDPSession(page);
    if (load === 'cpu8') await session.send('Emulation.setCPUThrottlingRate', { rate: 8 });
    await page.goto(`http://127.0.0.1:${variant === 'public' ? 4355 : 4354}/`);
    await page.locator('.site-header').getByRole('link', { name: 'ゲーム', exact: true }).click();
    await page.locator('.amber .play-link').click();
    await page.getByRole('button', { name: 'ステージ 1 をはじめる' }).click();
    const points = [];
    for (const [i, name] of ['right', 'jump'].entries()) { const b = await page.locator(`[data-input=${name}]`).boundingBox(); points.push({ x: b.x + 20, y: b.y + 20, id: i + 1 }); }
    const read = () => page.evaluate(() => ({ wall: performance.now(), time: Number(document.querySelector('#timer').textContent), held: [...document.querySelectorAll('.held')].map(e => e.dataset.input), ...document.querySelector('#game').dataset }));
    const before = await read();
    await session.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: points });
    await page.waitForTimeout(200);
    const fixedWait = await read();
    let timeout;
    try { await page.waitForFunction(start => Number(document.querySelector('#timer').textContent) - start >= .2, before.time, { timeout: 3000 }); } catch (error) { timeout = String(error); }
    const simulationWait = await read();
    await session.send('Input.dispatchTouchEvent', { type: 'touchCancel', touchPoints: [] });
    const cancel = await read();
    await page.waitForTimeout(200);
    const afterCancel = await read();
    const probe = await page.evaluate(() => window.touchProbe);
    records.push({ variant, load, before, fixedWait, simulationWait, cancel, afterCancel, timeout, probe });
    console.log(JSON.stringify({ variant, load, fixedWait, simulationWait, cancel, afterCancel, timeout }));
    await context.close();
  }
  await fs.writeFile(new URL('./probe.json', import.meta.url), JSON.stringify({ protocol: 'Six predeclared sequential fresh contexts: public/candidate × normal/CPU8/one synthetic220ms task. Native portal route/start and CDP simultaneous right+jump. Record fixed200ms snapshot, bounded3s wait for0.2s simulation advancement, then cancel and check release. Read-only event/frame/long-task instrumentation. Synthetic task is explanatory, not proof of CI load.', records }, null, 2));
} finally { await browser.close(); }
