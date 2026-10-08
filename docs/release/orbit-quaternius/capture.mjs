import {chromium} from '@playwright/test';
import fs from 'node:fs';
const out=new URL('.',import.meta.url).pathname;
const browser=await chromium.launch({executablePath:'/usr/bin/chromium',args:['--no-sandbox','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
const reports=[];
for(const [phase,port] of [['before',4353],['after',4352]]) {
 const context=await browser.newContext({viewport:{width:800,height:600},deviceScaleFactor:1});const page=await context.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto(`http://127.0.0.1:${port}/orbit-review/${phase==='after'?'?candidate':''}`);await page.waitForFunction(()=>document.querySelector('canvas')?.dataset.ready==='true');
 await page.screenshot({path:`${out}/${phase}-closeup.png`});reports.push({phase,type:'closeup',model:await page.evaluate(()=>window.review),errors});await context.close();
 const mobile=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true,deviceScaleFactor:1,locale:'ja-JP'});const p=await mobile.newPage();const err=[];p.on('pageerror',e=>err.push(e.message));
 await p.addInitScript(()=>{
  const raf=requestAnimationFrame.bind(window);window.held=false;window.requestAnimationFrame=cb=>raf(now=>{if(window.held)window.next=cb,window.frozenTime=now;else cb(now)});
  window.stats={calls:0,triangles:0};const proto=WebGL2RenderingContext.prototype;const clear=proto.clear;proto.clear=function(m){window.stats.calls=0;window.stats.triangles=0;return clear.call(this,m)};
  for(const name of ['drawElements','drawElementsInstanced','drawArrays']) {const original=proto[name];proto[name]=function(...a){window.stats.calls++;if(a[0]===4)window.stats.triangles+=(name==='drawArrays'?a[2]:a[1])/3*(name==='drawElementsInstanced'?a[4]:1);return original.apply(this,a)}}
 });
 await p.goto(`http://127.0.0.1:${port}/games/orbit-ribbon/?lang=ja`);await p.waitForFunction(()=>document.querySelector('canvas')?.dataset.artAdopted==='true');
 await p.addStyleTag({content:'astro-dev-toolbar{display:none!important}'});const start=await p.getByRole('button',{name:'ステージ 1 をはじめる'}).boundingBox();await p.evaluate(()=>window.held=true);await p.waitForFunction(()=>!!window.next,null,{polling:50});
 await p.touchscreen.tap(start.x+start.width/2,start.y+start.height/2);await p.evaluate(()=>window.next(window.frozenTime));await p.screenshot({path:`${out}/${phase}-mobile.png`});
 reports.push({phase,type:'mobile',state:await p.locator('#game').evaluate(e=>Object.fromEntries(Object.entries(e.dataset).filter(([k])=>!k.startsWith('astro')))),canvas:await p.locator('canvas').evaluate(c=>({width:c.width,height:c.height,...c.dataset})),stats:await p.evaluate(()=>window.stats),errors:err});await mobile.close();
}
fs.writeFileSync(out+'/comparison.json',JSON.stringify({method:'Same stage1 x=0 start, native tap then first frame held only for capture; unchanged camera, lights, physical state and framebuffer. Closeup isolates runtime-adopted materials with same lights/camera for both models.',reports},null,2));
await browser.close();
