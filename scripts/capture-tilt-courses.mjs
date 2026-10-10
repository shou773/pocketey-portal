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
    const fps=1000/(sorted.reduce((a,b)=>a+b,0)/sorted.length),p95=sorted[Math.floor(sorted.length*.95)],full=intervals.slice().sort((a,b)=>a-b);
    const uncensored={frames:full.length,fps:1000/(full.reduce((a,b)=>a+b,0)/full.length),p95:full[Math.floor(full.length*.95)],max:Math.max(...full)};
    return {uncensored,legacyGateNote:'The retained budget excludes the first ten intervals; uncensored metrics retain every interval.',hover:matchMedia('(hover:hover)').matches,finePointer:matchMedia('(pointer:fine)').matches,maxTouchPoints:navigator.maxTouchPoints,fps,p95,passesExistingBudget:fps>=45&&p95<=40,intervals,framebuffer:[canvas.width,canvas.height],renderer:ext?gl.getParameter(ext.UNMASKED_RENDERER_WEBGL):gl.getParameter(gl.RENDERER),state:{...document.querySelector('#tilttrail').dataset}};
   });
   await page.keyboard.up('Space');results.push({viewport,hasTouch:touch,isMobile:touch,...result});
   if(result.state.phase!=='playing')throw new Error('Fixed course3 timing interrupted');
  }finally{await context.close();}
 }
 return results;
}
async function captureMotifs(browser){
 const result=[];
 for(const width of [320,390]){
  const context=await browser.newContext({viewport:{width,height:844},deviceScaleFactor:1,hasTouch:true,isMobile:true,locale:'en-US'});
  // Selection-only fixture. Native tests separately earn course6 with keyboard and touch.
  await context.addInitScript(()=>localStorage.setItem('pocketey-tilttrail-campaign-v2',JSON.stringify({version:2,muted:true,records:{'first-bends':10,'wave-corridor':20,'sky-ridge':30,'breathing-bends':40,'double-apex':50}})));
  try{
   const page=await context.newPage();await page.goto('http://127.0.0.1:4357/games/tilttrail/?lang=en');
   await page.locator('button[data-stage="5"]').click();await page.getByRole('button',{name:'Play this stage',exact:true}).click();
   const read=()=>page.locator('#tilttrail').evaluate(el=>Object.fromEntries(Object.entries(el.dataset).map(([k,v])=>[k,['x','z','vx','speed','time'].includes(k)?Number(v):v])));
   let active=[],state=await read();const started=Date.now();
   for(const [label,target] of [['neck1',25],['approach',35],['neck2',49]]){
    while(state.phase==='playing'&&state.z<target&&Date.now()-started<90000){
     const road=track(5,state.z),future=track(5,state.z+.7),diff=(future.x-road.x)/.7*state.speed+(road.x-state.x)*3-state.vx;
     const keys=[diff>.3?'ArrowRight':diff<-.3?'ArrowLeft':'','Space'].filter(Boolean);
     for(const key of active.filter(k=>!keys.includes(k)))await page.keyboard.up(key);
     for(const key of keys.filter(k=>!active.includes(k)))await page.keyboard.down(key);
     active=keys;await page.waitForTimeout(65);state=await read();
    }
    if(state.phase!=='playing'||state.z<target)throw new Error(`Native neck approach failed: ${JSON.stringify(state)}`);
    // Straight neck: hold only the normal brake during capture to avoid lateral overshoot.
    for(const key of active.filter(k=>k!=='Space'))await page.keyboard.up(key);active=['Space'];
    const before=await read();await page.screenshot({path:`${out}/after-course6-${label}-native-${width}.png`});
    state=await read();result.push({viewport:width,label,target,before,after:state,held:active,note:'Live diagnostic image, ordinary conservative keyboard input; only selection uses a save fixture. No hidden overlays or state writes.'});
    if(state.phase!=='playing')throw new Error(`Neck image ended outside gameplay: ${JSON.stringify(state)}`);
   }
   for(const key of active)await page.keyboard.up(key);
  }finally{await context.close();}
 }
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
}const fixedComparison={before:await fixedCourseComparison(browser,4356),after:await fixedCourseComparison(browser,4357)};const motifs=await captureMotifs(browser);await writeFile(`${out}/report.json`,JSON.stringify({fixedComparison,motifs,baseline:'d00c2aea53b2c292fdccbaf69984d50f24d4a2e2',source:process.env.SOURCE_SHA??process.env.GITHUB_SHA??'local',browser:browser.version(),fileComparison,samples,note:'Actual production renders with both full assets loaded. Live original-course3 states are not pixel-matched. Course6 captures use ordinary conservative input and remain unobscured during active play. Software timing is not a physical-phone benchmark.'},null,2));}finally{await browser.close();for(const s of servers)s.close();}
