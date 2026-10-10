import { test, expect } from '@playwright/test';
import { mkdir,writeFile } from 'node:fs/promises';
import { SAVE_KEY } from '../../src/games/model';
import { SIGNAL_SAVE_KEY,SIGNAL_COURSE_IDS } from '../../src/games/signals';
import { driveSignals,evidence,readSignals } from './signal-driver';
const old={version:1,sound:false,orbit:{unlocked:1,best:[13,16,18],challengeBest:[14,17,21]},amber:{unlocked:2,best:[20,null,null],challengeBest:[25,null,null]}};
const url='/games/orbit-ribbon/?lang=en';
for(const touch of [false,true])test.describe(touch?'touch signal routes':'keyboard signal routes',()=>{
 test.use({hasTouch:touch,isMobile:touch,viewport:touch?{width:390,height:844}:{width:1280,height:800}});
 test('all courses clear with0/3 and3/3, clear-only records persist and existing time records survive',async({page})=>{
  test.setTimeout(300000);await mkdir(evidence,{recursive:true});const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
  await page.addInitScript(({key,value})=>{if(!localStorage.getItem(key))localStorage.setItem(key,JSON.stringify(value));},{key:SAVE_KEY,value:old});
  await page.goto(url);await expect(page.locator('#scene')).toHaveAttribute('data-art-adopted','true');
  await expect(page.locator('#instructions')).toContainText('optional');expect(await page.evaluate(key=>localStorage.getItem(key),SIGNAL_SAVE_KEY)).toBeNull();
  for(const collect of [false,true]){
   if(collect){await page.getByRole('button',{name:'Choose a stage',exact:true}).click();await page.locator('#stages button').nth(0).click();}
   await page.getByRole('button',{name:'Start stage 1',exact:true}).click();
   for(let index=0;index<3;index++){
    await driveSignals(page,index,collect,touch,`${touch?'touch':'keyboard'}-${collect?'all':'none'}`);
    const saved=await page.evaluate(key=>JSON.parse(localStorage.getItem(key)!),SIGNAL_SAVE_KEY);expect(saved.records[SIGNAL_COURSE_IDS[index]]).toBe(collect?3:0);
    await expect(page.locator('#panel-copy')).toContainText(`SIGNALS ${collect?3:0} / 3`);
    if(index<2)await page.getByRole('button',{name:'Next stage',exact:true}).click();
   }
  }
  const saved=await page.evaluate(key=>JSON.parse(localStorage.getItem(key)!),SAVE_KEY);
  expect(saved.orbit.best).toEqual(old.orbit.best);expect(saved.orbit.challengeBest).toEqual(old.orbit.challengeBest);expect(saved.orbit.unlocked).toBe(3);expect(saved.amber).toEqual(old.amber);
  const signals=await page.evaluate(key=>localStorage.getItem(key),SIGNAL_SAVE_KEY);await page.reload();await expect(page.locator('#stages')).toContainText('SIGNALS 3 / 3');expect(await page.evaluate(key=>localStorage.getItem(key),SIGNAL_SAVE_KEY)).toBe(signals);
  expect(errors).toEqual([]);await writeFile(`${evidence}/${touch?'touch':'keyboard'}-records.json`,JSON.stringify({saved,signals,errors},null,2));
  await page.locator('#reset').click();await page.getByRole('button',{name:'Reset these two games',exact:true}).click();const reset=await page.evaluate(key=>JSON.parse(localStorage.getItem(key)!),SIGNAL_SAVE_KEY);expect(Object.values(reset.records)).toEqual([null,null,null]);
 });
});
test('a pickup followed by failure or interrupted rendering never creates a record; retry starts empty',async({page})=>{
 await page.goto(url);await page.getByRole('button',{name:'Start stage 1',exact:true}).click();
 // The first signal has a safe right-hand approach. Inputs remain ordinary.
 await page.keyboard.down('ArrowRight');await expect.poll(async()=>Number((await readSignals(page)).z),{intervals:[20]}).toBeGreaterThan(2.6);await page.keyboard.up('ArrowRight');expect(Number((await readSignals(page)).z)).toBeLessThan(3.5);
 await expect(page.locator('#game')).toHaveAttribute('data-signals','1',{timeout:5000});
 await page.keyboard.down('ArrowRight');await expect(page.locator('#game')).toHaveAttribute('data-status','dead',{timeout:4000});await page.keyboard.up('ArrowRight');
 expect(await page.evaluate(key=>localStorage.getItem(key),SIGNAL_SAVE_KEY)).toBeNull();await expect(page.locator('#panel-copy')).toContainText('only count');
 await page.getByRole('button',{name:'Retry now',exact:true}).click();await expect(page.locator('#game')).toHaveAttribute('data-signals','0');
 await page.keyboard.down('ArrowRight');await expect.poll(async()=>Number((await readSignals(page)).z),{intervals:[20]}).toBeGreaterThan(2.6);await page.keyboard.up('ArrowRight');expect(Number((await readSignals(page)).z)).toBeLessThan(3.5);await expect(page.locator('#game')).toHaveAttribute('data-signals','1',{timeout:5000});
 await page.locator('#pause').click();const paused=await readSignals(page);await page.waitForTimeout(150);expect((await readSignals(page)).x).toBe(paused.x);await page.getByRole('button',{name:'Resume',exact:true}).click();
 await page.locator('#scene').evaluate(canvas=>{const gl=(canvas as HTMLCanvasElement).getContext('webgl2')!;gl.getExtension('WEBGL_lose_context')!.loseContext();});await expect(page.locator('#game')).toHaveAttribute('data-mode','recovery');
 expect(await page.evaluate(key=>localStorage.getItem(key),SIGNAL_SAVE_KEY)).toBeNull();
});
test('future signals survive explicit reset, and normal Amber never accesses the Orbit key',async({page})=>{
 await page.addInitScript(key=>localStorage.setItem(key,'{"version":2,"future":"keep"}'),SIGNAL_SAVE_KEY);await page.goto(url);await expect(page.locator('#save-note')).toContainText('Signal records cannot be saved');
 await page.locator('#reset').click();await page.getByRole('button',{name:'Reset these two games',exact:true}).click();expect(await page.evaluate(key=>localStorage.getItem(key),SIGNAL_SAVE_KEY)).toBe('{"version":2,"future":"keep"}');
 const amber=await page.context().newPage();await amber.addInitScript(key=>{const get=Storage.prototype.getItem,set=Storage.prototype.setItem;Reflect.set(window,'__signalAccesses',[]);Storage.prototype.getItem=function(k){if(k===key){Reflect.get(window,'__signalAccesses').push('read');throw new Error('Amber read Orbit signals');}return get.call(this,k);};Storage.prototype.setItem=function(k,v){if(k===key){Reflect.get(window,'__signalAccesses').push('write');throw new Error('Amber wrote Orbit signals');}return set.call(this,k,v);};},SIGNAL_SAVE_KEY);
 const errors:string[]=[];amber.on('pageerror',e=>errors.push(e.message));await amber.goto('/games/amber-step/?lang=en');expect(await amber.locator('meta[name="description"]').getAttribute('content')).not.toContain('signals');await expect(amber.locator('#signals')).toHaveCount(0);
 await amber.getByRole('button',{name:'Start stage 1',exact:true}).click();await amber.keyboard.press('Escape');await expect(amber.locator('#game')).toHaveAttribute('data-mode','pause');expect(errors).toEqual([]);expect(await amber.evaluate(()=>Reflect.get(window,'__signalAccesses'))).toEqual([]);await amber.close();
});
test('optional objective and cards remain readable at320x568 and landscape inJA/EN with reduced motion',async({page})=>{
 await mkdir(evidence,{recursive:true});await page.emulateMedia({reducedMotion:'reduce'});await page.goto(url);
 for(const viewport of [{width:320,height:568},{width:844,height:390}]){await page.setViewportSize(viewport);for(const lang of ['en','ja']){
  await page.locator(`[data-language="${lang}"]`).click();for(const card of await page.locator('#stages button').all()){const b=(await card.boundingBox())!;expect(b.x).toBeGreaterThanOrEqual(0);expect(b.x+b.width).toBeLessThanOrEqual(viewport.width);}
  await page.screenshot({path:`${evidence}/menu-${viewport.width}-${lang}.png`});await page.getByRole('button',{name:lang==='en'?'Start stage 1':'ステージ 1 をはじめる',exact:true}).click();
  await expect(page.locator('#signals')).toContainText(lang==='en'?'OPTIONAL':'任意');await page.keyboard.press('Escape');await page.getByRole('button',{name:lang==='en'?'Choose a stage':'ステージ選択',exact:true}).click();
 }}
});


