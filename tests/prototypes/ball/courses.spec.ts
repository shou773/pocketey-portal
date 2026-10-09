import { test, expect } from '@playwright/test';
import { mkdir,writeFile } from 'node:fs/promises';
import { PROGRESS_KEY,STAGE_IDS } from '../../../src/games/prototypes/ball/progress';
import { SAVE_KEY } from '../../../src/games/prototypes/ball/model';
import { driveCourse,evidence,snapshot } from './course-driver';
const url='/games/tilttrail/?lang=en';
const old=JSON.stringify({best:[10,20,30],muted:true});
for(const touch of [false,true])test.describe(touch?'touch courses':'keyboard courses',()=>{
  test.use({hasTouch:touch,isMobile:touch,viewport:touch?{width:390,height:844}:{width:1280,height:800}});
  test('legacy stage3 clear opens4; ordinary controls clear4→5 and preserve every original record',async({page})=>{
    test.setTimeout(240000);await mkdir(evidence,{recursive:true});const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
    await page.addInitScript(({key,old})=>{if(!localStorage.getItem(key))localStorage.setItem(key,old);},{key:SAVE_KEY,old});
    await page.goto(url);await expect(page.locator('#tt-stages button')).toHaveCount(5);
    await expect(page.locator('button[data-stage="3"]')).toBeEnabled();await expect(page.locator('button[data-stage="4"]')).toBeDisabled();
    await page.locator('button[data-stage="4"]').dispatchEvent('click');await expect(page.locator('#tilttrail')).toHaveAttribute('data-stage','0');
    await page.locator('button[data-stage="3"]').click();await page.getByRole('button',{name:'Play this stage',exact:true}).click();
    await driveCourse(page,touch,touch?'touch':'keyboard');
    await page.getByRole('button',{name:'Next stage',exact:true}).click();await expect(page.locator('#tilttrail')).toHaveAttribute('data-stage','4');
    await driveCourse(page,touch,touch?'touch':'keyboard');await expect(page.getByRole('button',{name:'Next stage',exact:true})).toHaveCount(0);
    const saved=await page.evaluate(key=>JSON.parse(localStorage.getItem(key)!),PROGRESS_KEY);
    expect(STAGE_IDS.slice(0,3).map(id=>saved.records[id])).toEqual([10,20,30]);
    expect(saved.records['breathing-bends']).toBeGreaterThan(0);expect(saved.records['double-apex']).toBeGreaterThan(0);
    expect(await page.evaluate(key=>localStorage.getItem(key),SAVE_KEY)).toBe(old);
    await page.reload();await expect(page.locator('button[data-stage="4"]')).toBeEnabled();
    expect(await page.evaluate(key=>JSON.parse(localStorage.getItem(key)!),PROGRESS_KEY)).toEqual(saved);
    await page.locator('button[data-stage="4"]').click();await page.getByRole('button',{name:'Play this stage',exact:true}).click();await page.keyboard.press('Escape');
    const paused=await snapshot(page);await page.waitForTimeout(150);expect((await snapshot(page)).z).toBe(paused.z);
    await page.getByRole('button',{name:'Retry',exact:true}).click();await expect(page.locator('#tilttrail')).toHaveAttribute('data-phase','playing');
    expect(await page.evaluate(key=>JSON.parse(localStorage.getItem(key)!),PROGRESS_KEY)).toEqual(saved);expect(errors).toEqual([]);
    await writeFile(`${evidence}/${touch?'touch':'keyboard'}-progress.json`,JSON.stringify({saved,legacy:old,errors},null,2));
  });
});
test('fresh native stage3 clear unlocks4 and Next crosses the old end without unlocking5',async({page})=>{
  test.setTimeout(150000);await page.goto(url);await expect(page.locator('button[data-stage="3"]')).toBeDisabled();await expect(page.locator('button[data-stage="4"]')).toBeDisabled();
  await page.locator('button[data-stage="2"]').tap();await page.getByRole('button',{name:'Play this stage',exact:true}).tap();
  await driveCourse(page,true,'fresh-original3',false);
  const saved=await page.evaluate(key=>JSON.parse(localStorage.getItem(key)!),PROGRESS_KEY);expect(saved.records['sky-ridge']).toBeGreaterThan(0);expect(saved.records['breathing-bends']).toBeNull();expect(saved.records['double-apex']).toBeNull();
  await page.getByRole('button',{name:'Next stage',exact:true}).tap();await expect(page.locator('#tilttrail')).toHaveAttribute('data-stage','3');await expect(page.locator('#tt-stage')).toHaveText('04 / 05');
  await page.locator('#tt-pause').tap();await page.getByRole('button',{name:'Stages',exact:true}).tap();await expect(page.locator('button[data-stage="3"]')).toBeEnabled();await expect(page.locator('button[data-stage="4"]')).toBeDisabled();
});
test('five-course menu stays reachable at320x568 and landscape in both languages',async({page})=>{
  await mkdir(evidence,{recursive:true});await page.goto(url);
  for(const viewport of [{width:320,height:568},{width:844,height:390}]){
    await page.setViewportSize(viewport);
    for(const lang of ['en','ja']){
      await page.locator(`[data-language="${lang}"]`).click();
      const overlay=page.locator('#tt-overlay');await overlay.evaluate(el=>el.scrollTop=0);
      await page.screenshot({path:`${evidence}/menu-${viewport.width}-${lang}-top.png`});
      await page.getByRole('button',{name:lang==='en'?'Play this stage':'このステージを遊ぶ',exact:true}).scrollIntoViewIfNeeded();
      const action=await page.getByRole('button',{name:lang==='en'?'Play this stage':'このステージを遊ぶ',exact:true}).boundingBox();expect(action!.y).toBeGreaterThanOrEqual(0);expect(action!.y+action!.height).toBeLessThanOrEqual(viewport.height);
      await page.screenshot({path:`${evidence}/menu-${viewport.width}-${lang}-play.png`});
      await page.locator('button[data-stage="0"]').scrollIntoViewIfNeeded();await page.locator('button[data-stage="0"]').click();await expect(page.locator('#tilttrail')).toHaveAttribute('data-stage','0');
      expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
    }
  }
});
test('future saves remain intact while imported old records and sound stay usable',async({page})=>{
  await page.addInitScript(({old,key,progress})=>{localStorage.setItem(key,old);localStorage.setItem(progress,'{"version":3,"future":"keep"}');},{old,key:SAVE_KEY,progress:PROGRESS_KEY});
  await page.goto(url);await expect(page.locator('button[data-stage="3"]')).toBeEnabled();await expect(page.locator('button[data-stage="4"]')).toBeDisabled();
  await page.locator('#tt-sound').click();expect(await page.evaluate(key=>localStorage.getItem(key),PROGRESS_KEY)).toBe('{"version":3,"future":"keep"}');expect(await page.evaluate(key=>localStorage.getItem(key),SAVE_KEY)).toBe(old);
  await expect(page.locator('#tt-save')).toContainText('Storage unavailable');
});
