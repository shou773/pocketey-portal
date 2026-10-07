import {test,expect,type Page} from '@playwright/test';
import { stages, SAVE_KEY, type Kind } from '../../src/games/model';
import fs from 'node:fs';
const read = (page:Page) => page.locator('#game').evaluate(e=>({... (e as HTMLElement).dataset}));
async function play(page:Page,kind:Kind,index:number,touch=false){
 const level=stages[kind][index];const down=new Set<string>();let lastJump=-10;const started=Date.now();
 const session=touch?await page.context().newCDPSession(page):null;
 const points:Record<string,{x:number;y:number;id:number}>={};
 for(const [i,name] of ['left','right','jump'].entries()){const b=await page.locator(`[data-input=${name}]`).boundingBox();points[name]={x:b!.x+b!.width/2,y:b!.y+b!.height/2,id:i+1};}
 async function input(names:string[]){
  if(session){
   const added=names.filter(n=>!down.has(n)),removed=[...down].filter(n=>!names.includes(n));
   if(removed.length)await session.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:removed.map(n=>points[n])});
   if(added.length)await session.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:names.map(n=>points[n])});
   down.clear();names.forEach(n=>down.add(n));
  }
  else {for(const key of [...down])if(!names.includes(key)){await page.keyboard.up(key);down.delete(key);}for(const key of names)if(!down.has(key)){await page.keyboard.down(key);down.add(key);}}
 }
 while(Date.now()-started<50000){
  const d=await read(page);if(d.status!=='running')break;
  const x=Number(d.x),z=Number(d.z),t=x/(kind==='orbit'?7:5);const tile=level.platforms.find(p=>x>=p.a-.23&&x<=p.b+.23);
  const gap=!!tile&&tile.b<level.length&&tile.b-x<(kind==='orbit'?1.6:1.05)&&tile.b-x>-.15;
  const spike=kind==='amber'&&level.hazards.some(h=>h.x-x<1.7&&h.x-x>0);
  let axis=1;if(kind==='orbit'){const h=level.hazards.find(h=>h.x>x-1);const target=h&&h.x-x<10?(h.z>=0?-2.4:2.4):0;axis=Math.abs(target-z)<.18?0:Math.sign(target-z);}
  const jump=(gap||spike)&&d.grounded==='true'&&t-lastJump>.3;if(jump)lastJump=t;
  const names:string[]=[];if(axis)names.push(touch?(axis>0?'right':'left'):(axis>0?'ArrowRight':'ArrowLeft'));if(jump)names.push(touch?'jump':'Space');await input(names);await page.waitForTimeout(25);
 }
 await input([]);await session?.detach();expect((await read(page)).status,`${kind}/${index+1} ${JSON.stringify(await read(page))}`).toBe('clear');
}
for(const kind of ['orbit','amber'] as const)for(const touch of [false,true])test.describe(`${kind}-${touch?'touch':'keyboard'}`,()=>{
 test.use({isMobile:touch,hasTouch:touch,viewport:touch?{width:390,height:844}:{width:1280,height:720}});
 test('three stages through normal input, unlock and persistence',async({page},info)=>{
 const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto(`/games/${kind==='orbit'?'orbit-ribbon':'amber-step'}/`);await expect(page.locator('#game')).toHaveAttribute('data-mode','menu');
 await expect(page.getByRole('button',{name:/ステージ 2 /})).toBeDisabled();
 for(let i=0;i<3;i++){
  if(i===0)await page.getByRole('button',{name:'ステージ 1 をはじめる'}).click();else await page.getByRole('button',{name:'次のステージ'}).click();
  // Wait for the first new-run frame, not a blocking screenshot, before driving.
  await expect(page.locator('#game')).toHaveAttribute('data-mode','play');
  await expect(page.locator('#game')).toHaveAttribute('data-status','running');
  const measurement = i===2 ? page.evaluate(async()=>{const samples:number[]=[];let last=performance.now();await new Promise<void>(resolve=>{function sample(now:number){samples.push(now-last);last=now;if(samples.length<200)requestAnimationFrame(sample);else resolve();}requestAnimationFrame(sample);});const sorted=samples.slice(10).sort((a,b)=>a-b);return{fps:1000/(sorted.reduce((a,b)=>a+b)/sorted.length),p95:sorted[Math.floor(sorted.length*.95)]};}) : null;
  await play(page,kind,i,touch);
  if(measurement){const performance=await measurement;fs.writeFileSync(info.outputPath('stage3-performance.json'),JSON.stringify(performance,null,2));console.log(kind,touch?'touch':'keyboard',performance);expect(performance.fps).toBeGreaterThanOrEqual(45);expect(performance.p95).toBeLessThanOrEqual(40);}
  await page.screenshot({path:info.outputPath(`${kind}-${i+1}-clear.png`)});
 }
 await page.getByRole('button',{name:'ステージ選択'}).click();await expect(page.locator('#stages').getByRole('button',{name:/ステージ 3 /})).toBeEnabled();
 await page.locator('#sound').click();await page.reload();await expect(page.locator('#sound')).toHaveText('音 ON');await expect(page.locator('#stages').getByRole('button',{name:/ステージ 3 /})).toBeEnabled();
 const stored=await page.evaluate(k=>JSON.parse(localStorage.getItem(k)!),SAVE_KEY);expect(stored[kind].best.every((x:number)=>x>0)).toBeTruthy();
 const reopened=await page.context().newPage();await reopened.goto(page.url());await expect(reopened.locator('#stages').getByRole('button',{name:/ステージ 3 /})).toBeEnabled();await reopened.close();expect(errors).toEqual([]);
 await page.locator('#stages').getByRole('button',{name:/ステージ 3 /}).click();await page.getByRole('button',{name:'ステージ 3 をはじめる'}).click();await expect(page.locator('#game')).toHaveAttribute('data-mode','play');
});});
test('failure/retry, pause/focus clears held input, restart cycles, orientation',async({page},info)=>{
 await page.goto('/games/orbit-ribbon/');await page.getByRole('button',{name:'ステージ 1 をはじめる'}).click();
 await expect(page.locator('#game')).toHaveAttribute('data-status','dead',{timeout:10000});await page.getByRole('button',{name:'すぐにリトライ'}).click();await expect.poll(async()=>Number((await read(page)).x)).toBeLessThan(2);
 await page.keyboard.down('ArrowRight');await page.waitForTimeout(100);await page.keyboard.press('Escape');await page.keyboard.up('ArrowRight');const before=await read(page);await page.waitForTimeout(250);expect((await read(page)).x).toBe(before.x);
 await page.getByRole('button',{name:'つづける'}).click();const z=(await read(page)).z;await page.waitForTimeout(200);expect((await read(page)).z).toBe(z);
 await page.keyboard.down('ArrowLeft');await page.evaluate(()=>window.dispatchEvent(new Event('blur')));await page.keyboard.up('ArrowLeft');await expect(page.locator('#game')).toHaveAttribute('data-mode','pause');await page.getByRole('button',{name:'つづける'}).click();const z2=(await read(page)).z;await page.waitForTimeout(150);expect((await read(page)).z).toBe(z2);
 const geometries=(await read(page)).geometries;
 for(let i=0;i<20;i++){await page.keyboard.press('KeyR');await page.waitForTimeout(20);}await page.keyboard.press('KeyR');await page.waitForTimeout(1000);const x=Number((await read(page)).x);expect(x).toBeGreaterThan(5.5);expect(x).toBeLessThan(9.5);expect((await read(page)).geometries).toBe(geometries);
 await page.locator('#pause').click();await page.setViewportSize({width:844,height:390});await page.screenshot({path:info.outputPath('landscape-pause.png')});await expect(page.getByRole('button',{name:'つづける'})).toBeInViewport();await page.getByRole('button',{name:'つづける'}).click();await expect(page.locator('[data-input=jump]')).toBeInViewport();await page.screenshot({path:info.outputPath('landscape-play.png')});
});
test('corrupt/blocked storage and scoped confirmed reset',async({page})=>{
 await page.addInitScript(k=>{localStorage.setItem(k,'{bad');localStorage.setItem('unrelated-progress','keep');},SAVE_KEY);
 await page.goto('/games/amber-step/');await expect(page.getByRole('button',{name:'ステージ 1 をはじめる'})).toBeVisible();
 await page.locator('#reset').click();await page.getByRole('button',{name:'キャンセル'}).click();expect(await page.evaluate(()=>localStorage.getItem('unrelated-progress'))).toBe('keep');
 await page.locator('#reset').click();await page.getByRole('button',{name:'この2作品をリセット',exact:true}).click();expect(await page.evaluate(()=>localStorage.getItem('unrelated-progress'))).toBe('keep');expect(await page.evaluate(k=>JSON.parse(localStorage.getItem(k)!).orbit.unlocked,SAVE_KEY)).toBe(1);
 const blocked=await page.context().newPage();await blocked.addInitScript(()=>{Object.defineProperty(window,'localStorage',{get(){throw new Error('blocked');}});});await blocked.goto('/games/amber-step/');await blocked.locator('#sound').click();await expect(blocked.locator('#save-note')).toContainText('保存を利用できません');await blocked.getByRole('button',{name:'ステージ 1 をはじめる'}).click();await expect(blocked.locator('#game')).toHaveAttribute('data-mode','play');await blocked.close();
});
test('touch simultaneous move+jump, touch cancel, layout, renderer performance and site navigation',async({page,browser},info)=>{
 await page.goto('/');await page.getByRole('link',{name:'Games ↗',exact:true}).click();await expect(page).toHaveURL(/\/games\//);await page.getByRole('link',{name:/02 \/ MOVE & JUMP/}).click();await page.getByRole('button',{name:'ステージ 1 をはじめる'}).click();
 const session=await page.context().newCDPSession(page);const right=await page.locator('[data-input=right]').boundingBox(),jump=await page.locator('[data-input=jump]').boundingBox();
 await session.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:right!.x+20,y:right!.y+20,id:1},{x:jump!.x+20,y:jump!.y+20,id:2}]});await page.waitForTimeout(200);const s=await read(page);expect(Number(s.x)).toBeGreaterThan(.5);expect(Number(s.y)).toBeGreaterThan(.5);
 await session.send('Input.dispatchTouchEvent',{type:'touchCancel',touchPoints:[]});const x=(await read(page)).x;await page.waitForTimeout(100);expect((await read(page)).x).toBe(x);
 await page.screenshot({path:info.outputPath('amber-touch.png')});
 const perf=await page.evaluate(async()=>{const samples:number[]=[];let last=performance.now();await new Promise<void>(resolve=>{function frame(now:number){samples.push(now-last);last=now;if(samples.length<300)requestAnimationFrame(frame);else resolve();}requestAnimationFrame(frame);});const sorted=samples.slice(10).sort((a,b)=>a-b);const canvas=document.querySelector('canvas')!;const gl=canvas.getContext('webgl2')!;const extension=gl.getExtension('WEBGL_debug_renderer_info');return{fps:1000/(sorted.reduce((a,b)=>a+b)/sorted.length),p95:sorted[Math.floor(sorted.length*.95)],renderer:extension?gl.getParameter(extension.UNMASKED_RENDERER_WEBGL):gl.getParameter(gl.RENDERER),viewport:[innerWidth,innerHeight],userAgent:navigator.userAgent};});
 fs.writeFileSync(info.outputPath('performance.json'),JSON.stringify({browser:browser.version(),...perf},null,2));console.log('PERFORMANCE',perf);expect(perf.fps).toBeGreaterThanOrEqual(45);expect(perf.p95).toBeLessThanOrEqual(40);
 for(const size of [{width:320,height:568},{width:844,height:390},{width:1440,height:900}]){await page.setViewportSize(size);await expect(page.locator('[data-input=jump]')).toBeInViewport();expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);await page.screenshot({path:info.outputPath(`layout-${size.width}.png`)});}
});

