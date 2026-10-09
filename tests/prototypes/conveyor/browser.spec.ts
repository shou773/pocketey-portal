import { test, expect, type Page } from '@playwright/test';
const url = '/prototypes/conveyor/?lang=ja';
const rotationString = '0,0,0,1,1,2,2,3';
async function ready(page: Page) {
  await page.goto(url); await expect(page.locator('#conveyor')).toHaveAttribute('data-webgl','true');
  await expect(page.locator('#conveyor')).toHaveAttribute('data-frames',/^[1-9]/);
  await expect(page.locator('#conveyor')).toHaveAttribute('data-render-pending','false');
}
async function solve(page: Page) {
  for (const [id,count] of [['a',3],['c',1],['d',1],['e',1],['g',1]] as const) {
    for (let i=0;i<count;i++) await page.locator(`[data-tile="${id}"]`).tap();
  }
  await expect(page.locator('#conveyor')).toHaveAttribute('data-rotations',rotationString);
}
test('mobile ordinary taps: failure, edit, selection, Play, success, persistence and reset', async ({ page }) => {
  const errors: string[]=[]; page.on('pageerror', error=>errors.push(error.message));
  await ready(page);
  const root=page.locator('#conveyor');
  await page.locator('#cv-play').tap();
  await expect(root).toHaveAttribute('data-phase','running');
  await expect(page.locator('[data-tile="a"]')).toBeDisabled();
  // Even a synthetic click that bypasses the native disabled button cannot rotate.
  const initial=await root.getAttribute('data-rotations');
  await page.locator('[data-tile="a"]').dispatchEvent('click');
  await expect(root).toHaveAttribute('data-rotations',initial!);
  await expect(root).toHaveAttribute('data-phase','failed');
  await expect(root).toHaveAttribute('data-result','wrong-entry');
  await solve(page);
  await expect(page.locator('[data-tile="g"]')).toHaveAttribute('aria-pressed','true');
  await page.locator('#cv-play').tap(); await expect(root).toHaveAttribute('data-phase','success');
  await expect(page.locator('#cv-status')).toHaveText('出荷できました！');
  await expect(page.locator('#cv-best')).toHaveText('最少 7 回で出荷');
  await page.screenshot({path:'test-results/conveyor/success-mobile.png',fullPage:true});
  await page.locator('#cv-play').tap(); await expect(root).toHaveAttribute('data-phase','editing');
  await expect(root).toHaveAttribute('data-rotations',rotationString);
  await page.reload(); await expect(root).toHaveAttribute('data-rotations',rotationString);
  await expect(page.locator('#cv-best')).toHaveText('最少 7 回で出荷');
  await page.locator('#cv-reset').tap(); await expect(root).toHaveAttribute('data-rotations','1,0,3,0,0,2,1,3');
  await expect(page.locator('#cv-turns')).toHaveText('回転 0 回');
  expect(errors).toEqual([]);
});
test('pause/settings/blur keep the parcel still; resetting a run cancels completion', async ({ page }) => {
  await ready(page); await solve(page); const root=page.locator('#conveyor');
  await page.locator('#cv-play').tap(); await page.locator('#cv-play').tap();
  await expect(root).toHaveAttribute('data-phase','paused');
  await page.waitForTimeout(150); const elapsed=await root.getAttribute('data-elapsed');
  await page.waitForTimeout(200); await expect(root).toHaveAttribute('data-elapsed',elapsed!);
  await page.locator('[data-tile="c"]').dispatchEvent('click'); await expect(root).toHaveAttribute('data-rotations',rotationString);
  await page.locator('#cv-play').tap(); await expect(root).toHaveAttribute('data-phase','running');
  await page.locator('#cv-settings').tap(); await expect(root).toHaveAttribute('data-phase','paused');
  await expect(page.locator('#cv-audio')).toBeVisible();
  await page.locator('#cv-volume').fill('35'); await page.locator('#cv-audio-close').tap();
  await expect(root).toHaveAttribute('data-phase','paused');
  await page.locator('#cv-play').tap(); await page.evaluate(()=>window.dispatchEvent(new Event('blur')));
  await expect(root).toHaveAttribute('data-phase','paused');
  await page.locator('#cv-play').tap(); await page.locator('#cv-reset').tap();
  await expect(root).toHaveAttribute('data-phase','editing');
  await page.waitForTimeout(5500); await expect(root).toHaveAttribute('data-phase','editing');
  const frames=await root.getAttribute('data-frames'); await page.waitForTimeout(250);
  await expect(root).toHaveAttribute('data-frames',frames!); // No continuous idle rendering.
});
test('320px touch targets, keyboard, English/Japanese and separate audio/save storage', async ({ page }) => {
  await page.addInitScript(()=>localStorage.setItem('pocketey-audio-v1',JSON.stringify({tilt:{sfx:.2,sfxMuted:false}})));
  await page.setViewportSize({width:320,height:740}); await ready(page);
  const targets=await page.locator('.cv-tile').evaluateAll(buttons=>buttons.map(b=>{const r=b.getBoundingClientRect();return{x:r.x,y:r.y,w:r.width,h:r.height};}));
  for (const target of targets) { expect(target.w).toBeGreaterThanOrEqual(44);expect(target.h).toBeGreaterThanOrEqual(44);expect(target.x).toBeGreaterThanOrEqual(0);expect(target.x+target.w).toBeLessThanOrEqual(320); }
  for(let i=0;i<targets.length;i++)for(let j=i+1;j<targets.length;j++){
    const a=targets[i],b=targets[j];expect(Math.min(a.x+a.w,b.x+b.w)<=Math.max(a.x,b.x)||Math.min(a.y+a.h,b.y+b.h)<=Math.max(a.y,b.y)).toBeTruthy();
  }
  await page.locator('[data-language="en"]').tap(); await expect(page.locator('#cv-title')).toHaveText('Parcel Turn');
  await page.locator('[data-tile="a"]').focus(); await page.keyboard.press('Enter'); await expect(page.locator('#conveyor')).toHaveAttribute('data-rotations','2,0,3,0,0,2,1,3');
  await page.keyboard.press('Space'); await expect(page.locator('#conveyor')).toHaveAttribute('data-rotations','3,0,3,0,0,2,1,3');
  await page.locator('#cv-sound').tap(); await expect(page.locator('#cv-sound')).toHaveText('Sound ON');
  const audio=await page.evaluate(()=>JSON.parse(localStorage.getItem('pocketey-audio-v1')!));
  expect(audio.tilt).toEqual({sfx:.2,sfxMuted:false}); expect(audio.conveyor.sfxMuted).toBe(false);
  await page.locator('[data-language="ja"]').tap(); await expect(page.locator('#cv-title')).toHaveText('コンベア便');
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth)).toBe(true);
  // A language reflow may schedule a new frame; capture after that presentation.
  await expect(page.locator('#conveyor')).toHaveAttribute('data-render-pending','false');
  await page.screenshot({path:'test-results/conveyor/mobile-320.png',fullPage:true});
});
test('WebGL loss cancels interaction and gives an explicit reload fallback', async ({ page }) => {
  await ready(page); await page.locator('#cv-play').tap();
  await page.locator('#cv-canvas').dispatchEvent('webglcontextlost');
  await expect(page.locator('#conveyor')).toHaveAttribute('data-webgl','false');
  await expect(page.locator('#conveyor')).toHaveAttribute('data-phase','paused');
  await expect(page.locator('#cv-unavailable')).toBeVisible(); await expect(page.locator('#cv-play')).toBeDisabled();
});
test('malformed audio JSON recovers on edits and retains preferences after reload', async ({ page }) => {
  const errors: string[]=[]; page.on('pageerror', error=>errors.push(error.message));
  await page.addInitScript(()=>{
    // Seed once so a reload verifies the repaired value instead of corrupting it again.
    if (localStorage.getItem('pocketey-audio-v1') === null) localStorage.setItem('pocketey-audio-v1','{');
  });
  await ready(page);
  expect(await page.evaluate(()=>localStorage.getItem('pocketey-audio-v1'))).toBe('{');
  await expect(page.locator('#cv-sound')).toHaveAttribute('aria-pressed','false');
  await page.locator('#cv-sound').tap();
  await expect(page.locator('#cv-sound')).toHaveAttribute('aria-pressed','true');
  expect(await page.evaluate(()=>JSON.parse(localStorage.getItem('pocketey-audio-v1')!))).toEqual({conveyor:{sfx:.8,sfxMuted:false}});
  await page.locator('#cv-settings').tap();
  await page.locator('#cv-volume').fill('35'); await page.locator('#cv-audio-close').tap();
  expect(await page.evaluate(()=>JSON.parse(localStorage.getItem('pocketey-audio-v1')!))).toEqual({conveyor:{sfx:.35,sfxMuted:false}});
  await page.reload();
  await expect(page.locator('#conveyor')).toHaveAttribute('data-webgl','true');
  await expect(page.locator('#cv-sound')).toHaveAttribute('aria-pressed','true');
  await page.locator('#cv-settings').tap(); await expect(page.locator('#cv-volume')).toHaveValue('35');
  await page.locator('#cv-audio-close').tap(); await page.locator('#cv-sound').tap();
  expect(await page.evaluate(()=>JSON.parse(localStorage.getItem('pocketey-audio-v1')!))).toEqual({conveyor:{sfx:.35,sfxMuted:true}});
  expect(errors).toEqual([]);
});
test('blocked storage still allows a fresh playable board', async ({ browser }) => {
  const context=await browser.newContext({viewport:{width:390,height:844},hasTouch:true});
  await context.addInitScript(()=>{Storage.prototype.getItem=()=>{throw new DOMException('blocked','SecurityError');};Storage.prototype.setItem=()=>{throw new DOMException('blocked','SecurityError');};});
  const page=await context.newPage();await ready(page);
  await expect(page.locator('#cv-save')).toContainText('保存できません');
  await page.locator('#cv-sound').tap(); await expect(page.locator('#cv-sound')).toHaveAttribute('aria-pressed','true');
  await page.locator('#cv-settings').tap(); await page.locator('#cv-volume').fill('35');
  await expect(page.locator('#cv-volume')).toHaveValue('35'); await page.locator('#cv-audio-close').tap();
  await solve(page); await page.locator('#cv-play').tap();
  await expect(page.locator('#conveyor')).toHaveAttribute('data-phase','success');await context.close();
});
