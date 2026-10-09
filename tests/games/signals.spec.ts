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
