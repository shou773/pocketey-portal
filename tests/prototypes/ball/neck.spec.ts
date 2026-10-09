import { test, expect } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';
import { PROGRESS_KEY, PREVIOUS_PROGRESS_KEY, STAGE_IDS } from '../../../src/games/prototypes/ball/progress';
import { SAVE_KEY } from '../../../src/games/prototypes/ball/model';
import { driveCourse, evidence } from './course-driver';
const url='/games/tilttrail/?lang=en';
const original=[10,20,30,40,50];
const legacy=JSON.stringify({best:original.slice(0,3),muted:true});
const previous=JSON.stringify({version:2,records:Object.fromEntries(STAGE_IDS.slice(0,5).map((id,i)=>[id,original[i]])),muted:true});
const keys={legacy:SAVE_KEY,previous:PREVIOUS_PROGRESS_KEY,current:PROGRESS_KEY};
for(const touch of [false,true])test.describe(touch?'touch neck':'keyboard neck',()=>{
 test.use({hasTouch:touch,isMobile:touch,viewport:touch?{width:390,height:844}:{width:1280,height:800}});
 for(const policy of ['conservative','release'] as const)test(`course6 ${policy}: real clear preserves all five records and untouched backups`,async({page})=>{
  test.setTimeout(180000);await mkdir(evidence,{recursive:true});const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
  // Completed-course fixtures only unlock selection; the new record is earned by normal input.
  await page.addInitScript(({keys,legacy,previous})=>{if(!localStorage.getItem(keys.legacy))localStorage.setItem(keys.legacy,legacy);if(!localStorage.getItem(keys.previous))localStorage.setItem(keys.previous,previous);},{keys,legacy,previous});
  await page.goto(url);await expect(page.locator('button[data-stage="5"]')).toBeEnabled();
  expect(await page.evaluate(key=>localStorage.getItem(key),PROGRESS_KEY)).toBeNull();
  await page.locator('button[data-stage="5"]').click();await page.getByRole('button',{name:'Play this stage',exact:true}).click();
  const end=await driveCourse(page,touch,`${touch?'touch':'keyboard'}-neck-${policy}`,true,policy);
  const saved=await page.evaluate(key=>JSON.parse(localStorage.getItem(key)!),PROGRESS_KEY);
  expect(saved.version).toBe(3);expect(STAGE_IDS.slice(0,5).map(id=>saved.records[id])).toEqual(original);expect(saved.records['neck-corridors']).toBeCloseTo(end.time,1);
  if(policy==='conservative')expect(end.time).toBeGreaterThan(40);else expect(end.time).toBeLessThan(25);
  expect(await page.evaluate(key=>localStorage.getItem(key),SAVE_KEY)).toBe(legacy);expect(await page.evaluate(key=>localStorage.getItem(key),PREVIOUS_PROGRESS_KEY)).toBe(previous);
  await page.reload();await expect(page.locator('button[data-stage="5"]')).toBeEnabled();expect(await page.evaluate(key=>JSON.parse(localStorage.getItem(key)!),PROGRESS_KEY)).toEqual(saved);
  expect(errors).toEqual([]);await writeFile(`${evidence}/${touch?'touch':'keyboard'}-neck-${policy}-save.json`,JSON.stringify({saved,legacy,previous,errors},null,2));
 });
});
test('an already-open tab retains a newer current-course best and refuses a future replacement',async({page,context})=>{
 await mkdir(evidence,{recursive:true});await page.goto(url);
 const stale={version:3,muted:true,records:{...JSON.parse(previous).records,'neck-corridors':45}};
 await page.evaluate(({keys,legacy,previous,stale})=>{localStorage.setItem(keys.legacy,legacy);localStorage.setItem(keys.previous,previous);localStorage.setItem(keys.current,JSON.stringify(stale));},{keys,legacy,previous,stale});await page.reload();
 await page.locator('button[data-stage="5"]').click();
 // A real second same-origin tab writes fixtures representing another completed run.
 const second=await context.newPage();await second.goto(url);
 const newer={...stale,records:{...stale.records,'neck-corridors':19,'first-bends':9}};
 await second.evaluate(({key,value})=>localStorage.setItem(key,value),{key:PROGRESS_KEY,value:JSON.stringify(newer)});
 await page.bringToFront();await page.locator('#tt-sound').click();
 const merged=await page.evaluate(key=>JSON.parse(localStorage.getItem(key)!),PROGRESS_KEY);
 expect(merged.records['neck-corridors']).toBe(19);expect(merged.records['first-bends']).toBe(9);expect(merged.records['double-apex']).toBe(50);
 const future='{"version":4,"future":"untouched-late-replacement"}';
 await second.evaluate(({key,value})=>localStorage.setItem(key,value),{key:PROGRESS_KEY,value:future});
 await page.bringToFront();await page.locator('#tt-sound').click();expect(await page.evaluate(key=>localStorage.getItem(key),PROGRESS_KEY)).toBe(future);
 await expect(page.locator('#tt-save')).toContainText('Storage unavailable');expect(await page.evaluate(key=>localStorage.getItem(key),SAVE_KEY)).toBe(legacy);expect(await page.evaluate(key=>localStorage.getItem(key),PREVIOUS_PROGRESS_KEY)).toBe(previous);
 await writeFile(`${evidence}/neck-two-tab-save.json`,JSON.stringify({stale,newer,merged,future,backupsUntouched:true},null,2));await second.close();
});
test('a v2 course4 clear alone cannot invent course5 completion or unlock6',async({page})=>{
 const incomplete=JSON.parse(previous);incomplete.records['double-apex']=null;
 await page.addInitScript(({key,value})=>localStorage.setItem(key,value),{key:PREVIOUS_PROGRESS_KEY,value:JSON.stringify(incomplete)});await page.goto(url);
 await expect(page.locator('button[data-stage="4"]')).toBeEnabled();await expect(page.locator('button[data-stage="5"]')).toBeDisabled();
 await page.locator('#tt-sound').click();const saved=await page.evaluate(key=>JSON.parse(localStorage.getItem(key)!),PROGRESS_KEY);expect(saved.records['double-apex']).toBeNull();expect(saved.records['neck-corridors']).toBeNull();
});
