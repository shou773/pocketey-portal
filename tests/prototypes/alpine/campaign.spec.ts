import { test, expect, type Page, type TestInfo } from '@playwright/test';
import { writeFile } from 'node:fs/promises';
import { COURSES } from '../../../src/games/prototypes/alpine/model';
const key='pocketey-alpine-campaign-v2',legacyKey='pocketey-alpine-prototype-v1';
const snapshot=(page:Page)=>page.locator('#alpine').evaluate(e=>({...((e as HTMLElement).dataset)}));
const stored=(page:Page)=>page.evaluate(k=>localStorage.getItem(k),key);
async function drive(page:Page,course:number,mode:'keyboard'|'touch',target:number,info:TestInfo) {
  const turns:unknown[]=[],session=mode==='touch'?await page.context().newCDPSession(page):null;
  const measurement=page.evaluate(async()=>{
    const intervals:number[]=[],counters:{calls:number;triangles:number}[]=[];let previous=performance.now();
    await new Promise<void>(resolve=>{const tick=(now:number)=>{const d=document.querySelector<HTMLElement>('#alpine')!.dataset;
      intervals.push(now-previous);previous=now;counters.push({calls:Number(d.drawCalls),triangles:Number(d.triangles)});
      if(d.phase==='playing')requestAnimationFrame(tick);else resolve();};requestAnimationFrame(tick);});
    const canvas=document.querySelector('canvas')!,sorted=[...intervals].sort((a,b)=>a-b);
    return{intervals,fps:1000*intervals.length/intervals.reduce((a,b)=>a+b,0),p95:sorted[Math.floor(sorted.length*.95)],
      maxDraws:Math.max(...counters.map(c=>c.calls)),maxTriangles:Math.max(...counters.map(c=>c.triangles)),
      framebuffer:[canvas.width,canvas.height],viewport:[innerWidth,innerHeight],hover:matchMedia('(hover:hover)').matches,fine:matchMedia('(pointer:fine)').matches};
  });
  try {
    for(const [i,g] of COURSES[course].gates.entries()) {
      await page.waitForFunction(({i,z,target})=>{const d=document.querySelector<HTMLElement>('#alpine')!.dataset;
        return d.phase==='failed'||(Number(d.gate)===i&&Number(d.z)>=z-target);},{i,z:g.z,target},{timeout:20000});
      const before=await snapshot(page);expect(before.phase).toBe('playing');expect(Number(before.z)).toBeLessThan(g.z-1);
      if(session) {
        const r=(await page.locator('canvas').boundingBox())!,x=r.x+r.width*.5,y=r.y+r.height*.68;
        await session.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x,y,id:1}]});
        await session.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:x+g.direction*70,y:y+2,id:1}]});
        await session.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
      } else await page.keyboard.press(g.direction<0?'ArrowLeft':'ArrowRight');
      const queued=await snapshot(page);expect(queued.queued).toBe(String(g.direction));turns.push({i,direction:g.direction,before,queued});
    }
    await expect(page.locator('#alpine')).toHaveAttribute('data-phase','clear',{timeout:20000});
    const end=await snapshot(page),metrics=await measurement;
    expect(Number(end.precise)).toBe(target<3?COURSES[course].gates.length:0);
    expect(metrics.maxTriangles).toBeLessThan(20000);expect(metrics.maxDraws).toBeGreaterThan(0);
    await writeFile(info.outputPath(`course${course+1}-${target<3?'precision':'early'}-${mode}.json`),JSON.stringify({source:process.env.GITHUB_SHA,course,mode,target,turns,end,metrics,note:'Ordinary real-rendered wall-clock inputs; timing metrics are diagnostic, baseline Alpine had no FPS acceptance gate.'},null,2));
    await page.screenshot({path:info.outputPath(`course${course+1}-${target<3?'precision':'early'}-${mode}-clear.png`)});
  } finally {await session?.detach();}
}
for(const mode of ['keyboard','touch'] as const)test.describe(mode,()=>{
test.use({hasTouch:mode==='touch',isMobile:mode==='touch'});
test(`${mode}: all3 courses earn0 and100 with real inputs, unlock and save once`,async({page},info)=>{
  const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
  if(mode==='keyboard')await page.setViewportSize({width:1280,height:800});
  await page.goto('/prototypes/alpine-drive/?lang=en');
  await expect(page.locator('#ad-courses button[data-course="1"]')).toBeDisabled();await expect(page.locator('#ad-courses button[data-course="2"]')).toBeDisabled();
  for(let course=0;course<3;course++) {
    await page.getByRole('button',{name:'Start driving',exact:true}).click();await drive(page,course,mode,4.7,info);
    await page.getByRole('button',{name:'Retry now',exact:true}).click();await drive(page,course,mode,2.35,info);
    const raw=await stored(page),saved=JSON.parse(raw!);expect(saved.records[COURSES[course].id]).toEqual({clears:2,best:100});
    await page.waitForTimeout(150);expect(await stored(page)).toBe(raw);
    if(course<2){
      if(mode==='touch'&&course===0)await page.setViewportSize({width:320,height:568});
      await page.getByRole('button',{name:'Next course',exact:true}).click();await expect(page.locator('#alpine')).toHaveAttribute('data-course',String(course+1));
      await expect(page.locator(`#ad-courses button[data-course="${course+1}"]`)).toBeFocused();
      if(mode==='touch'&&course===0){await page.screenshot({path:info.outputPath('next-course-320x568.png')});await page.setViewportSize({width:390,height:844});}
    }
  }
  expect(await page.evaluate(k=>localStorage.getItem(k),legacyKey)).toBeNull();await page.reload();
  for(let i=0;i<3;i++)await expect(page.locator(`#ad-courses button[data-course="${i}"]`)).toBeEnabled();
  expect(errors).toEqual([]);
});
});
test('legacy import, late future-version protection and concurrent best preservation',async({page})=>{
  const legacy='{"clears":7,"muted":true}';
  await page.addInitScript(({legacyKey,legacy})=>localStorage.setItem(legacyKey,legacy),{legacyKey,legacy});
  await page.goto('/prototypes/alpine-drive/?lang=ja');await expect(page.locator('#ad-courses button[data-course="1"]')).toBeEnabled();await expect(page.locator('#ad-courses button[data-course="2"]')).toBeDisabled();
  await expect(page.locator('#ad-save')).toContainText('最高精度 —');
  const better={version:2,muted:true,records:{'mountain-pass':{clears:12,best:100},'long-return':{clears:2,best:83}}};
  await page.evaluate(({key,better})=>localStorage.setItem(key,JSON.stringify(better)),{key,better});await page.locator('#ad-sound').click();
  expect(JSON.parse((await stored(page))!).records['mountain-pass']).toEqual({clears:12,best:100});
  const future='{"version":99,"future":"preserve exactly"}';await page.evaluate(({key,future})=>localStorage.setItem(key,future),{key,future});
  await page.locator('#ad-sound').click();expect(await stored(page)).toBe(future);await expect(page.locator('#ad-save')).toContainText('新しい形式');
  expect(await page.evaluate(k=>localStorage.getItem(k),legacyKey)).toBe(legacy);
});
test('pause/settings retain first timing, failed runs and context loss never save precision',async({page},info)=>{
  await page.goto('/prototypes/alpine-drive/?lang=ja');await page.getByRole('button',{name:'ドライブ開始',exact:true}).click();
  await expect(page.locator('#alpine')).toHaveAttribute('data-window','true');await page.keyboard.press('ArrowLeft');
  const first=(await snapshot(page)).firstInput;await page.keyboard.press('Escape');
  await expect(page.locator('#alpine')).toHaveAttribute('data-queued','null');await expect(page.locator('#alpine')).toHaveAttribute('data-first-input',first!);
  await page.getByRole('button',{name:'音量設定',exact:true}).click();await page.getByRole('button',{name:'閉じる',exact:true}).click();
  await expect(page.locator('#alpine')).toHaveAttribute('data-first-input',first!);await page.locator('#ad-actions button').first().click();
  await page.waitForFunction(()=>Number(document.querySelector<HTMLElement>('#alpine')!.dataset.z)>=7.7);await page.keyboard.press('ArrowLeft');
  await page.waitForFunction(()=>Number(document.querySelector<HTMLElement>('#alpine')!.dataset.gate)>=1);expect((await snapshot(page)).precise).toBe('0');
  await expect(page.locator('#alpine')).toHaveAttribute('data-phase','failed',{timeout:15000});
  const raw=await stored(page);if(raw)expect(JSON.parse(raw).records['mountain-pass'].clears).toBe(0);
  await page.getByRole('button',{name:'すぐリトライ',exact:true}).click();await page.locator('canvas').dispatchEvent('webglcontextlost');
  await expect(page.getByRole('button',{name:'再読み込み',exact:true})).toBeVisible();expect(await stored(page)).toBe(raw);
  await page.screenshot({path:info.outputPath('context-loss-reload.png')});
});
test('320x568 and landscape menus, Next focus and reduced-motion controls remain reachable',async({page},info)=>{
  await page.emulateMedia({reducedMotion:'reduce'});
  await page.addInitScript(()=>localStorage.setItem('pocketey-alpine-prototype-v1','{"clears":1}'));
  for(const viewport of [{width:320,height:568},{width:844,height:390}])for(const language of ['ja','en']) {
    await page.setViewportSize(viewport);await page.goto(`/prototypes/alpine-drive/?lang=${language}`);
    for(const card of await page.locator('#ad-courses button').all()) {
      await card.scrollIntoViewIfNeeded();const r=(await card.boundingBox())!;
      expect(r.x).toBeGreaterThanOrEqual(0);expect(r.x+r.width).toBeLessThanOrEqual(viewport.width);expect(r.height).toBeGreaterThanOrEqual(44);
    }
    await page.locator('#ad-courses button[data-course="1"]').click();await expect(page.locator('#ad-courses button[data-course="1"]')).toBeFocused();
    await page.locator('#ad-actions button').scrollIntoViewIfNeeded();await expect(page.locator('#ad-actions button')).toBeInViewport();
    await page.screenshot({path:info.outputPath(`menu-${viewport.width}x${viewport.height}-${language}.png`)});
    await page.locator('#ad-actions button').click();await page.keyboard.press('Escape');await expect(page.locator('#alpine')).toHaveAttribute('data-phase','paused');
    for(const id of ['left','right'])expect((await page.locator(`#ad-${id}`).boundingBox())!.height).toBeGreaterThanOrEqual(44);
  }
});
