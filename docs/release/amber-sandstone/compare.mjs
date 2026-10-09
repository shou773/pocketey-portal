import {chromium} from '@playwright/test';
import fs from 'node:fs/promises';
const browser=await chromium.launch({executablePath:'/usr/bin/chromium',args:['--no-sandbox','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
const records=[];
for(const mobile of [true,false])for(const phase of ['before','after','after','before']){
 const context=await browser.newContext({viewport:mobile?{width:390,height:844}:{width:1280,height:900},hasTouch:mobile,isMobile:mobile,deviceScaleFactor:1});
 const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto(`http://127.0.0.1:${phase==='before'?4381:4386}/games/amber-step/?lang=en`);
 await page.locator('canvas[data-art-adopted=true]').waitFor();
 await page.getByRole('button',{name:'Start stage 1',exact:true}).click();
 // Standing at the same safe initial position keeps the live app/animation/renderer
 // active while avoiding a scripted player's timing differences in the comparison.
 const sample=await page.evaluate(async()=>{
  const samples=[];let previous=0;
  await new Promise(resolve=>{const frame=t=>{if(previous)samples.push(t-previous);previous=t;if(samples.length<220)requestAnimationFrame(frame);else resolve();};requestAnimationFrame(frame);});
  const sorted=samples.slice(20).sort((a,b)=>a-b),canvas=document.querySelector('canvas'),gl=canvas.getContext('webgl2'),ext=gl.getExtension('WEBGL_debug_renderer_info');
  return{fps:1000/(sorted.reduce((a,b)=>a+b,0)/sorted.length),p95:sorted[Math.floor(sorted.length*.95)],samples,framebuffer:[canvas.width,canvas.height],renderer:gl.getParameter(ext.UNMASKED_RENDERER_WEBGL),state:{...document.querySelector('#game').dataset}};
 });
 records.push({phase,mobile,errors,...sample});console.log({phase,mobile,fps:sample.fps,p95:sample.p95});await context.close();
}
await browser.close();await fs.writeFile(new URL('./evidence/performance.json',import.meta.url),JSON.stringify({protocol:'Built native route, real clock, same safe stage-1 starting position, 220 intervals per row (20 warmup omitted), balanced before/after/after/before per viewport, one active page.',records},null,2));
if(records.some(r=>r.errors.length||r.state.mode!=='play'||r.state.status!=='running'))process.exitCode=1;
