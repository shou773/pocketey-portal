import { chromium } from '@playwright/test';
import { createServer } from 'node:http';
import { readFile,stat,mkdir,writeFile,readdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import path from 'node:path';
import { play } from '../tests/games/input.ts';
const before=process.argv[2];if(!before)throw new Error('Expected immutable baseline dist');
const out='test-results/orbit-signals/comparison';await mkdir(out,{recursive:true});
const types={'.html':'text/html','.js':'text/javascript','.css':'text/css','.json':'application/json','.png':'image/png','.svg':'image/svg+xml','.glb':'model/gltf-binary','.wav':'audio/wav','.ogg':'audio/ogg','.mp3':'audio/mpeg'};
async function serve(root,port){const server=createServer(async(req,res)=>{try{let file=path.join(root,decodeURIComponent(new URL(req.url,'http://localhost').pathname));if((await stat(file)).isDirectory())file=path.join(file,'index.html');res.setHeader('Content-Type',types[path.extname(file)]??'application/octet-stream');res.end(await readFile(file));}catch{res.statusCode=404;res.end('Not found');}});await new Promise(resolve=>server.listen(port,'127.0.0.1',resolve));return server;}
async function manifest(root,prefix=''){const result={};for(const entry of await readdir(path.join(root,prefix),{withFileTypes:true})){const name=path.join(prefix,entry.name);if(entry.isDirectory())Object.assign(result,await manifest(root,name));else result[name]=createHash('sha256').update(await readFile(path.join(root,name))).digest('hex');}return result;}
const a=await manifest(before),b=await manifest(path.resolve('dist')),files=[...new Set([...Object.keys(a),...Object.keys(b)])].sort();
const fileComparison={identical:files.filter(p=>a[p]&&a[p]===b[p]),different:files.filter(p=>a[p]!==b[p])};
const servers=[await serve(before,4358),await serve(path.resolve('dist'),4359)],browser=await chromium.launch({args:['--no-sandbox','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
const samples=[],benchmarks=[];
async function benchmark(port,label,kind){
 const viewport={width:1280,height:kind==='orbit'?800:720};
 const context=await browser.newContext({viewport,deviceScaleFactor:1,hasTouch:false,isMobile:false,locale:'en-US'});
 try{
  await context.addInitScript(()=>localStorage.setItem('pocketey-orbit-amber-v1',JSON.stringify({version:1,sound:false,orbit:{unlocked:3},amber:{unlocked:3}})));
  const page=await context.newPage();await page.goto(`http://127.0.0.1:${port}/games/${kind==='orbit'?'orbit-ribbon':'amber-step'}/?lang=en`);
  await page.waitForFunction(()=>document.querySelector('#scene').dataset.artAdopted==='true');await page.waitForTimeout(300);
  await page.locator('#stages button').nth(2).click();if(kind==='amber')await page.locator('#sound').click();
  await page.getByRole('button',{name:'Start stage 3',exact:true}).click();
  const measurement=page.evaluate(async()=>{
   const intervals=[];let last=performance.now();await new Promise(resolve=>{function frame(now){intervals.push(now-last);last=now;if(intervals.length<200)requestAnimationFrame(frame);else resolve();}requestAnimationFrame(frame);});
   const sorted=intervals.slice(10).sort((a,b)=>a-b),canvas=document.querySelector('canvas'),gl=canvas.getContext('webgl2'),ext=gl.getExtension('WEBGL_debug_renderer_info');
   return{fps:1000/(sorted.reduce((a,b)=>a+b,0)/sorted.length),p95:sorted[Math.floor(sorted.length*.95)],intervals,viewport:[innerWidth,innerHeight],framebuffer:[canvas.width,canvas.height],hover:matchMedia('(hover:hover)').matches,finePointer:matchMedia('(pointer:fine)').matches,maxTouchPoints:navigator.maxTouchPoints,renderer:ext?gl.getParameter(ext.UNMASKED_RENDERER_WEBGL):gl.getParameter(gl.RENDERER),state:{...document.querySelector('#game').dataset}};
  });
  let failure=null;try{await play(page,kind,2,false);}catch(error){failure=String(error);}
  const measured=await measurement,result={label,kind,soundEnabled:kind==='amber',...measured,passesExistingBudget:measured.fps>=45&&measured.p95<=40,end:await page.locator('#game').evaluate(el=>({...el.dataset})),failure};benchmarks.push(result);
  await writeFile(`${out}/${label}-${kind}-benchmark.json`,JSON.stringify(result,null,2));
  await page.screenshot({path:`${out}/${label}-${kind}-course3-clear.png`});if(failure)throw new Error(failure);
 }finally{await context.close();}
}
try{for(const[label,port]of[['before',4358],['after',4359]])for(const viewport of[{width:390,height:844},{width:1280,height:800}]){
 const touch=viewport.width<700,context=await browser.newContext({viewport,deviceScaleFactor:1,hasTouch:touch,isMobile:touch,locale:'en-US'});
 // Draw counters observe WebGL only; no simulation state or render calls change.
 await context.addInitScript(()=>{window.__draws={calls:0,triangles:0};for(const[name,countIndex,instanceIndex]of[['drawArrays',2,null],['drawElements',1,null],['drawArraysInstanced',2,3],['drawElementsInstanced',1,4]]){const original=WebGL2RenderingContext.prototype[name];WebGL2RenderingContext.prototype[name]=function(...args){window.__draws.calls++;if(args[0]===4)window.__draws.triangles+=args[countIndex]/3*(instanceIndex===null?1:args[instanceIndex]);return original.apply(this,args);};}});
 const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));await page.goto(`http://127.0.0.1:${port}/games/orbit-ribbon/?lang=en`);await page.waitForFunction(()=>document.querySelector('#scene').dataset.artAdopted==='true');
 await page.screenshot({path:`${out}/${label}-menu-${viewport.width}.png`});await page.getByRole('button',{name:'Start stage 1',exact:true}).click();
 const read=()=>page.locator('#game').evaluate(el=>({...el.dataset}));let held=false;
 async function approach(target){const started=Date.now();let s=await read();while(s.status==='running'&&Number(s.x)<target&&Date.now()-started<10000){const z=Number(s.z),want=Number(s.x)>6&&z<2.78;if(want!==held){await page.keyboard[want?'down':'up']('ArrowRight');held=want;}await page.waitForTimeout(20);s=await read();}if(s.status!=='running'||Number(s.x)<target)throw new Error(`Capture approach failed ${JSON.stringify(s)}`);return s;}
 const approachState=await approach(10);if(held){await page.keyboard.up('ArrowRight');held=false;}await page.screenshot({path:`${out}/${label}-signal-approach-${viewport.width}.png`});
 const draw=await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>{window.__draws={calls:0,triangles:0};requestAnimationFrame(()=>resolve({...window.__draws}));})));
 const collectedState=await approach(14.9);if(held){await page.keyboard.up('ArrowRight');held=false;}await page.screenshot({path:`${out}/${label}-signal-passed-${viewport.width}.png`});
 if(held)await page.keyboard.up('ArrowRight');const final=await read();
 const sample={label,viewport,hasTouch:touch,isMobile:touch,approachState,collectedState,final,draw,errors};samples.push(sample);await writeFile(`${out}/${label}-${viewport.width}-capture.json`,JSON.stringify(sample,null,2));if(label==='after'&&final.signals!=='1')throw new Error(`The ordinary first pickup was not collected: ${JSON.stringify(final)}`);if(errors.length)throw new Error(errors.join('\n'));
 await page.goto(`http://127.0.0.1:${port}/games/amber-step/?lang=en`);await page.waitForFunction(()=>document.querySelector('#scene').dataset.artAdopted==='true');await page.screenshot({path:`${out}/${label}-amber-menu-${viewport.width}.png`});
 if((await page.locator('meta[name="description"]').getAttribute('content')).includes('signals'))throw new Error('Amber metadata incorrectly advertises signals');await context.close();
}for(const[label,port]of[['before',4358],['after',4359]])for(const kind of['orbit','amber'])await benchmark(port,label,kind);await writeFile(`${out}/report.json`,JSON.stringify({benchmarks,baseline:'190772d0a31e61caee9bab1fb0886209c96b873a',browser:browser.version(),fileComparison,samples,note:'Actual ordinary-keyboard approaches in desktop/mobile-emulated viewports. No game-state writes or hidden overlays. Close live positions are recorded, not claimed pixel-identical. Amber shares the compiled module but has no signal mesh/HUD/storage access during normal play.'},null,2));if(benchmarks.some(b=>b.label==='after'&&!b.passesExistingBudget))throw new Error('Candidate matched software-rendering budget remains below45FPS or above40ms; see uncensored benchmark JSON.');}finally{await writeFile(`${out}/scope.json`,JSON.stringify({baseline:'190772d0a31e61caee9bab1fb0886209c96b873a',fileComparison,samples,benchmarks},null,2));await browser.close();for(const s of servers)s.close();}
