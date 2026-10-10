import { chromium } from '@playwright/test';
import { createServer } from 'node:http';
import { readFile,stat,mkdir,writeFile,readdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import path from 'node:path';
const before=process.argv[2];if(!before)throw new Error('Expected immutable baseline dist');
const out='test-results/amber-campaign/comparison';await mkdir(out,{recursive:true});
const types={'.html':'text/html','.js':'text/javascript','.css':'text/css','.json':'application/json','.png':'image/png','.svg':'image/svg+xml','.glb':'model/gltf-binary','.wav':'audio/wav','.ogg':'audio/ogg','.mp3':'audio/mpeg'};
async function serve(root,port){const server=createServer(async(req,res)=>{try{let file=path.join(root,decodeURIComponent(new URL(req.url,'http://localhost').pathname));if((await stat(file)).isDirectory())file=path.join(file,'index.html');res.setHeader('Content-Type',types[path.extname(file)]??'application/octet-stream');res.end(await readFile(file));}catch{res.statusCode=404;res.end('Not found');}});await new Promise(resolve=>server.listen(port,'127.0.0.1',resolve));return server;}
async function manifest(root,prefix=''){const result={};for(const entry of await readdir(path.join(root,prefix),{withFileTypes:true})){const name=path.join(prefix,entry.name);if(entry.isDirectory())Object.assign(result,await manifest(root,name));else result[name]=createHash('sha256').update(await readFile(path.join(root,name))).digest('hex');}return result;}
const a=await manifest(before),b=await manifest(path.resolve('dist')),files=[...new Set([...Object.keys(a),...Object.keys(b)])].sort();
const fileComparison={identical:files.filter(p=>a[p]&&a[p]===b[p]),different:files.filter(p=>a[p]!==b[p])};
const servers=[await serve(before,4372),await serve(path.resolve('dist'),4373)],browser=await chromium.launch({args:['--no-sandbox','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
const samples=[];
try {
 for(const [label,port]of[['before',4372],['after',4373]])for(const viewport of[{width:390,height:844},{width:1280,height:800}]) {
  const touch=viewport.width<700,context=await browser.newContext({viewport,deviceScaleFactor:1,hasTouch:touch,isMobile:touch,locale:'en-US'}),page=await context.newPage(),errors=[];
  page.on('pageerror',e=>errors.push(e.message));await page.addInitScript(()=>localStorage.setItem('pocketey-orbit-amber-v1',JSON.stringify({version:1,sound:false,amber:{unlocked:3,best:[10,12,16],challengeBest:[12,16,22]}})));
  await page.goto(`http://127.0.0.1:${port}/games/amber-step/?lang=en`);await page.waitForFunction(()=>document.querySelector('#scene').dataset.artAdopted==='true');
  await page.screenshot({path:`${out}/${label}-menu-${viewport.width}.png`});await page.locator('#stages button').nth(2).click();await page.getByRole('button',{name:'Start stage 3',exact:true}).click();
  const metrics=await page.evaluate(async()=>{const intervals=[],counters=[];let last=performance.now();await new Promise(resolve=>{const frame=now=>{intervals.push(now-last);last=now;const d=document.querySelector('#game').dataset;counters.push({draws:Number(d.drawCalls),triangles:Number(d.triangles)});if(intervals.length<240)requestAnimationFrame(frame);else resolve();};requestAnimationFrame(frame);});const sorted=[...intervals].sort((a,b)=>a-b),c=document.querySelector('canvas'),gl=c.getContext('webgl2'),ext=gl.getExtension('WEBGL_debug_renderer_info');return{rawIntervals:intervals,fps:1000/(intervals.reduce((a,b)=>a+b)/intervals.length),p95:sorted[Math.floor(sorted.length*.95)],max:Math.max(...intervals),maxDraws:Math.max(...counters.map(n=>n.draws)),maxTriangles:Math.max(...counters.map(n=>n.triangles)),state:{...document.querySelector('#game').dataset},framebuffer:[c.width,c.height],dpr:devicePixelRatio,finePointer:matchMedia('(pointer:fine)').matches,hover:matchMedia('(hover:hover)').matches,renderer:ext?gl.getParameter(ext.UNMASKED_RENDERER_WEBGL):gl.getParameter(gl.RENDERER)};});
  await page.screenshot({path:`${out}/${label}-original-course3-${viewport.width}.png`});const sample={label,viewport,touch,metrics,errors};samples.push(sample);await writeFile(`${out}/${label}-${viewport.width}.json`,JSON.stringify(sample,null,2));if(errors.length)throw new Error(errors.join('\n'));await context.close();
 }
} finally {
 await writeFile(`${out}/report.json`,JSON.stringify({source:process.env.SOURCE_SHA??process.env.GITHUB_SHA,baseline:'f681d495d572747012de7c176f09f01d0144039c',fileComparison,browser:browser.version(),samples,note:'Matched original Amber3 stationary gameplay at x0, soundOFF, DPR1, actual pointer/framebuffer recorded. All intervals retained. This diagnostic is not a full-course or physical-phone performance claim. Ordinary moving/stopped Amber4 routes and old three clears are separate native tests.'},null,2));await browser.close();for(const server of servers)server.close();
}
