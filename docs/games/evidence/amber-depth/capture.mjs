// Amber-only visual review: native start/keyboard input, deterministic held rAF.
// No writes to game state; both variants use the same timestamps and inputs.
import { chromium } from '@playwright/test';
import fs from 'node:fs/promises';
const phase = process.argv[2];
if (!['before', 'after'].includes(phase)) throw Error('Expected before or after');
const base = process.env.AMBER_BASE_URL || 'http://127.0.0.1:4344';
const stage = process.env.AMBER_STAGE === '3' ? 3 : 1;
const scenario = process.env.AMBER_CASE || '';
const contactReview = process.env.AMBER_REVIEW === 'contact';
if (scenario && (stage !== 3 || !['stop', 'early', 'late'].includes(scenario))) throw Error('Cases require stage3: stop, early, late');
const out = new URL(`./${contactReview ? 'contact-review/' : ''}${phase}${stage === 3 ? '-stage3' : ''}${scenario ? '-' + scenario : ''}/`, import.meta.url);
await fs.mkdir(out, { recursive: true });
const browser = await chromium.launch({ executablePath: '/usr/bin/chromium', args: ['--no-sandbox', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const results = [];
try {
  const viewports = contactReview ? [stage === 3 ? { width: 390, height: 844 } : { width: 844, height: 390 }] : [{ width: 390, height: 844 }, { width: 844, height: 390 }];
  for (const viewport of viewports) {
    const context = await browser.newContext({ locale: 'ja-JP', viewport, deviceScaleFactor: 1, isMobile: true, hasTouch: true });
    const page = await context.newPage(); const errors = [];
    if (stage === 3) await context.addInitScript(() => {
      localStorage.setItem('pocketey-orbit-amber-v1', JSON.stringify({ version: 1, sound: false, orbit: { unlocked: 1 }, amber: { unlocked: 3 } }));
    });
    page.on('pageerror', e => errors.push(e.message));
    await page.addInitScript(() => {
      const raf = requestAnimationFrame.bind(window);
      window.amberCapture = { held: false, pending: null, now: 0, calls: 0, triangles: 0 };
      window.requestAnimationFrame = callback => raf(now => {
        if (window.amberCapture.held) window.amberCapture.pending = callback;
        else { window.amberCapture.now = now; callback(now); }
      });
      for (const name of ['drawElements', 'drawArrays', 'drawElementsInstanced', 'drawArraysInstanced']) {
        const original = WebGL2RenderingContext.prototype[name];
        WebGL2RenderingContext.prototype[name] = function (...args) {
          window.amberCapture.calls++;
          const instances = name === 'drawElementsInstanced' ? args[4] : name === 'drawArraysInstanced' ? args[3] : 1;
          if (args[0] === this.TRIANGLES) window.amberCapture.triangles += args[name.includes('Elements') ? 1 : 2] / 3 * instances;
          return original.apply(this, args);
        };
      }
    });
    await page.goto(`${base}/games/amber-step/?lang=ja`);
    await page.waitForFunction(() => document.querySelector('canvas')?.dataset.artAdopted === 'true');
    if (stage === 3) await page.getByRole('button', { name: /^ステージ 3 / }).click();
    await page.waitForTimeout(300);
    await page.evaluate(() => { window.amberCapture.held = true; });
    await page.waitForFunction(() => !!window.amberCapture.pending, null, { polling: 50 });
    await page.evaluate(() => {
      document.querySelector('#actions button').click();
      window.amberCapture.now = performance.now();
      const callback = window.amberCapture.pending; window.amberCapture.pending = null;
      window.amberCapture.calls = 0; window.amberCapture.triangles = 0;
      callback(window.amberCapture.now);
    });
    const capture = async name => {
      if (contactReview && name !== (stage === 3 ? 'edge-spike' : 'start')) return;
      await page.screenshot({ path: new URL(`${viewport.width}-${name}.png`, out).pathname });
      results.push(await page.evaluate(({ name, viewport }) => {
        const canvas = document.querySelector('canvas'), gl = canvas.getContext('webgl2'), ext = gl.getExtension('WEBGL_debug_renderer_info');
        return { name, viewport, state: { ...document.querySelector('#game').dataset }, art: { ...canvas.dataset }, buffer: [canvas.width, canvas.height], calls: window.amberCapture.calls, triangles: window.amberCapture.triangles, renderer: ext ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER) };
      }, { name, viewport }));
    };
    if (!scenario) await capture('start');
    const frame = async () => {
      await page.waitForFunction(() => !!window.amberCapture.pending, null, { polling: 5 });
      await page.evaluate(() => {
        const probe = window.amberCapture; probe.now += 1000 / 60;
        const callback = probe.pending; probe.pending = null; probe.calls = 0; probe.triangles = 0;
        callback(probe.now);
        if (document.querySelector('#game').dataset.status === 'dead' && !probe.failedCanvas) probe.failedCanvas = document.querySelector('canvas').toDataURL('image/png');
      });
    };
    await page.keyboard.down('ArrowRight');
    for (let i = 0; i < 105; i++) {
      if (i === 26) await page.keyboard.down('Space');
      if (i === 27) await page.keyboard.up('Space');
      await frame();
      if (!scenario && [25, 37, 52, 82].includes(i)) await capture(`motion-${String(i + 1).padStart(3, '0')}`);
    }
    await page.keyboard.up('ArrowRight');
    if (!scenario) await capture('gap');
    if (stage === 3) {
      await page.keyboard.down('ArrowRight');
      for (let i = 105; i < 214; i++) {
        if (i === 111) await page.keyboard.down('Space');
        if (i === 112) await page.keyboard.up('Space');
        if (scenario === 'early' && i === 192) await page.keyboard.down('Space');
        if (scenario === 'early' && i === 193) await page.keyboard.up('Space');
        await frame();
      }
      await page.keyboard.up('ArrowRight');
      await capture('edge-spike');
      if (scenario === 'stop') {
        for (let i = 0; i < 30; i++) await frame();
        await capture('stopped');
        await page.keyboard.down('ArrowRight'); await page.keyboard.down('Space');
        for (let i = 0; i < 63; i++) {
          await frame();
          if (i === 0) await page.keyboard.up('Space');
          if (i === 17) await capture('combo-rising');
        }
        await page.keyboard.up('ArrowRight'); await capture('combo-landed');
      } else if (scenario === 'early' || scenario === 'late') {
        await page.keyboard.down('ArrowRight');
        for (let i = 214; i < 310; i++) {
          if (scenario === 'late' && i === 224) await page.keyboard.down('Space');
          if (scenario === 'late' && i === 225) await page.keyboard.up('Space');
          await frame();
          if (scenario === 'late' && i === 222) await capture('late-approach');
          if (scenario === 'early' && i === 229) await capture('early-descending-approach');
          if (scenario === 'early' && i === 253) await capture('early-descent');
        }
        await page.keyboard.up('ArrowRight'); await capture('failure');
        const failedCanvas = await page.evaluate(() => window.amberCapture.failedCanvas);
        if (failedCanvas) await fs.writeFile(new URL(`${viewport.width}-failure-canvas.png`, out), Buffer.from(failedCanvas.split(',')[1], 'base64'));
      }
    }
    results.push({ viewport, errors });
    await context.close();
  }
  await fs.writeFile(new URL('capture.json', out), JSON.stringify({ phase, stage, scenario, base, browser: browser.version(), method: 'Native start and ArrowRight; Space at frame 26. Held rAF at 60Hz, 105 frames. Stage3 uses the existing v1 unlock fixture, native stage selection and a gap jump at frame111. Stop case holds30 frames at x17.833 before a combined movement/jump; early case jumps at frame192, late at224. No physics writes. Actual canvas and full mobile page; DPR1.', results }, null, 2));
  console.log(JSON.stringify(results));
} finally { await browser.close(); }
