import { chromium } from '@playwright/test';
import fs from 'node:fs/promises';

const phase = process.argv[2] || 'before';
const base = process.env.TILT_ART_BASE || 'http://127.0.0.1:4342';
const out = new URL('./evidence/', import.meta.url);
await fs.mkdir(out, { recursive: true });
const browser = await chromium.launch({ executablePath: '/usr/bin/chromium', args: ['--no-sandbox', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const reports = [];
for (const mobile of [true, false]) {
  const context = await browser.newContext({ viewport: mobile ? { width: 390, height: 844 } : { width: 1280, height: 900 }, deviceScaleFactor: 1, hasTouch: mobile, isMobile: mobile });
  const page = await context.newPage();
  const errors = []; page.on('pageerror', e => errors.push(e.message));
  await page.goto(`${base}/games/tilttrail/?lang=en`);
  const size = await page.locator('canvas').evaluate(c => ({ width: c.clientWidth, height: c.clientHeight }));
  await page.getByRole('button', { name: 'Play this stage' }).click();
  const brake = await page.locator('[data-tt-input="brake"]').boundingBox();
  if (mobile) {
    const session = await context.newCDPSession(page);
    await session.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ id: 1, x: brake.x + brake.width / 2, y: brake.y + brake.height / 2, radiusX: 5, radiusY: 5, force: 1 }] });
  } else {
    await page.mouse.move(brake.x + brake.width / 2, brake.y + brake.height / 2); await page.mouse.down();
  }
  await page.waitForFunction(() => Number(document.querySelector('#tilttrail').dataset.time) >= 3);
  const nativeBefore = await page.locator('#tilttrail').evaluate(el => ({ ...el.dataset }));
  await page.screenshot({ path: new URL(`${phase}-native-${mobile ? 'mobile' : 'desktop'}.png`, out).pathname });
  const nativeAfter = await page.locator('#tilttrail').evaluate(el => ({ ...el.dataset }));
  await page.close();
  const capture = await context.newPage(); await capture.goto(base);
  await capture.setContent(`<canvas style="width:${size.width}px;height:${size.height}px;display:block"></canvas><style>body{margin:0}</style>`);
  const result = await capture.evaluate(async () => {
    const m = await import('/src/games/prototypes/ball/model.ts');
    const v = await import('/src/games/prototypes/ball/render.ts');
    const state = m.createState(0); state.phase = 'playing';
    for (let i = 0; i < 3 / m.STEP; i++) {
      const road = m.track(0, state.z), future = m.track(0, state.z + .7);
      const target = (future.x - road.x) / .7 * state.speed + (road.x - state.x) * 3, diff = target - state.vx;
      m.advance(state, { steer: diff > .3 ? 1 : diff < -.3 ? -1 : 0, brake: road.width < 4 });
    }
    const canvas = document.querySelector('canvas'), view = v.createView(canvas); await view.ready;
    view.draw(state); await new Promise(requestAnimationFrame); view.draw(state);
    const result = { state, css: { width: canvas.clientWidth, height: canvas.clientHeight }, framebuffer: [canvas.width, canvas.height], calls: view.renderer.info.render.calls, triangles: view.renderer.info.render.triangles, image: canvas.toDataURL('image/png') };
    view.dispose(); return result;
  });
  await fs.writeFile(new URL(`${phase}-matched-${mobile ? 'mobile' : 'desktop'}.png`, out), Buffer.from(result.image.split(',')[1], 'base64'));
  delete result.image;
  reports.push({ mobile, errors, nativeBefore, nativeAfter, ...result });
  await context.close();
}
await fs.writeFile(new URL(`${phase}.json`, out), JSON.stringify(reports, null, 2));
await browser.close(); console.log(reports);
