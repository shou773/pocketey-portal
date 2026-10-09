import { test, expect, type Page } from '@playwright/test';
const url='/prototypes/conveyor/?lang=ja', key='pocketey-conveyor-campaign-v2';
const solutions = [ [['a',1],['b',1]], [['a',3],['c',1],['d',1],['e',1],['g',1]], [['a',1],['b',1],['c',1],['d',1],['g',2]] ] as const;
const ids=['first-dispatch','factory-loop','read-the-inlet'];
async function ready(page: Page) {
  await page.goto(url); await expect(page.locator('#conveyor')).toHaveAttribute('data-webgl','true');
  await expect(page.locator('#conveyor')).toHaveAttribute('data-render-pending','false');
}
async function solve(page: Page,index:number) {
  for(const [id,count] of solutions[index])for(let n=0;n<count;n++)await page.locator(`[data-tile="${id}"]`).tap();
}
async function budget(page: Page) {
  await expect(page.locator('#conveyor')).toHaveAttribute('data-render-pending','false');
  expect(Number(await page.locator('#conveyor').getAttribute('data-draw-calls'))).toBeLessThanOrEqual(90);
  expect(Number(await page.locator('#conveyor').getAttribute('data-triangles'))).toBeLessThanOrEqual(15000);
}
async function legacy(page: Page) {
  await page.addInitScript(()=>{ if (!localStorage.getItem('pocketey-conveyor-v1'))localStorage.setItem('pocketey-conveyor-v1',JSON.stringify({version:1,rotations:[1,0,3,0,0,2,1,3],turns:0,best:7})); });
}
test('fresh player earns all three stars with ordinary taps, Next, replay and reload',async({page})=>{
  test.setTimeout(90000); const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
  await ready(page);const root=page.locator('#conveyor');
  await expect(page.locator('button[data-mission="factory-loop"]')).toBeDisabled();
  await page.locator('button[data-mission="factory-loop"]').dispatchEvent('click');await expect(root).toHaveAttribute('data-mission',ids[0]);
  for(let index=0;index<3;index++){
    await expect(root).toHaveAttribute('data-mission',ids[index]);await budget(page);
    await page.screenshot({path:`test-results/conveyor/campaign-${index+1}-start-390.png`,fullPage:true});
    await solve(page,index);await budget(page);
    await page.locator('#cv-play').tap();await expect(root).toHaveAttribute('data-phase','success');
    await expect(page.locator('#cv-target')).toHaveAttribute('data-earned','true');await budget(page);
    await page.screenshot({path:`test-results/conveyor/campaign-${index+1}-clear-390.png`,fullPage:true});
    if(index<2)await page.locator('#cv-next').tap();
  }
  await expect(page.locator('#cv-next')).toBeHidden();
  const save=await page.evaluate(key=>JSON.parse(localStorage.getItem(key)!),key);
  expect(ids.map(id=>save.records[id].best)).toEqual([2,7,6]);
  expect(await page.evaluate(()=>localStorage.getItem('pocketey-conveyor-v1'))).toBeNull();
  await page.reload();await expect(root).toHaveAttribute('data-mission','read-the-inlet');
  await expect(page.locator('#cv-target')).toHaveAttribute('data-earned','true');
  await page.locator('#cv-reset').tap();await expect(page.locator('#cv-turns')).toHaveText('回転 0 回');
  await expect(page.locator('#cv-best')).toHaveText('最少 6 回で出荷');expect(errors).toEqual([]);
});
test('legacy import stays untouched; switching cancels motion and keeps records isolated',async({page})=>{
  await legacy(page);await ready(page);const root=page.locator('#conveyor');
  const old=await page.evaluate(()=>localStorage.getItem('pocketey-conveyor-v1'));
  await expect(root).toHaveAttribute('data-mission','factory-loop');await expect(page.locator('#cv-best')).toHaveText('最少 7 回で出荷');
  await page.locator('#cv-play').tap();await page.locator('button[data-mission="first-dispatch"]').tap();
  await expect(root).toHaveAttribute('data-mission','first-dispatch');await expect(root).toHaveAttribute('data-phase','editing');
  await page.waitForTimeout(1000);await expect(root).toHaveAttribute('data-phase','editing');
  await page.locator('#cv-settings').tap();await page.locator('button[data-mission="read-the-inlet"]').dispatchEvent('click');
  await expect(root).toHaveAttribute('data-mission','first-dispatch');await page.locator('#cv-audio-close').tap();
  for(let n=0;n<6;n++)await page.locator(`button[data-mission="${ids[(n+1)%3]}"]`).tap();
  await page.locator('button[data-mission="first-dispatch"]').tap();await solve(page,0);
  await page.locator('#cv-play').tap();await expect(root).toHaveAttribute('data-phase','success');
  await page.locator('#cv-play').tap();await expect(root).toHaveAttribute('data-phase','editing');
  await budget(page);const frames=await root.getAttribute('data-frames');await page.waitForTimeout(250);await expect(root).toHaveAttribute('data-frames',frames!);
  expect(await page.evaluate(()=>localStorage.getItem('pocketey-conveyor-v1'))).toBe(old);
  const save=await page.evaluate(key=>JSON.parse(localStorage.getItem(key)!),key);expect(save.records['factory-loop'].best).toBe(7);expect(save.records['read-the-inlet'].best).toBeNull();
});
test('every board keeps 44px separate touch targets at 320px and landscape, with bilingual keyboard controls',async({page})=>{
  test.setTimeout(90000);await legacy(page);await ready(page);
  for(const viewport of [{width:320,height:740},{width:844,height:390}]){
    await page.setViewportSize(viewport);
    for(const id of ids){
      await page.locator(`button[data-mission="${id}"]`).tap();await budget(page);
      const boxes=await page.locator('.cv-tile').evaluateAll(items=>items.map(item=>{const r=item.getBoundingClientRect();return {x:r.x,y:r.y,w:r.width,h:r.height};}));
      for(const r of boxes){expect(r.w).toBeGreaterThanOrEqual(44);expect(r.h).toBeGreaterThanOrEqual(44);expect(r.x).toBeGreaterThanOrEqual(0);expect(r.x+r.w).toBeLessThanOrEqual(viewport.width);}
      for(let i=0;i<boxes.length;i++)for(let j=i+1;j<boxes.length;j++){const a=boxes[i],b=boxes[j];expect(Math.min(a.x+a.w,b.x+b.w)<=Math.max(a.x,b.x)||Math.min(a.y+a.h,b.y+b.h)<=Math.max(a.y,b.y)).toBeTruthy();}
      expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
      await page.screenshot({path:`test-results/conveyor/campaign-${id}-${viewport.width}.png`,fullPage:true});
    }
  }
  await page.locator('[data-language="en"]').tap();await expect(page.locator('#cv-intro')).toContainText('starts from above');
  await page.locator('[data-tile="a"]').focus();await page.keyboard.press('Enter');await expect(page.locator('#cv-turns')).toHaveText('1 turns');
  await page.locator('[data-language="ja"]').tap();await expect(page.locator('#cv-title')).toHaveText('コンベア便');
});
test('newer saves are never overwritten and the teaching delivery remains playable',async({page})=>{
  await page.addInitScript(()=>localStorage.setItem('pocketey-conveyor-campaign-v2','{"version":99,"future":"preserve"}'));
  await ready(page);await solve(page,0);await page.locator('#cv-play').tap();await expect(page.locator('#conveyor')).toHaveAttribute('data-phase','success');
  expect(await page.evaluate(key=>localStorage.getItem(key),key)).toBe('{"version":99,"future":"preserve"}');
  await expect(page.locator('#cv-save')).toContainText('保存できません');
});
test('reduced motion retains ordinary delivery, pause and no unexpected effects',async({page})=>{
  await page.emulateMedia({reducedMotion:'reduce'});await ready(page);await solve(page,0);
  await page.locator('#cv-play').tap();await page.locator('#cv-play').tap();await expect(page.locator('#conveyor')).toHaveAttribute('data-phase','paused');
  await page.waitForTimeout(150);const elapsed=await page.locator('#conveyor').getAttribute('data-elapsed');await page.waitForTimeout(200);
  await expect(page.locator('#conveyor')).toHaveAttribute('data-elapsed',elapsed!);await page.locator('#cv-play').tap();
  await expect(page.locator('#conveyor')).toHaveAttribute('data-phase','success');await page.locator('#cv-next').tap();await expect(page.locator('#conveyor')).toHaveAttribute('data-mission','factory-loop');
});

test('Next restores focus and the new board at 320x568 instead of leaving the player below it',async({page})=>{
  await page.setViewportSize({width:320,height:568});await ready(page);await solve(page,0);
  await page.locator('#cv-play').tap();await expect(page.locator('#conveyor')).toHaveAttribute('data-phase','success');
  await page.locator('#cv-next').tap();await expect(page.locator('button[data-mission="factory-loop"]')).toBeFocused();
  await budget(page);const board=await page.locator('#cv-board').boundingBox();expect(board!.y).toBeGreaterThanOrEqual(0);expect(board!.y+board!.height).toBeLessThanOrEqual(568);
  await page.screenshot({path:'test-results/conveyor/campaign-next-320x568.png',fullPage:true});
});