for(const kind of ['orbit','amber'] as const)test(`${kind}: WebGL context loss freezes play until reload and preserves saved data`,async({page},info)=>{
 await page.goto(`/games/${kind==='orbit'?'orbit-ribbon':'amber-step'}/`);
 await page.locator('#sound').click();
 await page.getByRole('button',{name:'ステージ 1 をはじめる'}).click();
 await play(page,kind,0,true);
 const saved=await page.evaluate(k=>localStorage.getItem(k),SAVE_KEY);
 await page.getByRole('button',{name:'次のステージ'}).click();
 await page.keyboard.down('ArrowRight');
 await page.waitForTimeout(150);
 const supported=await page.evaluate(()=>{
  const gl=document.querySelector('canvas')!.getContext('webgl2')!;
  const loss=gl.getExtension('WEBGL_lose_context');
  if(!loss)return false;
  (window as unknown as {restoreTestContext:()=>void}).restoreTestContext=()=>loss.restoreContext();
  loss.loseContext();return true;
 });
 expect(supported).toBe(true);
 await expect(page.locator('#game')).toHaveAttribute('data-mode','recovery');
 await page.keyboard.up('ArrowRight');
 const frozen=await read(page), time=await page.locator('#timer').textContent();
 await expect(page.locator('#pause')).toBeDisabled();
 await expect(page.locator('#sound')).toBeDisabled();
 await expect(page.locator('[data-input=jump]')).toBeDisabled();
 await expect(page.getByRole('button',{name:'つづける',exact:true})).toHaveCount(0);
 await expect(page.getByRole('button',{name:'やり直す',exact:true})).toHaveCount(0);
 await page.keyboard.press('Escape');await page.keyboard.press('KeyR');await page.keyboard.press('Space');
 await page.evaluate(()=>window.dispatchEvent(new Event('blur')));
 await page.waitForTimeout(300);
 expect((await read(page)).x).toBe(frozen.x);expect((await read(page)).y).toBe(frozen.y);
 expect(await page.locator('#timer').textContent()).toBe(time);
 expect(await page.evaluate(k=>localStorage.getItem(k),SAVE_KEY)).toBe(saved);
 await page.screenshot({path:info.outputPath(`${kind}-context-loss.png`)});
 // Even an actual restoration must not silently restart the interrupted simulation.
 await page.evaluate(()=>(window as unknown as {restoreTestContext:()=>void}).restoreTestContext());
 await expect.poll(()=>page.evaluate(()=>document.querySelector('canvas')!.getContext('webgl2')!.isContextLost())).toBe(false);
 await expect(page.locator('#game')).toHaveAttribute('data-mode','recovery');
 expect((await read(page)).x).toBe(frozen.x);
 await page.getByRole('button',{name:'再読み込み',exact:true}).click();
 await expect(page.locator('#game')).toHaveAttribute('data-mode','menu');
 await expect(page.locator('#sound')).toHaveText('音 ON');
 expect(await page.evaluate(k=>localStorage.getItem(k),SAVE_KEY)).toBe(saved);
 await page.getByRole('button',{name:'ステージ 1 をはじめる'}).click();
 await expect(page.locator('#game')).toHaveAttribute('data-mode','play');
});