test('observed pillar and lateral fall retry help stays truthful through language changes and retry',async({page},info)=>{
 await page.setViewportSize({width:320,height:568});await page.goto(url);const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
 const before=await page.evaluate(keys=>keys.map(k=>localStorage.getItem(k)),[SAVE_KEY,SIGNAL_SAVE_KEY]);
 await page.getByRole('button',{name:'Start stage 1',exact:true}).click();await expect(page.locator('#game')).toHaveAttribute('data-status','dead',{timeout:6000});
 const pillar=await readSignals(page);expect(Number(pillar.y)).toBeGreaterThanOrEqual(-4);await expect(page.locator('#panel-copy')).toContainText('You hit a pillar.');await expect(page.locator('#panel-copy')).toContainText('Steer left or right');await expect(page.locator('#panel-copy')).not.toContainText('Jump');
 await page.screenshot({path:info.outputPath('pillar-320-en.png')});await page.locator('[data-language="ja"]').click();await expect(page.locator('#panel-copy')).toContainText('柱にぶつかりました');await page.screenshot({path:info.outputPath('pillar-320-ja.png')});
 await page.getByRole('button',{name:'すぐにリトライ',exact:true}).click();await expect(page.locator('#game')).toHaveAttribute('data-status','running');await expect(page.locator('#overlay')).toBeHidden();
 const session=await page.context().newCDPSession(page),r=(await page.locator('[data-input="right"]').boundingBox())!;
 await session.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:r.x+r.width/2,y:r.y+r.height/2,id:1}]});
 await expect(page.locator('#game')).toHaveAttribute('data-status','dead',{timeout:6000});await session.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});await session.detach();const fall=await readSignals(page);expect(Number(fall.y)).toBeLessThan(-4);
 await expect(page.locator('#panel-copy')).toContainText('道から落ちました');await page.locator('[data-language="en"]').click();await expect(page.locator('#panel-copy')).toContainText('You fell off the path.');await expect(page.locator('#panel-copy')).not.toContainText('hit a pillar');await page.screenshot({path:info.outputPath('fall-320-en.png')});
 expect(await page.evaluate(keys=>keys.map(k=>localStorage.getItem(k)),[SAVE_KEY,SIGNAL_SAVE_KEY])).toEqual(before);expect(errors).toEqual([]);
 await writeFile(info.outputPath('observed-losses.json'),JSON.stringify({pillar,fall,before,errors},null,2));
});

