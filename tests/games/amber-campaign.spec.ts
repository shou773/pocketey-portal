import {test,expect,type Page} from '@playwright/test';
import {writeFile} from 'node:fs/promises';
import {AMBER_CAMPAIGN_KEY,AMBER_IDS} from '../../src/games/amber-campaign';
import {SAVE_KEY} from '../../src/games/model';
import {SIGNAL_SAVE_KEY} from '../../src/games/signals';
import {driveLanding} from './amber-landing-driver';
import {read} from './input';
const legacy={version:1,sound:false,orbit:{unlocked:3,best:[10,12,14],challengeBest:[14,17,20]},amber:{unlocked:3,best:[8,10,12],challengeBest:[12,16,22]}};
async function fixture(page:Page){await page.addInitScript(({key,value})=>{if(!localStorage.getItem(key))localStorage.setItem(key,value);},{key:SAVE_KEY,value:JSON.stringify(legacy)});}
async function open4(page:Page){await page.goto('/games/amber-step/?lang=en');await expect(page.locator('#scene')).toHaveAttribute('data-art-adopted','true');await page.locator('#stages button').nth(3).click();await page.getByRole('button',{name:'Start stage 4',exact:true}).click();await expect(page.locator('#stage-label')).toHaveText('04 / 04');}
for(const touch of[false,true])for(const stop of[false,true])test.describe(`${touch?'touch':'keyboard'}-${stop?'stopped':'cadence'}`,()=>{
 test.use({isMobile:touch,hasTouch:touch,viewport:touch?{width:390,height:844}:{width:1280,height:800}});
 test('ordinary discrete jumps clear Landing Beats and preserve read-only legacy records',async({page},info)=>{
  await fixture(page);await open4(page);const trace:unknown[]=[];try{await driveLanding(page,touch,stop,trace);}finally{await writeFile(info.outputPath('route.json'),JSON.stringify({touch,stop,trace},null,2));}
  await expect(page.locator('#panel-title')).toHaveText('ALL CLEAR!');await page.screenshot({path:info.outputPath('landing-beats-clear.png')});
  const record=await page.evaluate(k=>JSON.parse(localStorage.getItem(k)!),AMBER_CAMPAIGN_KEY);expect(record.records['landing-beats'].challengeBest).toBeGreaterThan(13);expect(record.unlocked).toBe(4);
  for(const [i,id]of AMBER_IDS.slice(0,3).entries()){expect(record.records[id].best).toBe(legacy.amber.best[i]);expect(record.records[id].challengeBest).toBe(legacy.amber.challengeBest[i]);}
  expect(await page.evaluate(k=>localStorage.getItem(k),SAVE_KEY)).toBe(JSON.stringify(legacy));await page.reload();await expect(page.locator('#stages button').nth(3)).toBeEnabled();
  await writeFile(info.outputPath('save.json'),JSON.stringify(record,null,2));
 });
});
test('two-tab late faster records merge; a later future-format replacement remains untouched',async({page},info)=>{
 await fixture(page);await page.goto('/games/amber-step/?lang=en');const second=await page.context().newPage();await second.goto(page.url());
 const faster={version:1,unlocked:4,sound:false,records:{'small-step':{best:7,challengeBest:10},'landing-beats':{challengeBest:13.9}}};
 await second.evaluate(({key,value})=>localStorage.setItem(key,JSON.stringify(value)),{key:AMBER_CAMPAIGN_KEY,value:faster});await expect.poll(()=>page.evaluate(k=>localStorage.getItem(k),AMBER_CAMPAIGN_KEY)).toBe(JSON.stringify(faster));await page.bringToFront();await page.locator('#sound').click();await expect(page.locator('#sound')).toHaveText('Sound ON');await expect.poll(()=>page.evaluate(k=>JSON.parse(localStorage.getItem(k)!).sound,AMBER_CAMPAIGN_KEY)).toBe(true);
 await expect.poll(()=>second.evaluate(k=>Object.keys(JSON.parse(localStorage.getItem(k)!).records).length,AMBER_CAMPAIGN_KEY)).toBe(4);const merged=await second.evaluate(k=>JSON.parse(localStorage.getItem(k)!),AMBER_CAMPAIGN_KEY);expect(merged.records['small-step'].best).toBe(7);expect(merged.records['small-step'].challengeBest).toBe(10);expect(merged.records['landing-beats'].challengeBest).toBe(13.9);expect(merged.sound).toBe(true);expect(Object.keys(merged.records)).toEqual([...AMBER_IDS]);expect(merged.records['sky-steps']).toEqual({best:10,challengeBest:16});expect(merged.records['amber-garden']).toEqual({best:12,challengeBest:22});
 const future='{"version":2,"future":"preserve"}';await second.evaluate(({key,value})=>localStorage.setItem(key,value),{key:AMBER_CAMPAIGN_KEY,value:future});await expect.poll(()=>page.evaluate(k=>localStorage.getItem(k),AMBER_CAMPAIGN_KEY)).toBe(future);await page.bringToFront();await page.locator('#sound').click();await expect(page.locator('#sound')).toHaveText('Sound OFF');expect(await second.evaluate(k=>localStorage.getItem(k),AMBER_CAMPAIGN_KEY)).toBe(future);await expect(page.locator('#save-note')).toContainText('Storage is unavailable');
 expect(await page.evaluate(k=>localStorage.getItem(k),SAVE_KEY)).toBe(JSON.stringify(legacy));await writeFile(info.outputPath('two-tab.json'),JSON.stringify({merged,future},null,2));await second.close();
});
test('historical third-course time does not invent current completion or unlock4',async({page})=>{
 await page.addInitScript(({key,value})=>localStorage.setItem(key,JSON.stringify(value)),{key:SAVE_KEY,value:{...legacy,amber:{...legacy.amber,challengeBest:[12,16,null]}}});
 await page.goto('/games/amber-step/?lang=en');await expect(page.locator('#stages button').nth(2)).toBeEnabled();await expect(page.locator('#stages button').nth(3)).toBeDisabled();expect(await page.evaluate(k=>localStorage.getItem(k),AMBER_CAMPAIGN_KEY)).toBeNull();
});
test('Orbit does not access the Amber campaign except during an explicit reset; future keys survive later writes',async({page},info)=>{
 await fixture(page);await page.addInitScript(key=>{const get=Storage.prototype.getItem,set=Storage.prototype.setItem,accesses:string[]=[];(window as any).amberAccesses=accesses;Storage.prototype.getItem=function(k){if(k===key)accesses.push('read');return get.call(this,k);};Storage.prototype.setItem=function(k,v){if(k===key)accesses.push('write');return set.call(this,k,v);};},AMBER_CAMPAIGN_KEY);
 await page.goto('/games/orbit-ribbon/?lang=en');await page.locator('#sound').click();await page.getByRole('button',{name:'Start stage 1',exact:true}).click();await page.locator('#pause').click();expect(await page.evaluate(()=>(window as any).amberAccesses)).toEqual([]);await page.getByRole('button',{name:'Choose a stage',exact:true}).click();
 // Explicit reset clears both known keys and leaves unrelated storage alone.
 await page.evaluate(({key})=>{localStorage.setItem(key,JSON.stringify({version:1,records:{'landing-beats':{challengeBest:14}}}));localStorage.setItem('unrelated','keep');},{key:AMBER_CAMPAIGN_KEY});
 async function reset(){await page.locator('#reset').click();await page.getByRole('button',{name:'Reset these two games',exact:true}).click();}
 await reset();expect(JSON.parse((await page.evaluate(k=>localStorage.getItem(k),AMBER_CAMPAIGN_KEY))!).records['landing-beats'].challengeBest).toBeNull();expect(await page.evaluate(()=>localStorage.getItem('unrelated'))).toBe('keep');
 const future={shared:'{"version":2,"future":"shared"}',amber:'{"version":2,"future":"amber"}',signals:'{"version":2,"future":"signals"}'};
 await page.evaluate(({keys,future})=>{localStorage.setItem(keys[0],future.shared);localStorage.setItem(keys[1],future.amber);localStorage.setItem(keys[2],future.signals);},{keys:[SAVE_KEY,AMBER_CAMPAIGN_KEY,SIGNAL_SAVE_KEY],future});
 await reset();await expect(page.locator('#save-note')).toContainText('Newer-format records were kept');await page.locator('#sound').click();
 const kept=await page.evaluate(keys=>keys.map(k=>localStorage.getItem(k)),[SAVE_KEY,AMBER_CAMPAIGN_KEY,SIGNAL_SAVE_KEY]);expect(kept).toEqual([future.shared,future.amber,future.signals]);await expect(page.locator('#save-note')).toContainText('Storage is unavailable');await writeFile(info.outputPath('reset.json'),JSON.stringify({kept},null,2));
});
test('a failed shared reset cannot be masked by a successful Amber reset',async({page})=>{
 await page.goto('/games/orbit-ribbon/?lang=en');await page.evaluate(key=>{const old=Storage.prototype.setItem;Storage.prototype.setItem=function(k,v){if(k===key)throw new Error('test blocked shared write');return old.call(this,k,v);};},SAVE_KEY);
 await page.locator('#reset').click();await page.getByRole('button',{name:'Reset these two games',exact:true}).click();await expect(page.locator('#save-note')).toContainText('Storage is unavailable');expect(await page.evaluate(k=>localStorage.getItem(k),AMBER_CAMPAIGN_KEY)).not.toBeNull();
});
test('four-card menus are reachable in compact JA/EN portrait and landscape',async({page},info)=>{
 await fixture(page);for(const viewport of[{width:320,height:568},{width:844,height:390}])for(const lang of['ja','en']){
  await page.setViewportSize(viewport);await page.goto(`/games/amber-step/?lang=${lang}`);await expect(page.locator('#stages button')).toHaveCount(4);
  for(const card of await page.locator('#stages button').all()){await card.scrollIntoViewIfNeeded();await expect(card).toBeInViewport();const b=(await card.boundingBox())!;expect(b.x).toBeGreaterThanOrEqual(0);expect(b.x+b.width).toBeLessThanOrEqual(viewport.width);expect(b.height).toBeGreaterThanOrEqual(44);}
  await page.screenshot({path:info.outputPath(`menu-${viewport.width}-${lang}.png`)});await page.locator('#actions button').first().scrollIntoViewIfNeeded();await expect(page.locator('#actions button').first()).toBeInViewport();
 }
});
for(const width of[320,390])test(`native approach and short-pad standing views at${width}px`,async({page},info)=>{
 await page.setViewportSize({width,height:844});await page.emulateMedia({reducedMotion:'reduce'});await fixture(page);await open4(page);const trace:unknown[]=[];
 try{await driveLanding(page,true,true,trace,async name=>{await expect(page.locator('#game')).toHaveAttribute('data-status','running');await page.screenshot({path:info.outputPath(`${name}-${width}.png`)});});}finally{await writeFile(info.outputPath('capture-route.json'),JSON.stringify(trace,null,2));}
});
test('fourth-course failure, retry, pause and actual context loss never award a completion',async({page},info)=>{
 await fixture(page);await open4(page);await page.keyboard.down('ArrowRight');await expect(page.locator('#game')).toHaveAttribute('data-status','dead');await page.keyboard.up('ArrowRight');expect(await page.evaluate(k=>localStorage.getItem(k),AMBER_CAMPAIGN_KEY)).toBeNull();
 await page.getByRole('button',{name:'Retry now',exact:true}).click();await page.keyboard.press('Escape');const frozen=await read(page);await page.waitForTimeout(150);expect((await read(page)).x).toBe(frozen.x);await page.getByRole('button',{name:'Resume',exact:true}).click();
 expect(await page.locator('#scene').evaluate(el=>{const ext=(el as HTMLCanvasElement).getContext('webgl2')?.getExtension('WEBGL_lose_context');ext?.loseContext();return !!ext;})).toBe(true);await expect(page.locator('#game')).toHaveAttribute('data-mode','recovery');expect(await page.evaluate(k=>localStorage.getItem(k),AMBER_CAMPAIGN_KEY)).toBeNull();expect(await page.evaluate(k=>localStorage.getItem(k),SAVE_KEY)).toBe(JSON.stringify(legacy));await page.screenshot({path:info.outputPath('course4-context-loss.png')});
});