for(const kind of ['orbit','amber'] as const)test(`${kind}: 320x568 menus and clear screen remain scroll-accessible`,async({page},info)=>{
 await page.setViewportSize({width:320,height:568});
 await page.goto(`/games/${kind==='orbit'?'orbit-ribbon':'amber-step'}/`);
 async function accessiblePanel(name:string){
  await page.locator('#overlay').evaluate(e=>{e.scrollTop=0;});
  const top=await page.locator('#overlay').evaluate(e=>{const panel=e.querySelector('.panel')!;return{overlay:e.getBoundingClientRect().top,panel:panel.getBoundingClientRect().top};});
  expect(top.panel).toBeGreaterThanOrEqual(top.overlay);
  await expect(page.locator('#panel-title')).toBeInViewport();
  await page.screenshot({path:info.outputPath(`${kind}-320-${name}-top.png`)});
  const controls=page.locator('#overlay button:visible, #overlay a:visible');
  for(let i=0;i<await controls.count();i++){
   const item=controls.nth(i);await item.scrollIntoViewIfNeeded();
   const fits=await item.evaluate(e=>{const a=e.getBoundingClientRect(),b=document.querySelector('#overlay')!.getBoundingClientRect();return a.top>=b.top-1&&a.bottom<=b.bottom+1&&a.left>=b.left-1&&a.right<=b.right+1;});
   expect(fits,`${name} / ${await item.textContent()}`).toBe(true);
  }
  await page.screenshot({path:info.outputPath(`${kind}-320-${name}-bottom.png`)});
 }
 await accessiblePanel('start');
 await page.locator('#sound').click();await expect(page.locator('#sound')).toHaveText('音 ON');
 await page.locator('#reset').click();await accessiblePanel('reset-confirm');
 await page.getByRole('button',{name:'キャンセル'}).click();
 await page.getByRole('button',{name:'ステージ 1 をはじめる'}).click();
 await play(page,kind,0,true);await accessiblePanel('clear');
 await page.getByRole('button',{name:'ステージ選択'}).click();
 await page.locator('#stages').getByRole('button',{name:/ステージ 2 /}).click();
 await accessiblePanel('stage-select');
 await page.getByRole('button',{name:'ステージ 2 をはじめる'}).click();
 await expect(page.locator('#game')).toHaveAttribute('data-mode','play');
 await page.locator('#pause').click();await accessiblePanel('pause');
 await page.setViewportSize({width:390,height:844});await expect(page.locator('.control-note')).toBeHidden();
 await page.getByRole('button',{name:'つづける'}).click();
 await page.screenshot({path:info.outputPath(`${kind}-390-controls.png`)});
});

