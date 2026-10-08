import { chromium } from '@playwright/test';
import fs from 'node:fs/promises';

const browser = await chromium.launch({ executablePath: '/usr/bin/chromium', args: ['--no-sandbox', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const reports = [];
// Alternate ordering, with one renderer/page active at a time. This is a
// renderer diagnostic, not a replacement for native gameplay performance CI.
for (let trial = 0; trial < 3; trial++) for (const mobile of [true, false]) for (const phase of trial % 2 ? ['after', 'before'] : ['before', 'after']) {
  const base = phase === 'before' ? 'http://127.0.0.1:4333' : 'http://127.0.0.1:4332';
  const context = await browser.newContext({ viewport: mobile ? { width: 390, height: 844 } : { width: 1280, height: 900 }, deviceScaleFactor: 1, hasTouch: mobile, isMobile: mobile });
  const page = await context.newPage(); await page.goto(`${base}/games/tilttrail/?lang=en`);
  const size = await page.locator('canvas').evaluate(c => ({ width: c.clientWidth, height: c.clientHeight }));
  await page.goto(base); await page.setContent(`<canvas style="width:${size.width}px;height:${size.height}px;display:block"></canvas><style>body{margin:0}</style>`);
  const result = await page.evaluate(async () => {
    const m = await import('/src/games/prototypes/ball/model.ts'), v = await import('/src/games/prototypes/ball/render.ts');
    const canvas = document.querySelector('canvas'), view = v.createView(canvas), state = m.createState(2); await view.ready; state.phase = 'playing';
    for (let i = 0; i < 6 / m.STEP; i++) {
      const road = m.track(2, state.z), future = m.track(2, state.z + .7), target = (future.x - road.x) / .7 * state.speed + (road.x - state.x) * 3, diff = target - state.vx;
      m.advance(state, { steer: diff > .3 ? 1 : diff < -.3 ? -1 : 0, brake: road.width < 4 });
    }
    view.draw(state);
    const samples = []; let previous = performance.now();
    await new Promise(resolve => { function frame(now) { samples.push(now - previous); previous = now; view.draw(state); if (samples.length < 200) requestAnimationFrame(frame); else resolve(); } requestAnimationFrame(frame); });
    const sorted = samples.slice(20).sort((a,b) => a-b), gl = view.renderer.getContext(), extension = gl.getExtension('WEBGL_debug_renderer_info');
    const result = { fps: 1000 / (sorted.reduce((a,b) => a+b, 0) / sorted.length), p95: sorted[Math.floor(sorted.length * .95)], samples, framebuffer: [canvas.width, canvas.height], calls: view.renderer.info.render.calls, triangles: view.renderer.info.render.triangles, renderer: extension ? gl.getParameter(extension.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER) };
    view.dispose(); return result;
  });
  reports.push({ trial, phase, mobile, ...result }); console.log({ trial, phase, mobile, fps: result.fps, p95: result.p95 }); await context.close();
}
await fs.writeFile(new URL('./evidence/render-benchmark.json', import.meta.url), JSON.stringify(reports, null, 2)); await browser.close();
