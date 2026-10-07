// Exploratory local diagnostic; not a completion or release test.
import {chromium} from 'playwright-core';
import fs from 'node:fs';
const b=await chromium.launch({executablePath:'/usr/bin/chromium',args:['--no-sandbox','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
const results=[];
for(const game of ['orbit-ribbon','amber-step']) {
 const c=await b.newContext({viewport:{width:1280,height:720},deviceScaleFactor:1});const p=await c.newPage();const s=await c.newCDPSession(p);await s.send('Performance.enable');
 await p.goto('http://localhost:4322/games/'+game+'/');await p.getByRole('button',{name:'ステージ 1 をはじめる'}).click();
 for(const scale of [1,.7,1,.7,1,.7]) {
  await s.send('Emulation.setDeviceMetricsOverride',{width:1280,height:720,deviceScaleFactor:scale,mobile:false});await p.reload();await p.getByRole('button',{name:'ステージ 1 をはじめる'}).click();await p.waitForTimeout(300);
  const before=await s.send('Performance.getMetrics');
  const sample=await p.evaluate(async()=>{let last=performance.now();const a=[];await new Promise(r=>{function f(t){a.push(t-last);last=t;if(a.length<110)requestAnimationFrame(f);else r();}requestAnimationFrame(f)});const sorted=a.slice(10).sort((a,b)=>a-b);const cv=document.querySelector('canvas');const gl=cv.getContext('webgl2'), ext=gl.getExtension('WEBGL_debug_renderer_info');return {fps:1000/(sorted.reduce((a,b)=>a+b)/sorted.length),p95:sorted[Math.floor(sorted.length*.95)],pixels:[cv.width,cv.height],geometries:document.querySelector('#game').dataset.geometries,mode:document.querySelector('#game').dataset.mode,renderer:gl.getParameter(ext.UNMASKED_RENDERER_WEBGL)}});
  const after=await s.send('Performance.getMetrics');const delta={};for(const name of ['TaskDuration','ScriptDuration','LayoutDuration','RecalcStyleDuration','LayoutCount','RecalcStyleCount'])delta[name]=after.metrics.find(x=>x.name===name).value-before.metrics.find(x=>x.name===name).value;
  results.push({game,scale,...sample,delta});console.log(JSON.stringify(results.at(-1)));
 }
 await c.close();
}
await b.close();fs.writeFileSync(process.argv[2]||'/tmp/pocketey-diagnosis.json',JSON.stringify({browser:await b.version(),results},null,2));