test('simulated notch safe areas keep toolbar and controls accessible',async({page},info)=>{
 const session=await page.context().newCDPSession(page);
 await session.send('Emulation.setSafeAreaInsetsOverride',{insets:{top:44,bottom:34,left:0,right:0}});
 await page.goto('/games/orbit-ribbon/');
 expect(await page.locator('.game-bar').evaluate(e=>parseFloat(getComputedStyle(e).paddingTop))).toBe(54);
 expect((await page.locator('#sound').boundingBox())!.y).toBeGreaterThanOrEqual(44);
 await page.screenshot({path:info.outputPath('notch-portrait-menu.png')});
 await page.getByRole('button',{name:'ステージ 1 をはじめる'}).click();
 const jump=await page.locator('[data-input=jump]').boundingBox();expect(jump!.y+jump!.height).toBeLessThanOrEqual(844-34);
 await page.locator('#pause').click();
 await page.setViewportSize({width:844,height:390});
 await session.send('Emulation.setSafeAreaInsetsOverride',{insets:{top:0,bottom:21,left:44,right:44}});
 expect((await page.locator('.wordmark').boundingBox())!.x).toBeGreaterThanOrEqual(44);
 await page.getByRole('button',{name:'つづける'}).click();
 const landscape=await page.locator('[data-input=jump]').boundingBox();expect(landscape!.x+landscape!.width).toBeLessThanOrEqual(800);
 await page.screenshot({path:info.outputPath('notch-landscape-play.png')});
});
