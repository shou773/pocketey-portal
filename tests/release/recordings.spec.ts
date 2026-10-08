import {test,expect} from '@playwright/test';
import {writeFile} from 'node:fs/promises';
import {installAudioCapture,stopAudioCapture} from './capture-audio';
import {play} from '../games/input';
for(const kind of ['orbit','amber','pulse','tilt'] as const)test(`${kind}: actual play capture includes the delivered music and effects`,async({page},info)=>{
 test.skip(info.project.name!=='chromium','Canvas/Opus recorder evidence is generated once in Chromium. Codec/lifecycle tests run in every engine.');
 test.setTimeout(65000);await page.setViewportSize({width:390,height:844});await installAudioCapture(page);
 const slug={orbit:'orbit-ribbon',amber:'amber-step',pulse:'pulse-drift',tilt:'tilttrail'}[kind];
 const root=kind==='tilt'?'#tilttrail':kind==='pulse'?'#pulse':'#game';
 await page.goto(`/games/${slug}/?lang=en`);await page.locator(kind==='tilt'?'#tt-sound':'#sound').click();
 await page.getByRole('button',{name:kind==='tilt'?'Play this stage':kind==='pulse'?'Launch':'Start stage 1',exact:true}).click();
 await page.locator(kind==='tilt'?'#tt-pause':'#pause').click();await expect(page.locator(root)).toHaveAttribute('data-music','ready');
 await page.getByRole('button',{name:'Resume',exact:true}).last().click();await expect(page.locator(root)).toHaveAttribute('data-audio-loops','1');
 if(kind==='orbit'||kind==='amber')await play(page,kind,0,false);
 else if(kind==='tilt'){
  await page.keyboard.down('Space');await page.waitForTimeout(4000);await page.keyboard.up('Space');
  await page.keyboard.down('ArrowRight');await expect(page.locator(root)).toHaveAttribute('data-phase','failed',{timeout:6000});await page.keyboard.up('ArrowRight');
 }else{
  for(let i=0;i<4;i++){await page.keyboard.down(i%2?'ArrowLeft':'ArrowRight');await page.waitForTimeout(1800);await page.keyboard.up(i%2?'ArrowLeft':'ArrowRight');}
  if(await page.locator('#pause').isEnabled())await page.locator('#pause').click();
 }
 await page.waitForTimeout(1000);await expect(page.locator(root)).toHaveAttribute('data-audio-loops','0');
 const video=await stopAudioCapture(page);expect(video.length).toBeGreaterThan(10000);await writeFile(info.outputPath(`${kind}-music-effects-play.webm`),video);
 await info.attach('capture-audio-state.json',{body:JSON.stringify(await page.locator(root).evaluate(e=>({... (e as HTMLElement).dataset})),null,2),contentType:'application/json'});
});
