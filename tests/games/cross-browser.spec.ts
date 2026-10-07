import {test,expect} from '@playwright/test';
import {SAVE_KEY} from '../../src/games/model';
import {play,read} from './input';

// These engines use ordinary keyboard/mouse input at phone dimensions.
// Playwright has no portable native multi-touch injection: Chromium covers that separately.
for(const kind of ['orbit','amber'] as const){
 const route=`/games/${kind==='orbit'?'orbit-ribbon':'amber-step'}/`;
 test(`${kind}: six-stage matrix, saved unlocks, audio and recovery`,async({page,browser},info)=>{
  const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto(route);
  await expect(page.locator('#game')).toHaveAttribute('data-mode','menu');
  await expect(page.getByRole('button',{name:/ステージ 2 /})).toBeDisabled();
  for(let stage=0;stage<3;stage++){
   await page.getByRole('button',{name:stage?'次のステージ':'ステージ 1 をはじめる'}).click();
   await expect(page.locator('#game')).toHaveAttribute('data-status','running');
   await play(page,kind,stage);
   await page.locator('.hero-mark').evaluate(async e=>{await Promise.all(e.getAnimations().map(a=>a.finished));});
   await page.screenshot({path:info.outputPath(`${kind}-${stage+1}-clear.png`)});
  }
  await page.getByRole('button',{name:'ステージ選択'}).click();
  await page.locator('#sound').click();await page.reload();
  await expect(page.locator('#sound')).toHaveText('音 ON');
  await expect(page.getByRole('button',{name:/ステージ 3 /})).toBeEnabled();
  const saved=await page.evaluate(k=>localStorage.getItem(k),SAVE_KEY);
  expect(JSON.parse(saved!)[kind].challengeBest.every((n:number)=>n>0)).toBe(true);
  const reopened=await page.context().newPage();await reopened.goto(route);
  await expect(reopened.getByRole('button',{name:/ステージ 3 /})).toBeEnabled();await reopened.close();
  await page.getByRole('button',{name:'ステージ 1 をはじめる'}).click();
  const supported=await page.evaluate(()=>{
   const gl=document.querySelector('canvas')!.getContext('webgl2')!,ext=gl.getExtension('WEBGL_lose_context');
   if(!ext)return false;ext.loseContext();return true;
  });
  expect(supported).toBe(true);
  await expect(page.locator('#game')).toHaveAttribute('data-mode','recovery');
  await expect(page.locator('#pause')).toBeDisabled();await expect(page.locator('[data-input=jump]')).toBeDisabled();
  const frozen=await read(page);await page.keyboard.press('KeyR');await page.waitForTimeout(200);
  expect((await read(page)).x).toBe(frozen.x);
  expect(await page.evaluate(k=>localStorage.getItem(k),SAVE_KEY)).toBe(saved);
  await page.getByRole('button',{name:'再読み込み',exact:true}).click();
  await expect(page.locator('#game')).toHaveAttribute('data-mode','menu');
  expect(await page.evaluate(k=>localStorage.getItem(k),SAVE_KEY)).toBe(saved);
  expect(errors).toEqual([]);
  await info.attach('engine',{body:JSON.stringify({browser:browser.version(),viewport:page.viewportSize(),input:'keyboard; phone dimensions, not physical touch'}),contentType:'application/json'});
 });
 test(`${kind}: small menus, pointer input, pause, orientation and restarts`,async({page},info)=>{
  await page.setViewportSize({width:320,height:568});await page.goto(route);
  await expect(page.locator('#game')).toHaveAttribute('data-mode','menu');
  const controls=page.locator('#overlay button:visible, #overlay a:visible');
  for(let i=0;i<await controls.count();i++){
   await controls.nth(i).scrollIntoViewIfNeeded();
   expect(await controls.nth(i).evaluate(e=>{const a=e.getBoundingClientRect(),b=document.querySelector('#overlay')!.getBoundingClientRect();return a.top>=b.top-1&&a.bottom<=b.bottom+1;})).toBe(true);
  }
  await page.screenshot({path:info.outputPath('small-menu.png')});
  await page.getByRole('button',{name:'ステージ 1 をはじめる'}).click();
  const right=page.locator('[data-input=right]');await right.hover();await page.mouse.down();await page.keyboard.press('Space');await page.waitForTimeout(150);
  expect(Number((await read(page)).y)).toBeGreaterThan(0);
  await page.mouse.up();await expect(right).not.toHaveClass(/held/);
  await page.keyboard.down('ArrowRight');await page.evaluate(()=>window.dispatchEvent(new Event('blur')));await page.keyboard.up('ArrowRight');
  await expect(page.locator('#game')).toHaveAttribute('data-mode','pause');
  await page.getByRole('button',{name:'つづける'}).click();const pos=await read(page);await page.waitForTimeout(150);
  expect((await read(page))[kind==='orbit'?'z':'x']).toBe(pos[kind==='orbit'?'z':'x']);
  for(let i=0;i<20;i++)await page.keyboard.press('KeyR');
  await page.locator('#pause').click();
  for(const size of [{width:390,height:844},{width:844,height:390}]){
   await page.setViewportSize(size);await expect(page.getByRole('button',{name:'つづける'})).toBeInViewport();
   // WebKit screenshots can arrive before the next ResizeObserver/render frame.
   // Require the actual drawing buffer to match its new CSS aspect ratio first.
   await expect.poll(()=>page.locator('canvas').evaluate(e=>{const c=e as HTMLCanvasElement;return Math.abs(c.width/c.height-c.clientWidth/c.clientHeight);})).toBeLessThan(.02);
   expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
   await page.screenshot({path:info.outputPath(`layout-${size.width}.png`)});
   await page.getByRole('button',{name:'つづける'}).click();
   await page.screenshot({path:info.outputPath(`play-${size.width}.png`)});
   await page.locator('#pause').click();
  }
  await page.getByRole('button',{name:'つづける'}).click();await expect(page.locator('[data-input=jump]')).toBeInViewport();
 });
}
test('corrupt storage and scoped reset',async({page})=>{
 await page.addInitScript(k=>{localStorage.setItem(k,'{bad');localStorage.setItem('unrelated','keep');},SAVE_KEY);
 await page.goto('/games/amber-step/');await expect(page.locator('#game')).toHaveAttribute('data-mode','menu');
 await page.locator('#reset').click();await page.getByRole('button',{name:'この2作品をリセット',exact:true}).click();
 expect(await page.evaluate(()=>localStorage.getItem('unrelated'))).toBe('keep');
 expect(await page.evaluate(k=>JSON.parse(localStorage.getItem(k)!).amber.unlocked,SAVE_KEY)).toBe(1);
});