test('compact shared header keeps full JA EN ON OFF labels and44px focused targets visible',async({page},info)=>{
 await page.setViewportSize({width:320,height:568});await page.emulateMedia({reducedMotion:'reduce'});const reports:unknown[]=[];
 for(const game of ['orbit-ribbon','amber-step'])for(const lang of ['en','ja']){
  await page.goto(`/games/${game}/?lang=${lang}`);const sound=page.locator('#sound');if(await sound.getAttribute('aria-pressed')==='true')await sound.click();
  await page.getByRole('button',{name:lang==='en'?'Start stage 1':'ステージ 1 をはじめる',exact:true}).click();await page.keyboard.press('Escape');
  for(const enabled of [false,true]){
   if((await sound.getAttribute('aria-pressed')==='true')!==enabled)await sound.click();await expect(sound).toHaveText(lang==='en'?`Sound ${enabled?'ON':'OFF'}`:`音 ${enabled?'ON':'OFF'}`);
   const mark=(await page.locator('.wordmark').boundingBox())!,rects=[];
   // Keyboard modality makes focus-visible explicit before checking its full outline.
   await page.keyboard.press('Tab');
   for(const selector of ['#sound','.audio-settings-button','#pause']){
    const button=page.locator(selector);await button.focus();const r=(await button.boundingBox())!;const outline=await button.evaluate(e=>{const s=getComputedStyle(e);return{width:parseFloat(s.outlineWidth),offset:parseFloat(s.outlineOffset),style:s.outlineStyle};});
    expect(r.width).toBeGreaterThanOrEqual(44);expect(r.height).toBeGreaterThanOrEqual(44);expect(outline.style).not.toBe('none');const extent=outline.width+outline.offset;
    expect(r.x-extent).toBeGreaterThanOrEqual(0);expect(r.x+r.width+extent).toBeLessThanOrEqual(320);expect(r.y-extent).toBeGreaterThanOrEqual(0);expect(r.x).toBeGreaterThanOrEqual(mark.x+mark.width);rects.push(r);
   }
   for(let i=1;i<rects.length;i++)expect(rects[i].x).toBeGreaterThanOrEqual(rects[i-1].x+rects[i-1].width);
   reports.push({game,lang,enabled,mark,rects});await page.screenshot({path:info.outputPath(`header-${game}-${lang}-${enabled?'on':'off'}-320.png`)});
  }
 }
 await writeFile(info.outputPath('header-bounds.json'),JSON.stringify(reports,null,2));
});
