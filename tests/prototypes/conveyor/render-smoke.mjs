// Rendering evidence only. Route correctness is tested independently in model.test.ts.
import { chromium } from '@playwright/test';
import fs from 'node:fs/promises';
const directory = 'docs/prototypes/conveyor/evidence/toy-factory';
await fs.mkdir(directory, { recursive: true });
const browser = await chromium.launch({ executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE || '/usr/bin/chromium',
  args: ['--no-sandbox', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
try {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1, hasTouch: true });
  const page = await context.newPage();
  const errors = []; page.on('pageerror', error => errors.push(error.message));
  await page.goto('http://127.0.0.1:4341/prototypes/conveyor/?lang=ja');
  await page.waitForFunction(() => Number(document.querySelector('#conveyor')?.dataset.frames) > 0, undefined, { timeout: 15000 });
  await page.screenshot({ path: `${directory}/interaction-initial.png`, fullPage: true });
  const board = await page.locator('#cv-board').boundingBox();
  await page.screenshot({ path: `${directory}/interaction-slice.png`, clip: { x: board.x + 140, y: board.y + 75, width: 210, height: 200 } });
  for (const [id, count] of [['a', 3], ['c', 1], ['d', 1], ['e', 1], ['g', 1]]) {
    for (let i = 0; i < count; i++) await page.locator(`[data-tile="${id}"]`).tap();
  }
  await page.waitForTimeout(100);
  await page.screenshot({ path: `${directory}/conveyor-toy-factory.png`, fullPage: true });
  const selected = await page.locator('#conveyor').evaluate(root => ({drawCalls:Number(root.dataset.drawCalls),triangles:Number(root.dataset.triangles)}));
  const startFrames = Number(await page.locator('#conveyor').getAttribute('data-frames'));
  await page.locator('#cv-play').tap();
  const measurement = await page.evaluate(async () => {
    const root = document.querySelector('#conveyor');
    const canvas = document.querySelector('#cv-canvas');
    const gl = canvas.getContext('webgl2'); const debug = gl.getExtension('WEBGL_debug_renderer_info');
    const intervals = [], submissions = [];
    let last = performance.now(), lastFrame = root.dataset.frames;
    const begin = last;
    await new Promise(resolve => {
      const tick = now => {
        intervals.push(now - last); last = now;
        if (root.dataset.frames !== lastFrame) { submissions.push(Number(root.dataset.renderMs)); lastFrame = root.dataset.frames; }
        if (now - begin >= 2000) resolve(); else requestAnimationFrame(tick);
      }; requestAnimationFrame(tick);
    });
    return { intervals, submissions, renderer: debug ? gl.getParameter(debug.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER),
      drawCalls: Number(root.dataset.drawCalls), triangles: Number(root.dataset.triangles), canvas: { width: canvas.width, height: canvas.height } };
  });
  const measuredFrames = Number(await page.locator('#conveyor').getAttribute('data-frames')) - startFrames;
  await page.waitForFunction(() => document.querySelector('#conveyor').dataset.phase === 'success', undefined, { timeout: 15000 });
  await page.screenshot({ path: `${directory}/interaction-success.png`, fullPage: true });
  const idleStart = Number(await page.locator('#conveyor').getAttribute('data-frames'));
  await page.waitForTimeout(500);
  const idleDraws = Number(await page.locator('#conveyor').getAttribute('data-frames')) - idleStart;
  const percentile = (values, p) => [...values].sort((a,b) => a-b)[Math.min(values.length-1, Math.floor(values.length*p))];
  const summary = {
    browser: browser.version(), environment: 'Headless Chromium, SwiftShader software renderer; mobile viewport emulation, not a phone GPU benchmark',
    viewport: { width: 390, height: 844 }, deviceScaleFactor: 1, renderer: measurement.renderer, canvas: measurement.canvas,
    sampleMs: Math.round(measurement.intervals.reduce((a,b)=>a+b,0)), measuredDraws: measuredFrames,
    rafIntervalMs: { median: percentile(measurement.intervals,.5), p95: percentile(measurement.intervals,.95), max: Math.max(...measurement.intervals) },
    cpuSubmissionMs: { median: percentile(measurement.submissions,.5), p95: percentile(measurement.submissions,.95) },
    drawCalls: measurement.drawCalls, triangles: measurement.triangles, selected, idleDraws, errors,
    designBudget: { drawCalls: 90, triangles: 15000, pixelRatioCap: 1.5, activeFpsCap: 30, shadowMaps: false, postprocessing: false },
  };
  await fs.writeFile(`${directory}/render-smoke.json`, JSON.stringify(summary,null,2)+'\n');
  console.log(JSON.stringify(summary,null,2));
  if (errors.length || idleDraws > 0 || Math.max(summary.drawCalls,selected.drawCalls) > 90 || Math.max(summary.triangles,selected.triangles) > 15000) process.exitCode = 1;
} finally { await browser.close(); }
