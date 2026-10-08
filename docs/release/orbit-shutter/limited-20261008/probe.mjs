import {chromium} from '@playwright/test';
import fs from 'node:fs';
import {play,read} from '../../../../tests/games/input.ts';
const out=new URL('.',import.meta.url).pathname;
const browser=await chromium.launch({executablePath:'/usr/bin/chromium',args:['--no-sandbox','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
const report={method:'Stage3 menu draw comparison only; no gameplay attempts. Identical unlocked3/no-best storage fixture before load. No active state/clock/camera writes, no retries. Draw counters and RAF diagnostics are read-only. Sequential software-rendered local builds, not physical phones or a public HTTPS play check.',builds:[]};
for(const [label,port,sha] of [['published',4411,'7adf12ab464cfbb8e9d4e04917ad9f618a1a5f4b'],['saved-pr22',4412,'09531213a46a24db850faab91ac44a8ed33d26c4']]){
 const context=await browser.newContext({viewport:{width:390,height:844},deviceScaleFactor:1,isMobile:true,hasTouch:true,locale:'ja-JP'});
 const page=await context.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.addInitScript(()=>{
  localStorage.setItem('pocketey-orbit-amber-v1',JSON.stringify({version:1,sound:false,orbit:{unlocked:3,best:[null,null,null],challengeBest:[null,null,null]},amber:{unlocked:1,best:[null,null,null],challengeBest:[null,null,null]}}));
  window.drawStats={calls:0,triangles:0};window.observations=[];
  const pr=WebGL2RenderingContext.prototype,clear=pr.clear;
  pr.clear=function(m){window.drawStats={calls:0,triangles:0};return clear.call(this,m)};
  for(const name of ['drawElements','drawElementsInstanced','drawArrays','drawArraysInstanced']){const fn=pr[name];pr[name]=function(...a){window.drawStats.calls++;if(a[0]===4)window.drawStats.triangles+=(name.startsWith('drawArrays')?a[2]:a[1])/3*(name==='drawElementsInstanced'?a[4]:name==='drawArraysInstanced'?a[3]:1);return fn.apply(this,a)}}
  function sample(now){const g=document.querySelector('#game');if(g?.dataset.mode==='play')window.observations.push({at:performance.timeOrigin+now,...g.dataset,...window.drawStats});requestAnimationFrame(sample)}requestAnimationFrame(sample);
 });
 await page.goto(`http://127.0.0.1:${port}/games/orbit-ribbon/?lang=ja`);
 await page.waitForFunction(()=>document.querySelector('canvas')?.dataset.artAdopted==='true');
 if(label==='saved-pr22')await page.waitForFunction(()=>document.querySelector('canvas')?.dataset.orbitShutter==='ready');
 await page.locator('#stages').getByRole('button',{name:/ステージ 3 /}).click();
 await page.waitForTimeout(250);
 const menu={state:await read(page),...await page.evaluate(()=>({stats:window.drawStats,canvas:{width:document.querySelector('canvas').width,height:document.querySelector('canvas').height}}))};
 await page.screenshot({path:out+label+'-stage3-menu.png'});
 fs.writeFileSync(out+label+'-draw.json',JSON.stringify({label,sha,menu},null,2));
 report.builds.push({label,sha,menu});await context.close();
}
fs.writeFileSync(out+'draw-comparison.json',JSON.stringify(report,null,2));await browser.close();
