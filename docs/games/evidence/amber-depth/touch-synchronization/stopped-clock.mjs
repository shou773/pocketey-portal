import { chromium } from '@playwright/test';
import fs from 'node:fs/promises';
const browser = await chromium.launch({ executablePath: '/usr/bin/chromium', args: ['--no-sandbox', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
try {
  const page = await browser.newPage({ locale: 'ja-JP', viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  await page.goto('http://127.0.0.1:4354/games/amber-step/');
  await page.getByRole('button', { name: 'ステージ 1 をはじめる' }).click();
  await page.locator('#pause').click();
  const time = Number(await page.locator('#timer').textContent());
  const started = Date.now(); let errorName;
  try { await page.waitForFunction(start => Number(document.querySelector('#timer')?.textContent) - start >= .2, time, { timeout: 3000 }); }
  catch (error) { errorName = error.name; }
  const result = { protocol: 'Native start/pause freezes clock; same bounded simulation wait must reject. No clock/state injection.', initialTime: time, finalTime: Number(await page.locator('#timer').textContent()), elapsedMs: Date.now() - started, errorName, mode: await page.locator('#game').getAttribute('data-mode') };
  await fs.writeFile(new URL('./stopped-clock.json', import.meta.url), JSON.stringify(result, null, 2));
  console.log(result);
  if (errorName !== 'TimeoutError' || result.initialTime !== result.finalTime || result.mode !== 'pause') throw Error('Stopped-clock wait did not reject correctly');
} finally { await browser.close(); }
