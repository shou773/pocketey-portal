import { test, expect, type Page } from '@playwright/test';

// Only rendering is replaced at the network boundary. Production has no test
// mode. Real page/app/model/input/storage/audio UI run with a controlled clock.
test.beforeEach(async({page})=>{
  await page.route('**/src/games/prototypes/alpine/render.ts*',route=>route.fulfill({
    contentType:'application/javascript',body:'export function createView(){return {draw(){},dispose(){},renderer:{info:{render:{calls:0,triangles:0}}}}}',
  }));
  await page.clock.install();
  await page.goto('/prototypes/alpine-drive/?lang=ja');
  await expect(page.locator('#ad-actions button')).toHaveText('ドライブ開始');
  await page.clock.pauseAt(new Date(Date.now()+1000));
});
async function start(page:Page){await page.getByRole('button',{name:'ドライブ開始',exact:true}).click();}
async function state(page:Page){return page.locator('#alpine').evaluate(e=>({...((e as HTMLElement).dataset)}));}
async function until(page:Page,predicate:(s:Awaited<ReturnType<typeof state>>)=>boolean){
  for(let i=0;i<160;i++){if(predicate(await state(page)))return;await page.clock.runFor(100);}
  throw new Error(`Timed out: ${JSON.stringify(await state(page))}`);
}
async function swipe(page:Page,direction:-1|1,cancel=false){
  const cdp=await page.context().newCDPSession(page);
  await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:195,y:520,id:1}]});
  await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:195+direction*75,y:524,id:1}]});
  await cdp.send('Input.dispatchTouchEvent',{type:cancel?'touchCancel':'touchEnd',touchPoints:[]});
  await cdp.detach();
}
async function clear(page:Page,mode:'touch'|'keyboard'){
  for(const [i,dir] of ([-1,1,1,-1] as const).entries()){
    await until(page,s=>s.gate===String(i)&&s.window==='true');
    if(mode==='touch')await swipe(page,dir);else await page.keyboard.press(dir===-1?'ArrowLeft':'ArrowRight');
    await expect(page.locator('#alpine')).toHaveAttribute('data-queued',String(dir));
    await until(page,s=>Number(s.gate)>i);
  }
  await until(page,s=>s.phase==='clear');
}
test('touch flicks clear the stage, save once, and retry resets every control',async({page})=>{
  const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
  await start(page);await swipe(page,-1);await expect(page.locator('#alpine')).toHaveAttribute('data-queued','null');
  await clear(page,'touch');
  await expect(page.locator('#ad-title')).toHaveText('ゴール！');
  await expect(page.locator('#ad-save')).toContainText('このコースの完走：1');
  await page.clock.runFor(1200);
  expect(await page.evaluate(()=>JSON.parse(localStorage.getItem('pocketey-alpine-campaign-v2')!).records['mountain-pass'].clears)).toBe(1);
  await page.getByRole('button',{name:'すぐリトライ'}).click();
  expect(await state(page)).toMatchObject({phase:'playing',gate:'0',queued:'null',heading:'0',z:'0.000'});
  expect(errors).toEqual([]);
});
test('keyboard clears; missing input fails and retry remains playable',async({page})=>{
  await start(page);await until(page,s=>s.phase==='failed');
  await expect(page.locator('#alpine')).toHaveAttribute('data-reason','block');
  await page.getByRole('button',{name:'すぐリトライ'}).click();await clear(page,'keyboard');
});
test('cancelled gesture, pause, and audio dialog cannot leak a queued turn',async({page})=>{
  await start(page);await until(page,s=>s.window==='true');
  await swipe(page,-1,true);await expect(page.locator('#alpine')).toHaveAttribute('data-queued','null');
  await page.getByRole('button',{name:'左旋回を予約'}).click();
  await page.keyboard.press('Escape');const z=(await state(page)).z;await page.clock.runFor(2000);
  expect((await state(page)).z).toBe(z);expect((await state(page)).queued).toBe('null');
  await page.locator('#ad-actions button').first().click();await swipe(page,-1);
  await page.getByRole('button',{name:'音量設定',exact:true}).click();await expect(page.locator('dialog')).toBeVisible();
  await page.keyboard.press('ArrowRight');await page.clock.runFor(500);expect((await state(page)).queued).toBe('null');
  await page.getByRole('button',{name:'閉じる',exact:true}).click();await expect(page.locator('#alpine')).toHaveAttribute('data-phase','paused');
  await page.locator('#ad-actions button').first().click();await swipe(page,-1);
  await expect(page.locator('#alpine')).toHaveAttribute('data-queued','-1');
});
test('wrong direction fails; language and own audio settings persist without altering other games',async({page})=>{
  await page.evaluate(()=>{localStorage.setItem('pocketey-tilttrail-v1','{"best":[1,2,3]}');localStorage.setItem('pocketey-audio-v1','{"tilt":{"music":0.2,"sfx":0.3}}');});
  await page.getByRole('button',{name:'English',exact:true}).click();
  await expect(page.locator('#ad-actions button')).toHaveText('Start driving');
  await page.getByRole('button',{name:'Sound OFF',exact:true}).click();
  const stored=await page.evaluate(()=>({audio:JSON.parse(localStorage.getItem('pocketey-audio-v1')!),tilt:localStorage.getItem('pocketey-tilttrail-v1'),lang:localStorage.getItem('pocketey-language-v1')}));
  expect(stored.audio.tilt).toEqual({music:.2,sfx:.3});expect(stored.audio.alpine.musicMuted).toBe(false);
  expect(stored.tilt).toBe('{"best":[1,2,3]}');expect(stored.lang).toBe('en');
  await page.getByRole('button',{name:'Start driving',exact:true}).click();await until(page,s=>s.window==='true');
  await page.keyboard.press('ArrowRight');await until(page,s=>s.phase==='failed');
  await expect(page.locator('#alpine')).toHaveAttribute('data-reason','edge');
});
test('blocked storage and narrow layout leave instructions and controls usable',async({page})=>{
  await page.addInitScript(()=>{Storage.prototype.getItem=()=>{throw new Error('disabled');};Storage.prototype.setItem=()=>{throw new Error('disabled');};});
  await page.setViewportSize({width:320,height:568});await page.goto('/prototypes/alpine-drive/?lang=ja');
  await expect(page.locator('#ad-save')).toContainText('保存不可');
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  await page.locator('#ad-actions button').scrollIntoViewIfNeeded();await expect(page.locator('#ad-actions button')).toBeInViewport();
  await start(page);await page.keyboard.press('Escape');await expect(page.locator('#alpine')).toHaveAttribute('data-phase','paused');
});
test('context loss freezes play and offers reload instead of a dead start button',async({page})=>{
  await start(page);await page.locator('canvas').dispatchEvent('webglcontextlost');
  await expect(page.locator('#ad-title')).toHaveText('3D表示を開始できません');
  await expect(page.getByRole('button',{name:'再読み込み',exact:true})).toBeVisible();
  await page.clock.runFor(1000);await expect(page.locator('#alpine')).toHaveAttribute('data-phase','paused');
});
