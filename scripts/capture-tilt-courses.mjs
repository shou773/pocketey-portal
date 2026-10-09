import { chromium } from '@playwright/test';
import { createServer } from 'node:http';
import { readFile,stat,mkdir,writeFile,readdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import path from 'node:path';
import { track } from '../src/games/prototypes/ball/model.ts';
const before=process.argv[2];if(!before)throw new Error('Expected baseline dist path');
const out='test-results/tilt-courses/comparison';await mkdir(out,{recursive:true});
const types={'.html':'text/html','.js':'text/javascript','.css':'text/css','.json':'application/json','.png':'image/png','.svg':'image/svg+xml','.glb':'model/gltf-binary','.wav':'audio/wav','.ogg':'audio/ogg','.mp3':'audio/mpeg'};
async function serve(root,port){const server=createServer(async(req,res)=>{try{let file=path.join(root,decodeURIComponent(new URL(req.url,'http://localhost').pathname));if((await stat(file)).isDirectory())file=path.join(file,'index.html');res.setHeader('Content-Type',types[path.extname(file)]??'application/octet-stream');res.end(await readFile(file));}catch{res.statusCode=404;res.end('Not found');}});await new Promise(resolve=>server.listen(port,'127.0.0.1',resolve));return server;}
async function manifest(root,prefix=''){const result={};for(const entry of await readdir(path.join(root,prefix),{withFileTypes:true})){const name=path.join(prefix,entry.name);if(entry.isDirectory())Object.assign(result,await manifest(root,name));else result[name]=createHash('sha256').update(await readFile(path.join(root,name))).digest('hex');}return result;}
const a=await manifest(before),b=await manifest(path.resolve('dist')),files=[...new Set([...Object.keys(a),...Object.keys(b)])].sort();
const fileComparison={identical:files.filter(p=>a[p]&&a[p]===b[p]),different:files.filter(p=>a[p]!==b[p])};
const servers=[await serve(before,4356),await serve(path.resolve('dist'),4357)];
async function fixedCourseComparison(browser,port){
 const results=[];
 for(const viewport of [{width:390,height:844},{width:1280,height:800}]){
  const touch=viewport.width<700;
  const context=await browser.newContext({viewport,deviceScaleFactor:1,hasTouch:touch,isMobile:touch,locale:'en-US'});
  try{
   const page=await context.newPage();
   const loaded=Promise.all(['observatory.glb','wind-rock.glb'].map(name=>page.waitForResponse(r=>r.url().endsWith(name)&&r.status()===200)));
   await page.goto(`http://127.0.0.1:${port}/games/tilttrail/?lang=en`);await loaded;await page.waitForTimeout(300);
   await page.locator('button[data-stage="2"]').click();await page.getByRole('button',{name:'Play this stage',exact:true}).click();await page.keyboard.down('Space');
   const result=await page.evaluate(async()=>{
    const intervals=[];let previous=performance.now();
    await new Promise(resolve=>{function frame(now){intervals.push(now-previous);previous=now;if(intervals.length<180)requestAnimationFrame(frame);else resolve();}requestAnimationFrame(frame);});
    const sorted=intervals.slice(10).sort((a,b)=>a-b),canvas=document.querySelector('canvas'),gl=canvas.getContext('webgl2'),ext=gl.getExtension('WEBGL_debug_renderer_info');
    const fps=1000/(sorted.reduce((a,b)=>a+b,0)/sorted.length),p95=sorted[Math.floor(sorted.length*.95)];
    return {hover:matchMedia('(hover:hover)').matches,finePointer:matchMedia('(pointer:fine)').matches,maxTouchPoints:navigator.maxTouchPoints,fps,p95,passesExistingBudget:fps>=45&&p95<=40,intervals,framebuffer:[canvas.width,canvas.height],renderer:ext?gl.getParameter(ext.UNMASKED_RENDERER_WEBGL):gl.getParameter(gl.RENDERER),state:{...document.querySelector('#tilttrail').dataset}};
   });
   await page.keyboard.up('Space');results.push({viewport,hasTouch:touch,isMobile:touch,...result});
   if(result.state.phase!=='playing')throw new Error('Fixed course3 timing interrupted');
  }finally{await context.close();}
 }
 return results;
}
async function captureMotifs(browser){
 const context=await browser.newContext({viewport:{width:390,height:844},deviceScaleFactor:1,hasTouch:true,locale:'en-US'});
 // This unlock fixture only selects the diagnostic courses. Actual clear/save
 // proof is provided separately by the ordinary-input browser tests.
 await context.addInitScript(()=>localStorage.setItem('pocketey-tilttrail-campaign-v2',JSON.stringify({version:2,muted:true,records:{'sky-ridge':30,'breathing-bends':30}})));
 const result=[];
 try{for(const stage of [3,4]){
  const page=await context.newPage();await page.goto('http://127.0.0.1:4357/games/tilttrail/?lang=en');
  await page.locator(`button[data-stage="${stage}"]`).click();await page.getByRole('button',{name:'Play this stage',exact:true}).click();
  const read=()=>page.locator('#tilttrail').evaluate(el=>Object.fromEntries(Object.entries(el.dataset).map(([k,v])=>[k,['x','z','vx','speed','time'].includes(k)?Number(v):v])));
  let active=[];const started=Date.now(),target=stage===3?21:23;let state=await read();
  while(state.phase==='playing'&&state.z<target&&Date.now()-started<50000){
   const road=track(stage,state.z),future=track(stage,state.z+.7),diff=(future.x-road.x)/.7*state.speed+(road.x-state.x)*3-state.vx;
   const keys=[diff>.3?'ArrowRight':diff<-.3?'ArrowLeft':'',road.width<4?'Space':''].filter(Boolean);
   for(const key of active.filter(k=>!keys.includes(k)))await page.keyboard.up(key);
   for(const key of keys.filter(k=>!active.includes(k)))await page.keyboard.down(key);
   active=keys;await page.waitForTimeout(65);state=await read();
  }
  if(state.phase!=='playing'||state.z<target)throw new Error(`Native motif approach failed: ${JSON.stringify(state)}`);
  // The overlay remains naturally hidden during ordinary active gameplay.
  // Keep the current controls held for this one image; no timing or state writes.
  await page.screenshot({path:`${out}/after-course${stage+1}-motif-native-390.png`});
  const after=await read();result.push({stage:stage+1,before:state,after,held:active,note:'Diagnostic live screenshot, ordinary keyboard approach, unlock fixture only. Not a clear proof.'});
  if(after.phase!=='playing')throw new Error(`Motif screenshot ended outside gameplay: ${JSON.stringify(after)}`);
  for(const key of active)await page.keyboard.up(key);await page.close();
 }}finally{await context.close();}
 return result;
}
const browser=await chromium.launch({args:['--no-sandbox','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});const samples=[];
try{for(const[label,port]of[['before',4356],['after',4357]]){
 const context=await browser.newContext({viewport:{width:390,height:844},deviceScaleFactor:1,hasTouch:true,locale:'en-US'});
 await context.addInitScript(()=>localStorage.setItem('pocketey-tilttrail-v1',JSON.stringify({best:[10,20,30],muted:true})));
 const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
 const assets=Promise.all(['observatory.glb','wind-rock.glb'].map(name=>page.waitForResponse(r=>r.url().endsWith(name)&&r.status()===200)));
 await page.goto(`http://127.0.0.1:${port}/games/tilttrail/?lang=en`);await assets;await page.waitForTimeout(300);
 await page.screenshot({path:`${out}/${label}-menu-390.png`});
 await page.locator('button[data-stage="2"]').click();await page.getByRole('button',{name:'Play this stage',exact:true}).click();await page.keyboard.down('Space');
 await page.waitForTimeout(400);await page.screenshot({path:`${out}/${label}-original-course3-390.png`});await page.keyboard.up('Space');
 const state=await page.locator('#tilttrail').evaluate(el=>({...el.dataset}));samples.push({label,state,errors});
 if(errors.length)throw new Error(errors.join('\n'));await context.close();
}const fixedComparison={before:await fixedCourseComparison(browser,4356),after:await fixedCourseComparison(browser,4357)};const motifs=await captureMotifs(browser);await writeFile(`${out}/report.json`,JSON.stringify({fixedComparison,motifs,baseline:'29424ba7300e5ded81bc07b9f2e73f05f078a137',browser:browser.version(),fileComparison,samples,note:'Actual production renders with both full assets loaded. Live original-course3 states are not pixel-matched. New-course captures use ordinary input and visible Pause/Resume. Software timing is not a physical-phone benchmark.'},null,2));}finally{await browser.close();for(const s of servers)s.close();}
