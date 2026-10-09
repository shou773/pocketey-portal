import { chromium } from '@playwright/test';
import { createServer } from 'node:http';
import { readFile, stat, mkdir, writeFile, readdir } from 'node:fs/promises';
import path from 'node:path';
import { createHash } from 'node:crypto';
const before=process.argv[2];if(!before)throw new Error('Expected baseline dist path');
const out='test-results/conveyor/comparison';await mkdir(out,{recursive:true});
const types={'.html':'text/html','.js':'text/javascript','.css':'text/css','.json':'application/json','.png':'image/png','.svg':'image/svg+xml','.glb':'model/gltf-binary','.wav':'audio/wav','.ogg':'audio/ogg','.mp3':'audio/mpeg'};
async function serve(root,port){const server=createServer(async(req,res)=>{try{let file=path.join(root,decodeURIComponent(new URL(req.url,'http://localhost').pathname));if((await stat(file)).isDirectory())file=path.join(file,'index.html');res.setHeader('Content-Type',types[path.extname(file)]??'application/octet-stream');res.end(await readFile(file));}catch{res.statusCode=404;res.end('Not found');}});await new Promise(resolve=>server.listen(port,'127.0.0.1',resolve));return server;}
const servers=[await serve(before,4352),await serve(path.resolve('dist'),4353)];
const browser=await chromium.launch({args:['--no-sandbox','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
async function manifest(root,prefix=''){
 const result={};for(const entry of await readdir(path.join(root,prefix),{withFileTypes:true})){
  const name=path.join(prefix,entry.name);if(entry.isDirectory())Object.assign(result,await manifest(root,name));
  else result[name]=createHash('sha256').update(await readFile(path.join(root,name))).digest('hex');
 }return result;
}
const baselineFiles=await manifest(before),candidateFiles=await manifest(path.resolve('dist'));
const files=[...new Set([...Object.keys(baselineFiles),...Object.keys(candidateFiles)])].sort();
const fileComparison={identical:files.filter(p=>baselineFiles[p]&&baselineFiles[p]===candidateFiles[p]),different:files.filter(p=>baselineFiles[p]!==candidateFiles[p])};
const report=[];
const missions=[
 {id:'first-dispatch',steps:[['a',1],['b',1]]},
 {id:'factory-loop',steps:[['a',3],['c',1],['d',1],['e',1],['g',1]]},
 {id:'read-the-inlet',steps:[['a',1],['b',1],['c',1],['d',1],['g',2]]},
 {id:'choose-a-route',steps:[['a',1],['d',1],['e',1]]},
];
try{
 for(const[label,port]of[['before',4352],['after',4353]])for(const viewport of[{width:320,height:568},{width:390,height:844}]){
  const context=await browser.newContext({viewport,deviceScaleFactor:1,hasTouch:true,isMobile:true,locale:'en-US',reducedMotion:'reduce'});
  // Menu-unlock fixture only. Every delivery below is solved and run through ordinary input.
  await context.addInitScript(()=>localStorage.setItem('pocketey-conveyor-campaign-v3',JSON.stringify({version:3,active:'first-dispatch',records:{'first-dispatch':{best:2},'factory-loop':{best:7},'read-the-inlet':{best:6}}})));
  const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));await page.goto(`http://127.0.0.1:${port}/prototypes/conveyor/?lang=en`);
  const root=page.locator('#conveyor');await page.waitForFunction(()=>document.querySelector('#conveyor')?.getAttribute('data-render-pending')==='false');
  if(await root.getAttribute('data-webgl')!=='true')throw Error(`${label} has no WebGL`);
  for(const mission of missions){
   await page.locator(`button[data-mission="${mission.id}"]`).tap();await page.locator('#cv-reset').tap();
   for(const[id,count]of mission.steps)for(let n=0;n<count;n++)await page.locator(`button[data-tile="${id}"]`).tap();
   await page.locator('#cv-play').tap();await page.waitForFunction(()=>document.querySelector('#conveyor').dataset.renderPending==='false');
   // Short, uninterrupted delivery sample. Record the actual start elapsed time; no warm-up/outlier exclusions.
   const timing=await page.evaluate(()=>new Promise(resolve=>{const rows=[],root=document.querySelector('#conveyor'),initialElapsed=Number(root.dataset.elapsed),initialRenderedFrames=Number(root.dataset.frames);let last=performance.now();function tick(time){const d=root.dataset;rows.push({delta:time-last,renderedFrames:Number(d.frames),draws:Number(d.drawCalls),triangles:Number(d.triangles),renderMs:Number(d.renderMs),elapsed:Number(d.elapsed),phase:d.phase});last=time;if(d.phase==='running')requestAnimationFrame(tick);else{const sorted=rows.map(r=>r.delta).sort((a,b)=>a-b);resolve({initialElapsed,initialRenderedFrames,rows,rafFps:rows.length*1000/rows.reduce((n,r)=>n+r.delta,0),renderedFps:(Number(d.frames)-initialRenderedFrames)*1000/rows.reduce((n,r)=>n+r.delta,0),p95:sorted[Math.floor(sorted.length*.95)],maxDraws:Math.max(...rows.map(r=>r.draws)),maxTriangles:Math.max(...rows.map(r=>r.triangles))});}}requestAnimationFrame(tick);}));
   if(await root.getAttribute('data-phase')!=='success')throw Error(`Uninterrupted ${mission.id} did not clear`);
   if(timing.maxDraws>90||timing.maxTriangles>15000)throw Error('Existing geometry budget exceeded');
   const tag=`${label}-${mission.id}-${viewport.width}`;
   await page.locator('#cv-board').evaluate(el=>el.scrollIntoView({block:'center',behavior:'instant'}));await page.screenshot({path:`${out}/${tag}-delivered.png`});await page.locator('#cv-canvas').screenshot({path:`${out}/${tag}-delivered-board.png`});
   const delivered=await root.evaluate(el=>({...el.dataset}));
   // Separate ordinary replay, paused with Escape for a stable in-transit view. No state writes.
   await page.locator('#cv-play').tap();await page.locator('#cv-play').tap();
   await page.waitForFunction(()=>Number(document.querySelector('#conveyor').dataset.elapsed)>.72,null,{polling:25});await page.keyboard.press('Escape');
   await page.waitForFunction(()=>{const d=document.querySelector('#conveyor').dataset;return d.phase==='paused'&&d.renderPending==='false';});
   await page.locator('#cv-board').evaluate(el=>el.scrollIntoView({block:'center',behavior:'instant'}));await page.screenshot({path:`${out}/${tag}-in-transit-paused.png`});await page.locator('#cv-canvas').screenshot({path:`${out}/${tag}-in-transit-board.png`});
   const transit=await root.evaluate(el=>({...el.dataset}));await page.locator('#cv-play').tap();await page.waitForFunction(()=>document.querySelector('#conveyor').dataset.phase==='success');
   const environment=await page.locator('#cv-canvas').evaluate(canvas=>{const gl=canvas.getContext('webgl2'),ext=gl.getExtension('WEBGL_debug_renderer_info');return{viewport:[innerWidth,innerHeight],framebuffer:[canvas.width,canvas.height],dpr:devicePixelRatio,hover:matchMedia('(hover:hover)').matches,fine:matchMedia('(pointer:fine)').matches,reducedMotion:matchMedia('(prefers-reduced-motion:reduce)').matches,renderer:ext?gl.getParameter(ext.UNMASKED_RENDERER_WEBGL):gl.getParameter(gl.RENDERER)};});
   report.push({label,mission:mission.id,viewport,timing,delivered,transit,environment,errors:[...errors]});
  }
  if(errors.length)throw Error(errors.join('\n'));await context.close();
 }
 for(const after of report.filter(r=>r.label==='after')){const before=report.find(r=>r.label==='before'&&r.mission===after.mission&&r.viewport.width===after.viewport.width);if(before.timing.maxDraws!==after.timing.maxDraws||before.timing.maxTriangles!==after.timing.maxTriangles)throw Error('Paint changed matched geometry counters');}
}finally{
 await writeFile(`${out}/report.json`,JSON.stringify({source:process.env.SOURCE_SHA,baseline:'3da9ca63377deabe372c911a47d6825cc6d2d15f',note:'Only existing parcel/bay paints differ. Actual ordinary-input deliveries on all four boards at320/390. In-transit images are separate Escape-paused replays. Timing is a short uninterrupted delivery sample beginning at recorded initialElapsed, with no screenshots or outlier exclusions during measurement. rafFps is observer cadence; renderedFps uses actual data-frames deltas because the game intentionally renders dirty frames at30Hz. This is diagnostic rather than an FPS gate or physical-device claim.',browser:browser.version(),fileComparison,samples:report},null,2));
 await browser.close();for(const server of servers)server.close();
}
