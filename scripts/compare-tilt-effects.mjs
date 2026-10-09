import { chromium } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';
const out = 'test-results/tilt-effects-comparison'; await mkdir(out, { recursive: true });
const browser = await chromium.launch({ args: ['--no-sandbox', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const results = [];
try {
  // Three declared alternating pairs. Both use their own production build and
  // identical stage-3 held-brake input; no development fixture or state writes.
  for (let pair = 0; pair < 3; pair++) for (const variant of pair % 2 ? ['candidate', 'baseline'] : ['baseline', 'candidate']) {
    const port = variant === 'baseline' ? 4336 : 4335;
    const context = await browser.newContext({ viewport: { width: 1280, height: 800 }, deviceScaleFactor: 1, hasTouch: false });
    const page = await context.newPage(); const errors = [];
    page.on('pageerror', e => errors.push(e.message));
    const assets = Promise.all(['observatory.glb', 'wind-rock.glb'].map(name => page.waitForResponse(r => r.url().endsWith(name) && r.status() === 200)));
    await page.goto(`http://127.0.0.1:${port}/games/tilttrail/?lang=en`); await assets; await page.waitForTimeout(300);
    await page.locator('[data-stage="2"]').click(); await page.getByRole('button', { name: 'Play this stage' }).click(); await page.keyboard.down('Space');
    const sample = await page.evaluate(async () => {
      const samples = [], counters = []; let previous = performance.now();
      await new Promise(resolve => { function frame(now) { const d = document.querySelector('#tilttrail').dataset; samples.push(now - previous); previous = now; counters.push({ phase: d.phase, calls: +d.drawCalls, triangles: +d.triangles, trail: +(d.trailPoints || 0), trailLength: +(d.trailLength || 0), brake: +(d.brakeOpacity || 0), z: +d.z }); if (samples.length < 180) requestAnimationFrame(frame); else resolve(); } requestAnimationFrame(frame); });
      const sorted = samples.slice(10).sort((a, b) => a - b), canvas = document.querySelector('canvas'), gl = canvas.getContext('webgl2'), ext = gl.getExtension('WEBGL_debug_renderer_info');
      return { fps: 1000 / (sorted.reduce((a,b) => a+b, 0) / sorted.length), p95: sorted[Math.floor(sorted.length * .95)], samples, counters, viewport: [innerWidth,innerHeight], framebuffer: [canvas.width,canvas.height], renderer: ext ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER), maxCalls: Math.max(...counters.map(x => x.calls)), maxTriangles: Math.max(...counters.map(x => x.triangles)) };
    });
    await page.keyboard.up('Space');
    const session = await context.newCDPSession(page); const shot = await session.send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false });
    await writeFile(`${out}/pair${pair + 1}-${variant}-production.png`, Buffer.from(shot.data, 'base64')); await session.detach();
    results.push({ pair: pair + 1, variant, errors, ...sample });
    console.log(JSON.stringify({ pair: pair + 1, variant, fps: sample.fps, p95: sample.p95, maxCalls: sample.maxCalls, maxTriangles: sample.maxTriangles, framebuffer: sample.framebuffer, phases: [...new Set(sample.counters.map(x => x.phase))], errors }));
    await context.close();
  }
} finally { await browser.close(); await writeFile(`${out}/samples.json`, JSON.stringify(results, null, 2)); }
const baseline = results.filter(x => x.variant === 'baseline'), candidate = results.filter(x => x.variant === 'candidate');
const median = values => values.slice().sort((a,b) => a-b)[Math.floor(values.length / 2)];
const summary = { mode: 'diagnostic production stage-3 held-brake sample, not a replacement for unchanged full-course acceptance', baselineFPS: baseline.map(x => x.fps), candidateFPS: candidate.map(x => x.fps), baselineMedian: median(baseline.map(x => x.fps)), candidateMedian: median(candidate.map(x => x.fps)), pairedPercent: candidate.map(c => 100 * (c.fps / baseline.find(b => b.pair === c.pair).fps - 1)), candidateBudgetPass: candidate.every(x => x.maxCalls <= 16 && x.maxTriangles < 6000), allPlaying: results.every(x => x.counters.every(c => c.phase === 'playing')), errors: results.flatMap(x => x.errors) };
await writeFile(`${out}/summary.json`, JSON.stringify(summary, null, 2)); console.log(JSON.stringify(summary, null, 2));
if (!summary.candidateBudgetPass || !summary.allPlaying || summary.errors.length) process.exitCode = 1;