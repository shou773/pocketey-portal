// Amber-only review evidence, using the existing native-input stage driver.
// Fixed-duration windows; no game-state writes or held rendering callbacks.
import { chromium } from '@playwright/test';
import { play } from '../../../../../tests/games/input';
import fs from 'node:fs/promises';
import os from 'node:os';
import { execFileSync } from 'node:child_process';

const output = new URL('./comparison.json', import.meta.url);
const candidateSHA = execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
const baselineSHA = process.env.AMBER_BASELINE_SHA || '8714b3f';
const urls = { baseline: process.env.AMBER_BASELINE_URL || 'http://127.0.0.1:4355', candidate: process.env.AMBER_CANDIDATE_URL || 'http://127.0.0.1:4354' };
const browser = await chromium.launch({ executablePath: '/usr/bin/chromium', args: ['--no-sandbox', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const records: unknown[] = [];
try {
  for (const mobile of [false, true]) for (const mode of ['stationary', 'moving'] as const) {
    for (const [order, variant] of ['baseline', 'candidate', 'candidate', 'baseline'].entries()) {
      const context = await browser.newContext({ locale: 'ja-JP', viewport: mobile ? { width: 390, height: 844 } : { width: 1280, height: 720 }, deviceScaleFactor: 1, isMobile: mobile, hasTouch: mobile });
      // tsx's function-name annotation is serialized with evaluate callbacks.
      // This helper only labels instrument functions; it never changes state.
      await context.addInitScript('window.__name = value => value;');
      const page = await context.newPage(); const errors: string[] = []; const trace: unknown[] = [];
      page.on('pageerror', error => errors.push(error.message));
      await context.addInitScript(() => {
        localStorage.setItem('pocketey-orbit-amber-v1', JSON.stringify({ version: 1, sound: false, orbit: { unlocked: 1 }, amber: { unlocked: 3 } }));
        (window as any).amberCosts = { calls: 0, triangles: 0 };
        for (const name of ['drawElements', 'drawArrays', 'drawElementsInstanced', 'drawArraysInstanced'] as const) {
          const original = WebGL2RenderingContext.prototype[name];
          (WebGL2RenderingContext.prototype as any)[name] = function (...args: number[]) {
            const probe = (window as any).amberCosts; probe.calls++;
            const instances = name === 'drawElementsInstanced' ? args[4] : name === 'drawArraysInstanced' ? args[3] : 1;
            if (args[0] === this.TRIANGLES) probe.triangles += args[name.includes('Elements') ? 1 : 2] / 3 * instances;
            return (original as any).apply(this, args);
          };
        }
      });
      await page.goto(`${urls[variant as keyof typeof urls]}/games/amber-step/?lang=ja`);
      await page.waitForFunction(() => document.querySelector<HTMLCanvasElement>('canvas')?.dataset.artAdopted === 'true');
      if (mode === 'moving') await page.getByRole('button', { name: /^ステージ 3 / }).click();
      await page.waitForTimeout(300);
      await page.locator('#sound').click();
      await page.getByRole('button', { name: mode === 'moving' ? 'ステージ 3 をはじめる' : 'ステージ 1 をはじめる' }).click();
      let driverError: string | undefined;
      const driver = mode === 'moving' ? play(page, 'amber', 2, mobile, trace).catch(error => { driverError = String(error); }) : Promise.resolve();
      await page.waitForFunction(() => Number(document.querySelector('#timer')?.textContent) >= 1.5);
      const sample = await page.evaluate(async () => {
        const intervals: number[] = [], states: unknown[] = [];
        const costs = (window as any).amberCosts;
        const before = { ...costs }; let first = 0, last = 0;
        await new Promise<void>(resolve => {
          const tick = (now: number) => {
            if (!first) first = now;
            if (last) intervals.push(now - last);
            last = now;
            const root = document.querySelector<HTMLElement>('#game')!, canvas = document.querySelector<HTMLCanvasElement>('canvas')!;
            states.push({ timestamp: now, x: root.dataset.x, y: root.dataset.y, grounded: root.dataset.grounded, status: root.dataset.status, mode: root.dataset.mode, time: Number(document.querySelector('#timer')?.textContent), animation: canvas.dataset.artAnimation });
            if (now - first < 5000) requestAnimationFrame(tick); else resolve();
          };
          requestAnimationFrame(tick);
        });
        const measured = intervals.slice(10), sorted = measured.slice().sort((a, b) => a - b);
        const canvas = document.querySelector<HTMLCanvasElement>('canvas')!, gl = canvas.getContext('webgl2')!, extension = gl.getExtension('WEBGL_debug_renderer_info');
        return { elapsedMs: last - first, intervals, states, fps: 1000 / (measured.reduce((a, b) => a + b, 0) / measured.length), p95: sorted[Math.floor(sorted.length * .95)], p99: sorted[Math.floor(sorted.length * .99)], max: Math.max(...measured), totalCalls: costs.calls - before.calls, totalTriangles: costs.triangles - before.triangles, framebuffer: [canvas.width, canvas.height], renderer: extension ? gl.getParameter(extension.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER), art: { ...canvas.dataset } };
      });
      await driver;
      const state = await page.locator('#game').evaluate(root => ({ ...(root as HTMLElement).dataset }));
      const save = await page.evaluate(() => localStorage.getItem('pocketey-orbit-amber-v1'));
      const allRunning = sample.states.every((state: any) => state.status === 'running' && state.mode === 'play');
      const valid = allRunning && !driverError && errors.length === 0 && sample.intervals.length >= 20 && (mode === 'stationary' || state.status === 'clear');
      records.push({ mobile, mode, order, variant, errors, driverError, valid, allRunning, ...sample, endState: state, save, inputTrace: trace });
      console.log(JSON.stringify({ mobile, mode, order, variant, valid, fps: sample.fps, p95: sample.p95, framebuffer: sample.framebuffer, first: sample.states[0], last: sample.states.at(-1), endStatus: state.status }));
      await context.close();
      if (browser.contexts().length) throw Error('Contexts accumulated');
    }
  }
  for (const mobile of [false, true]) for (const mode of ['stationary', 'moving']) {
    const samples = (records as any[]).filter(record => record.mobile === mobile && record.mode === mode);
    if (!samples.every(sample => JSON.stringify(sample.framebuffer) === JSON.stringify(samples[0].framebuffer))) throw Error('Unequal framebuffers');
    if (!samples.every(sample => sample.renderer === samples[0].renderer)) throw Error('Unequal renderers');
  }
  await fs.writeFile(output, JSON.stringify({ candidateSHA, baselineSHA, urls, browser: browser.version(), node: process.version, cpu: os.cpus()[0]?.model, protocol: 'Predeclared ABBA order per viewport/mode. Sequential fresh contexts in one Chromium SwiftShader. Native sound ON/start; wait for simulation time1.5s. Stationary stage1 x0 with normal idle animation and running rAF; moving stage3 via existing keyboard/touch driver. Both use five seconds of wall-clock rAF after warm-up, first10 intervals excluded, all raw intervals/states retained. Moving drivers continue through normal stage3 clear and save. Equal renderer/framebuffers asserted. No physics writes, paused/held rAF or passing-host reruns. This diagnostic is separate from unchanged45fps/p95<=40ms release gates.', records }, null, 2));
  if ((records as any[]).some(record => !record.valid)) process.exitCode = 1;
} finally { await browser.close(); }
