import { test, expect, type Page } from '@playwright/test';
import { writeFile } from 'node:fs/promises';
import { SAVE_KEY, stages } from '../../src/games/model';
import { SIGNAL_SAVE_KEY } from '../../src/games/signals';
import { read } from './input';
import { driveSignals } from './signal-driver';
const url='/games/amber-step/?lang=en';
async function open(page:Page){await page.goto(url);await expect(page.locator('#scene')).toHaveAttribute('data-art-adopted','true');await page.getByRole('button',{name:'Start stage 1',exact:true}).click();}
async function rightTo(page:Page,x:number){await page.keyboard.down('ArrowRight');await expect.poll(async()=>Number((await read(page)).x),{intervals:[20]}).toBeGreaterThanOrEqual(x);await page.keyboard.up('ArrowRight');}
test('first-spike lesson survives waiting and pause, dismisses accessibly and stays dismissed on retry',async({page},info)=>{
  await open(page);await expect(page.locator('#amber-coach')).toBeVisible();await page.waitForTimeout(5600);
  await expect(page.locator('#amber-coach')).toBeVisible();expect((await read(page)).x).toBe('0.000');
  await page.screenshot({path:info.outputPath('first-lesson-after-wait-390.png')});
  await page.keyboard.press('Escape');await expect(page.locator('#amber-coach')).toBeHidden();
  await page.getByRole('button',{name:'Resume',exact:true}).click();await expect(page.locator('#amber-coach')).toBeVisible();
  await page.getByRole('button',{name:'Dismiss jump tip',exact:true}).click();await expect(page.locator('#scene')).toBeFocused();await expect(page.locator('#amber-coach')).toBeHidden();
  await page.keyboard.press('KeyR');await expect(page.locator('#amber-coach')).toBeHidden();
});
test('successful first-spike crossing removes the lesson only after a real landing',async({page},info)=>{
  await open(page);const saved=await page.evaluate(k=>localStorage.getItem(k),SAVE_KEY);
  await rightTo(page,2.2);await page.keyboard.down('ArrowRight');await page.keyboard.press('Space');
  await expect(page.locator('#game')).toHaveAttribute('data-grounded','false');await expect(page.locator('#amber-coach')).toBeVisible();
  await page.waitForFunction(()=>{const d=document.querySelector<HTMLElement>('#game')!.dataset;return d.status==='dead'||(Number(d.x)>4.65&&d.grounded==='true');});
  await page.keyboard.up('ArrowRight');expect((await read(page)).status).toBe('running');await expect(page.locator('#amber-coach')).toBeHidden();
  expect(await page.evaluate(k=>localStorage.getItem(k),SAVE_KEY)).toBe(saved);await page.screenshot({path:info.outputPath('first-spike-landed-390.png')});
});
test('normal input produces spike, fall and edge-spike retry help without record changes',async({page},info)=>{
  const old={version:1,sound:false,orbit:{unlocked:3,best:[12,15,18]},amber:{unlocked:3,best:[10,12,16]}};
  await page.addInitScript(({key,old})=>localStorage.setItem(key,JSON.stringify(old)),{key:SAVE_KEY,old});
  await open(page);const before=await page.evaluate(k=>localStorage.getItem(k),SAVE_KEY),outcomes:unknown[]=[];
  await page.keyboard.down('ArrowRight');await expect(page.locator('#game')).toHaveAttribute('data-status','dead');await page.keyboard.up('ArrowRight');
  await expect(page.locator('#panel-copy')).toContainText('You hit a spike');outcomes.push(await read(page));await page.screenshot({path:info.outputPath('spike-retry-390.png')});
  await page.getByRole('button',{name:'Retry now',exact:true}).click();await rightTo(page,2.2);await page.keyboard.down('ArrowRight');await page.keyboard.press('Space');
  await expect(page.locator('#game')).toHaveAttribute('data-status','dead',{timeout:12000});await page.keyboard.up('ArrowRight');
  await expect(page.locator('#game')).toHaveAttribute('data-failure','fall');await expect(page.locator('#panel-copy')).toContainText('You fell off the platforms');outcomes.push(await read(page));await page.screenshot({path:info.outputPath('fall-retry-390.png')});
  await page.getByRole('button',{name:'Choose a stage',exact:true}).click();await page.locator('#stages button').nth(2).click();await page.getByRole('button',{name:'Start stage 3',exact:true}).click();
  let lastJump=-10;await page.keyboard.down('ArrowRight');
  for(let i=0;i<500;i++){
    const d=await read(page);if(d.status!=='running')break;const x=Number(d.x),tile=stages.amber[2].platforms.find(p=>x>=p.a-.23&&x<=p.b+.23);
    const jump=x<13&&d.grounded==='true'&&x-lastJump>1.5&&((5-x<2&&5-x>0)||(tile&&tile.b-x<1&&tile.b-x>-.15));
    if(jump){await page.keyboard.press('Space');lastJump=x;}await page.waitForTimeout(20);
  }
  await page.keyboard.up('ArrowRight');await expect(page.locator('#game')).toHaveAttribute('data-failure','edge-spike');
  await expect(page.locator('#panel-copy')).toContainText('Jump before the spike and clear it together with the gap');outcomes.push(await read(page));await page.screenshot({path:info.outputPath('edge-spike-retry-390-en.png')});
  await page.locator('[data-language="ja"]').click();await expect(page.locator('#panel-copy')).toContainText('トゲの手前から跳び');await page.screenshot({path:info.outputPath('edge-spike-retry-390-ja.png')});
  expect(await page.evaluate(k=>localStorage.getItem(k),SAVE_KEY)).toBe(before);await writeFile(info.outputPath('observed-failures.json'),JSON.stringify({outcomes,before,after:await page.evaluate(k=>localStorage.getItem(k),SAVE_KEY)},null,2));
});
test('JA/EN coach is readable at320x568 and844x390 without overlapping touch controls',async({page},info)=>{
  await page.emulateMedia({reducedMotion:'reduce'});
  for(const viewport of [{width:320,height:568},{width:844,height:390}])for(const lang of ['ja','en']){
    await page.setViewportSize(viewport);await page.goto(`/games/amber-step/?lang=${lang}`);await expect(page.locator('#scene')).toHaveAttribute('data-art-adopted','true');
    await page.getByRole('button',{name:lang==='en'?'Start stage 1':'ステージ 1 をはじめる',exact:true}).click();
    const coach=page.locator('#amber-coach');await expect(coach).toBeVisible();const b=(await coach.boundingBox())!,dismiss=(await page.locator('#amber-coach-dismiss').boundingBox())!;
    expect(b.x).toBeGreaterThanOrEqual(0);expect(b.x+b.width).toBeLessThanOrEqual(viewport.width);expect(dismiss.width).toBeGreaterThanOrEqual(44);expect(dismiss.height).toBeGreaterThanOrEqual(44);
    for(const input of ['left','right','jump']){const c=(await page.locator(`[data-input="${input}"]`).boundingBox())!;expect(b.x<c.x+c.width&&b.x+b.width>c.x&&b.y<c.y+c.height&&b.y+b.height>c.y).toBe(false);}
    await page.screenshot({path:info.outputPath(`coach-${viewport.width}x${viewport.height}-${lang}.png`)});
    await page.locator('#amber-coach-dismiss').click();await expect(coach).toBeHidden();
  }
});
test('Orbit excludes the coach and still completes its optional collection record',async({page})=>{
  await page.goto('/games/orbit-ribbon/?lang=en');await expect(page.locator('#scene')).toHaveAttribute('data-art-adopted','true');await expect(page.locator('#amber-coach')).toHaveCount(0);
  await page.getByRole('button',{name:'Start stage 1',exact:true}).click();await driveSignals(page,0,true,false,'amber-guidance-shared-orbit');
  const save=await page.evaluate(k=>JSON.parse(localStorage.getItem(k)!),SIGNAL_SAVE_KEY);expect(save.records['first-orbit']).toBe(3);
  await expect(page.locator('#panel-copy')).toContainText('SIGNALS 3 / 3');
});
test('blocked storage and actual context loss leave no stale lesson over recovery',async({page})=>{
  await page.addInitScript(()=>{Object.defineProperty(window,'localStorage',{get(){throw new Error('blocked');}});});await open(page);
  await expect(page.locator('#amber-coach')).toBeVisible();
  expect(await page.locator('#scene').evaluate(el=>{const extension=(el as HTMLCanvasElement).getContext('webgl2')?.getExtension('WEBGL_lose_context');extension?.loseContext();return !!extension;})).toBe(true);
  await expect(page.locator('#game')).toHaveAttribute('data-mode','recovery');await expect(page.locator('#amber-coach')).toBeHidden();await expect(page.getByRole('button',{name:'Reload',exact:true})).toBeVisible();
});
