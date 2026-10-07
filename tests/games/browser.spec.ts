import {test,expect,type Page} from '@playwright/test';
import { stages, SAVE_KEY, type Kind } from '../../src/games/model';
import fs from 'node:fs';
import {read,play} from './input';
test('licensed UI artwork loads and existing progress survives the visual refresh',async({page,request})=>{
 await page.emulateMedia({reducedMotion:'reduce'});
 await page.addInitScript(k=>localStorage.setItem(k,JSON.stringify({version:1,sound:true,orbit:{unlocked:3,best:[13,16,18]},amber:{unlocked:2,best:[10,null,null]}})),SAVE_KEY);
 await page.goto('/games/orbit-ribbon/');
 await expect(page.getByRole('button',{name:/ステージ 3 /})).toBeEnabled();
 await expect(page.locator('#sound')).toHaveText('音 ON');
 await expect(page.locator('#save-note')).toContainText('旧コースBEST 13.00秒');
 for(const name of ['orbit','gem','trophy','flag','lock-keyhole','check','arrow-left','arrow-right','arrow-up-right','play','rotate-ccw','sparkles','footprints']){
  const response=await request.get(`/games/assets/lucide/${name}.svg`);expect(response.status()).toBe(200);expect(await response.text()).toContain('<svg');
 }
 const license=await request.get('/games/assets/lucide/LICENSE.txt');expect(await license.text()).toContain('ISC License');expect(await license.text()).toContain('The MIT License');
 await expect(page.locator('.hero-mark .asset-icon')).toBeVisible();
 await page.getByRole('button',{name:'ステージ 1 をはじめる'}).click();
 const animationObservation=page.evaluate(async()=>{let active=false;const start=performance.now();await new Promise<void>(resolve=>{function observe(){active ||= document.querySelector('#landing-cue')!.getAnimations().length>0;if(performance.now()-start<1400)requestAnimationFrame(observe);else resolve();}requestAnimationFrame(observe);});return active;});
 await page.keyboard.press('Space');await expect(page.locator('#game')).toHaveAttribute('data-grounded','false');await expect(page.locator('#game')).toHaveAttribute('data-grounded','true');
 expect(await animationObservation).toBe(false);
 await page.locator('#pause').click();await page.getByRole('button',{name:'ステージ選択'}).click();
 await expect(page.getByRole('button',{name:/ステージ 3 /})).toBeEnabled();
 const save=await page.evaluate(k=>JSON.parse(localStorage.getItem(k)!),SAVE_KEY);expect(save.orbit.best).toEqual([13,16,18]);
 await page.getByRole('button',{name:'ステージ 1 をはじめる'}).click();await play(page,'orbit',0,true);
 const updated=await page.evaluate(k=>JSON.parse(localStorage.getItem(k)!),SAVE_KEY);
 expect(updated.orbit.best).toEqual([13,16,18]);expect(updated.orbit.challengeBest[0]).toBeGreaterThan(13);
 expect(updated.orbit.challengeBest.slice(1)).toEqual([null,null]);
});
for(const kind of ['orbit','amber'] as const)for(const touch of [false,true])test.describe(`${kind}-${touch?'touch':'keyboard'}`,()=>{
 test.use({isMobile:touch,hasTouch:touch,viewport:touch?{width:390,height:844}:{width:1280,height:720}});
 test('three stages through normal input, unlock and persistence',async({page,browser},info)=>{
 const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
 const inputTrace:unknown[]=[];
 await page.goto(`/games/${kind==='orbit'?'orbit-ribbon':'amber-step'}/`);await expect(page.locator('#game')).toHaveAttribute('data-mode','menu');
 await expect(page.getByRole('button',{name:/ステージ 2 /})).toBeDisabled();
 for(let i=0;i<3;i++){
  if(i===0)await page.getByRole('button',{name:'ステージ 1 をはじめる'}).click();else await page.getByRole('button',{name:'次のステージ'}).click();
  // Wait for the first new-run frame, not a blocking screenshot, before driving.
  await expect(page.locator('#game')).toHaveAttribute('data-mode','play');
  await expect(page.locator('#game')).toHaveAttribute('data-status','running');
  const measurement = i===2 ? page.evaluate(async()=>{const samples:number[]=[];let last=performance.now();await new Promise<void>(resolve=>{function sample(now:number){samples.push(now-last);last=now;if(samples.length<200)requestAnimationFrame(sample);else resolve();}requestAnimationFrame(sample);});const sorted=samples.slice(10).sort((a,b)=>a-b);return{fps:1000/(sorted.reduce((a,b)=>a+b)/sorted.length),p95:sorted[Math.floor(sorted.length*.95)],p99:sorted[Math.floor(sorted.length*.99)],max:Math.max(...sorted),rawIntervals:samples,startedAt:performance.timeOrigin+performance.now()-samples.reduce((a,b)=>a+b)};}) : null;
  await play(page,kind,i,touch,inputTrace);
  fs.writeFileSync(info.outputPath('input-timing.json'),JSON.stringify(inputTrace));
  if(measurement) fs.writeFileSync(info.outputPath('environment.json'),JSON.stringify({browser:browser.version(),contexts:browser.contexts().length,pages:page.context().pages().length,...await page.evaluate(()=>{const canvas=document.querySelector('canvas')!,gl=canvas.getContext('webgl2')!,ext=gl.getExtension('WEBGL_debug_renderer_info');return{viewport:[innerWidth,innerHeight],dpr:devicePixelRatio,canvas:[canvas.width,canvas.height],renderer:ext?gl.getParameter(ext.UNMASKED_RENDERER_WEBGL):gl.getParameter(gl.RENDERER)};})},null,2));
  if(measurement){const performance=await measurement;fs.writeFileSync(info.outputPath('stage3-performance.json'),JSON.stringify(performance,null,2));console.log(kind,touch?'touch':'keyboard',{fps:performance.fps,p95:performance.p95,p99:performance.p99,max:performance.max});expect(performance.fps).toBeGreaterThanOrEqual(45);expect(performance.p95).toBeLessThanOrEqual(40);}
  await page.locator('.hero-mark').evaluate(async e=>{await Promise.all(e.getAnimations().map(a=>a.finished));});
  await page.screenshot({path:info.outputPath(`${kind}-${i+1}-clear.png`)});
 }
 await page.getByRole('button',{name:'ステージ選択'}).click();await expect(page.locator('#stages').getByRole('button',{name:/ステージ 3 /})).toBeEnabled();
 await page.locator('#sound').click();await page.reload();await expect(page.locator('#sound')).toHaveText('音 ON');await expect(page.locator('#stages').getByRole('button',{name:/ステージ 3 /})).toBeEnabled();
 const stored=await page.evaluate(k=>JSON.parse(localStorage.getItem(k)!),SAVE_KEY);expect(stored[kind].challengeBest.every((x:number)=>x>0)).toBeTruthy();
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
 await page.goto('/');await page.locator('.site-header').getByRole('link',{name:'ゲーム',exact:true}).click();await expect(page).toHaveURL(/\/games\//);await page.locator('.amber .play-link').click();await page.getByRole('button',{name:'ステージ 1 をはじめる'}).click();
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
 // Assert before any scrolling or Playwright auto-scroll can hide an initial-layout regression.
 const initial=await page.getByRole('button',{name:'ステージ 1 をはじめる'}).evaluate(e=>{const a=e.getBoundingClientRect(),o=document.querySelector('#overlay')!,b=o.getBoundingClientRect();return{button:{x:a.x,y:a.y,width:a.width,height:a.height,bottom:a.bottom},overlay:{top:b.top,bottom:b.bottom},scrollTop:o.scrollTop,visible:a.top>=b.top&&a.bottom<=b.bottom&&a.left>=b.left&&a.right<=b.right};});
 expect(initial.scrollTop).toBe(0);expect(initial.visible).toBe(true);expect(initial.button.height).toBeGreaterThanOrEqual(44);
 fs.writeFileSync(info.outputPath(`${kind}-320-initial-action-bounds.json`),JSON.stringify(initial,null,2));
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

for(const kind of ['orbit','amber'] as const)test(`${kind}: simulated notch safe areas keep all controls inside every edge`,async({page},info)=>{
 const session=await page.context().newCDPSession(page);
 const measurements:unknown[]=[];
 async function insideSafeArea(insets:{top:number;bottom:number;left:number;right:number}){
  const viewport=page.viewportSize()!;
  const items=page.locator('.game-bar button, .wordmark, [data-input], .hud, #hint');
  for(let i=0;i<await items.count();i++){
   const item=items.nth(i),box=(await item.boundingBox())!;
   const label=await item.getAttribute('aria-label')??await item.textContent();
   expect(box.x,`${label}: left`).toBeGreaterThanOrEqual(insets.left);
   expect(box.y,`${label}: top`).toBeGreaterThanOrEqual(insets.top);
   expect(box.x+box.width,`${label}: right`).toBeLessThanOrEqual(viewport.width-insets.right);
   expect(box.y+box.height,`${label}: bottom`).toBeLessThanOrEqual(viewport.height-insets.bottom);
   measurements.push({viewport,insets,label,box});
  }
 }
 const portrait={top:44,bottom:34,left:0,right:0};
 await session.send('Emulation.setSafeAreaInsetsOverride',{insets:portrait});
 await page.goto(`/games/${kind==='orbit'?'orbit-ribbon':'amber-step'}/`);
 expect(await page.locator('.game-bar').evaluate(e=>parseFloat(getComputedStyle(e).paddingTop))).toBe(54);
 await insideSafeArea(portrait);
 await page.screenshot({path:info.outputPath(`${kind}-notch-portrait-menu.png`)});
 await page.getByRole('button',{name:'ステージ 1 をはじめる'}).click();
 await page.locator('#pause').click();
 await page.setViewportSize({width:844,height:390});
 const landscape={top:0,bottom:21,left:44,right:44};
 await session.send('Emulation.setSafeAreaInsetsOverride',{insets:landscape});
 await page.getByRole('button',{name:'つづける'}).click();
 await insideSafeArea(landscape);
 expect(await page.locator('.controls').evaluate(e=>parseFloat(getComputedStyle(e).paddingBottom))).toBe(21);
 await page.screenshot({path:info.outputPath(`${kind}-notch-landscape-play.png`)});
 fs.writeFileSync(info.outputPath(`${kind}-safe-area-bounds.json`),JSON.stringify(measurements,null,2));
});


test('Amber simultaneous touch shows legible held feedback',async({page},info)=>{
 await page.goto('/games/amber-step/');await page.getByRole('button',{name:'ステージ 1 をはじめる'}).click();
 await expect(page.locator('#game')).toHaveAttribute('data-mode','play');
 const session=await page.context().newCDPSession(page),points=[];
 for(const [i,name] of ['right','jump'].entries()){const b=(await page.locator(`[data-input=${name}]`).boundingBox())!;points.push({x:b.x+b.width/2,y:b.y+b.height/2,id:i+1});}
 await session.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:points});
 const styles=[];
 for(const name of ['right','jump']){const control=page.locator(`[data-input=${name}]`);await expect(control).toHaveClass(/held/);await expect(control).toHaveCSS('background-color','rgb(255, 211, 147)');await expect(control).toHaveCSS('background-image','none');await expect(control).toHaveCSS('color','rgb(21, 39, 46)');styles.push(await control.evaluate(e=>{const s=getComputedStyle(e);return{input:(e as HTMLElement).dataset.input,color:s.color,background:s.backgroundColor,image:s.backgroundImage};}));}
 await page.screenshot({path:info.outputPath('amber-simultaneous-held.png')});fs.writeFileSync(info.outputPath('amber-held-styles.json'),JSON.stringify(styles,null,2));
 await session.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:points});await expect(page.locator('.controls .held')).toHaveCount(0);await session.detach();
});

for (const kind of ['orbit','amber'] as const) {
 const route = `/games/${kind === 'orbit' ? 'orbit-ribbon' : 'amber-step'}/`;
 test(`${kind}: selected 3D art loads, animation and normal controls remain usable`,async({page},info)=>{
  const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
  page.on('console',message=>{if(message.type()==='error' && /Shader Error|shader is not compiled/i.test(message.text()))errors.push(message.text());});
  if(kind==='amber') await page.addInitScript(()=>{
   // The inspected Oodi rig has six joints. Capture changing GPU-bound
   // matrices so clip-label transitions alone cannot hide a frozen pose.
   const snapshots:number[][]=[];
   (window as unknown as {artBoneTrace:typeof snapshots}).artBoneTrace=snapshots;
   const original=WebGL2RenderingContext.prototype.uniformMatrix4fv;
   WebGL2RenderingContext.prototype.uniformMatrix4fv=function(...args){
    const values=Array.from(args[2]);const last=snapshots.at(-1);
    if(values.length===96 && snapshots.length<100 && (!last || values.some((v,i)=>Math.abs(v-last[i])>1e-4)))snapshots.push(values);
    return original.apply(this,args);
   };
  });
  await page.goto(route);await expect(page.locator('canvas')).toHaveAttribute('data-art','ready');
  await expect(page.locator('canvas')).toHaveAttribute('data-art-adopted','true');
  if(kind==='amber') await page.evaluate(()=>{
   const clips: {name:string;y:string|undefined;grounded:string|undefined}[]=[];
   (window as unknown as {artClipTrace:typeof clips}).artClipTrace=clips;
   new MutationObserver(()=>{
    const scene=document.querySelector<HTMLCanvasElement>('canvas')!, game=document.querySelector<HTMLElement>('#game')!;
    clips.push({name:scene.dataset.artAnimation!,y:game.dataset.y,grounded:game.dataset.grounded});
   }).observe(document.querySelector('canvas')!,{attributes:true,attributeFilter:['data-art-animation']});
  });
  await page.getByRole('button',{name:'ステージ 1 をはじめる'}).click();
  if(kind==='amber')await page.keyboard.down('ArrowRight');
  await page.waitForTimeout(150);await page.keyboard.press('Space');
  await expect.poll(async()=>Number((await read(page)).y)).toBeGreaterThan(.8);
  // Observe the transition before a screenshot can wait through the entire jump.
  // Release movement here so a slow screenshot cannot carry Oodi into a gap.
  if(kind==='amber'){
   await expect.poll(()=>page.evaluate(()=>(window as unknown as {artClipTrace:{name:string;grounded:string}[]}).artClipTrace.some(c=>c.name==='jump'&&c.grounded==='false'))).toBe(true);
   await page.keyboard.up('ArrowRight');
  }
  await page.screenshot({path:info.outputPath(`${kind}-art-jump.png`)});
  if(kind==='amber'){
   await expect(page.locator('#game')).toHaveAttribute('data-grounded','true');
   await expect(page.locator('canvas')).toHaveAttribute('data-art-animation','idle');
   await page.keyboard.down('ArrowRight');await expect(page.locator('canvas')).toHaveAttribute('data-art-animation','walk');await page.keyboard.up('ArrowRight');
   const trace=await page.evaluate(()=>(window as unknown as {artClipTrace:{name:string;grounded:string}[]}).artClipTrace);
   expect(trace.some(c=>c.name==='fall'&&c.grounded==='false')).toBe(true);
   expect(trace.some(c=>c.name==='idle'&&c.grounded==='true')).toBe(true);
   expect(trace.some(c=>c.name==='walk'&&c.grounded==='true')).toBe(true);
   fs.writeFileSync(info.outputPath('amber-animation-transitions.json'),JSON.stringify(trace,null,2));
   const poses=await page.evaluate(()=>(window as unknown as {artBoneTrace:number[][]}).artBoneTrace);
   expect(poses.length).toBeGreaterThan(2);
   expect(poses.some(p=>p.some((v,i)=>i%16<12 && Math.abs(v-poses[0][i])>1e-3))).toBe(true);
   fs.writeFileSync(info.outputPath('amber-bone-matrix-uploads.json'),JSON.stringify(poses));
  }
  await page.locator('#pause').click();
  const frozen=await read(page);await page.waitForTimeout(200);expect((await read(page)).x).toBe(frozen.x);
  expect(errors).toEqual([]);
 });
 test(`${kind}: failed GLBs retain fallback, controls, clear and saves`,async({page},info)=>{
  await page.route('**/kenney/**/*.glb',route=>route.abort('failed'));
  const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto(route);await expect(page.locator('canvas')).toHaveAttribute('data-art','fallback');
  await page.getByRole('button',{name:'ステージ 1 をはじめる'}).click();
  await play(page,kind,0,true);await page.screenshot({path:info.outputPath(`${kind}-fallback-clear.png`)});
  const saved=await page.evaluate(k=>localStorage.getItem(k),SAVE_KEY);expect(saved).toBeTruthy();
  await page.reload();await expect(page.getByRole('button',{name:/ステージ 2 /})).toBeEnabled();
  expect(await page.evaluate(k=>localStorage.getItem(k),SAVE_KEY)).toBe(saved);expect(errors).toEqual([]);
 });
}
test('missing shared colormap retains Amber fallback and gameplay',async({page})=>{
 await page.route('**/kenney/**/colormap.png',route=>route.abort('failed'));
 await page.goto('/games/amber-step/');await expect(page.locator('canvas')).toHaveAttribute('data-art','fallback');
 await page.getByRole('button',{name:'ステージ 1 をはじめる'}).click();await play(page,'amber',0,true);
});
