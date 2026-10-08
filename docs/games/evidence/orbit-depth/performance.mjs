import {chromium} from '@playwright/test';
import fs from 'node:fs';
const browser=await chromium.launch({executablePath:'/usr/bin/chromium',args:['--no-sandbox','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
const reports=[];
try {
 for(const width of [390,1280])for(let round=0;round<3;round++)for(const phase of round%2?['after','before']:['before','after']) {
  const context=await browser.newContext({viewport:{width,height:width===390?844:720},isMobile:width===390,hasTouch:width===390,deviceScaleFactor:1});
  const page=await context.newPage();await page.goto(`http://127.0.0.1:${phase==='before'?4323:4322}/games/orbit-ribbon/`);
  const result=await page.evaluate(async()=>{
   const original=document.querySelector('canvas');const size={width:original.clientWidth,height:original.clientHeight};
   // Diagnostic isolated renderer, not screenshot or a normal-input release test.
   document.body.innerHTML=`<canvas style="width:${size.width}px;height:${size.height}px"></canvas>`;
   const canvas=document.querySelector('canvas');const {createView}=await import('/src/games/render.ts');const {createState}=await import('/src/games/model.ts');
   const view=createView(canvas,'orbit');const state=createState('orbit',2);view.load(2);
   while(canvas.dataset.artAdopted!=='true'){await new Promise(requestAnimationFrame);view.draw(state)}
   const samples=[];const cpu=[];let last;
   for(let i=0;i<150;i++) {
    const now=await new Promise(requestAnimationFrame);if(last!==undefined&&i>30)samples.push(now-last);last=now;
    const start=performance.now();view.draw(state);if(i>30)cpu.push(performance.now()-start);
   }
   const gl=canvas.getContext('webgl2'),ext=gl.getExtension('WEBGL_debug_renderer_info');
   const sorted=[...samples].sort((a,b)=>a-b);return {fps:1000/(samples.reduce((a,b)=>a+b)/samples.length),p95:sorted[Math.floor(sorted.length*.95)],meanSubmissionMs:cpu.reduce((a,b)=>a+b)/cpu.length,rawIntervals:samples,cpu,stats:{calls:view.renderer.info.render.calls,triangles:view.renderer.info.render.triangles},canvas:[canvas.width,canvas.height],renderer:gl.getParameter(ext.UNMASKED_RENDERER_WEBGL)};
  });
  reports.push({width,round,phase,...result});await context.close();
 }
 fs.writeFileSync(new URL('./performance.json',import.meta.url),JSON.stringify({method:'Three alternating rounds for each of 390x844 and 1280x720 DPR1 SwiftShader; isolated Orbit stage-3 starting renderer, 30 warmup plus 119 measured frames. State does not advance. No other browser tests run concurrently. This is a short rendering regression probe, not full-stage release gates or physical-device evidence.',browser:browser.version(),reports},null,2));
 console.log(reports.map(({round,phase,fps,p95,meanSubmissionMs,stats})=>({round,phase,fps,p95,meanSubmissionMs,stats})));
}finally{await browser.close()}
