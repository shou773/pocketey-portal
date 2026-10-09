import { chromium } from '@playwright/test';
import { createServer } from 'node:http';
import { readFile,stat,mkdir,writeFile,readdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import path from 'node:path';
import { COURSES } from '../src/games/prototypes/alpine/model.ts';
const before=process.argv[2];if(!before)throw new Error('Expected immutable baseline dist');
const out='test-results/alpine-campaign/comparison';await mkdir(out,{recursive:true});
const types={'.html':'text/html','.js':'text/javascript','.css':'text/css','.json':'application/json','.png':'image/png','.svg':'image/svg+xml','.glb':'model/gltf-binary','.wav':'audio/wav','.ogg':'audio/ogg','.mp3':'audio/mpeg'};
async function serve(root,port){const server=createServer(async(req,res)=>{try{let file=path.join(root,decodeURIComponent(new URL(req.url,'http://localhost').pathname));if((await stat(file)).isDirectory())file=path.join(file,'index.html');res.setHeader('Content-Type',types[path.extname(file)]??'application/octet-stream');res.end(await readFile(file));}catch{res.statusCode=404;res.end('Not found');}});await new Promise(resolve=>server.listen(port,'127.0.0.1',resolve));return server;}
async function manifest(root,prefix=''){const result={};for(const entry of await readdir(path.join(root,prefix),{withFileTypes:true})){const name=path.join(prefix,entry.name);if(entry.isDirectory())Object.assign(result,await manifest(root,name));else result[name]=createHash('sha256').update(await readFile(path.join(root,name))).digest('hex');}return result;}
const a=await manifest(before),b=await manifest(path.resolve('dist')),files=[...new Set([...Object.keys(a),...Object.keys(b)])].sort();
const fileComparison={identical:files.filter(p=>a[p]&&a[p]===b[p]),different:files.filter(p=>a[p]!==b[p])};
const servers=[await serve(before,4360),await serve(path.resolve('dist'),4361)],browser=await chromium.launch({args:['--no-sandbox','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
const samples=[];
try {
  for(const [label,port]of[['before',4360],['after',4361]])for(const viewport of[{width:390,height:844},{width:1280,height:800}]) {
    const touch=viewport.width<700,context=await browser.newContext({viewport,deviceScaleFactor:1,hasTouch:touch,isMobile:touch,locale:'en-US'}),page=await context.newPage(),errors=[];
    page.on('pageerror',e=>errors.push(e.message));await page.goto(`http://127.0.0.1:${port}/prototypes/alpine-drive/?lang=en`);
    await page.waitForFunction(()=>Number(document.querySelector('#alpine').dataset.drawCalls)>0);
    await page.screenshot({path:`${out}/${label}-menu-${viewport.width}.png`});
    for(let course=0;course<(label==='before'?1:3);course++) {
      await page.getByRole('button',{name:'Start driving',exact:true}).click();
      const metrics=page.evaluate(async()=>{const intervals=[],counters=[];let last=performance.now();await new Promise(resolve=>{function tick(now){const d=document.querySelector('#alpine').dataset;intervals.push(now-last);last=now;counters.push([Number(d.drawCalls),Number(d.triangles)]);if(d.phase==='playing')requestAnimationFrame(tick);else resolve();}requestAnimationFrame(tick);});const sorted=[...intervals].sort((a,b)=>a-b),canvas=document.querySelector('canvas');return{intervals,fps:intervals.length*1000/intervals.reduce((a,b)=>a+b,0),p95:sorted[Math.floor(sorted.length*.95)],maxDraws:Math.max(...counters.map(v=>v[0])),maxTriangles:Math.max(...counters.map(v=>v[1])),framebuffer:[canvas.width,canvas.height],hover:matchMedia('(hover:hover)').matches,fine:matchMedia('(pointer:fine)').matches,maxTouchPoints:navigator.maxTouchPoints};});
      for(const[i,g]of COURSES[course].gates.entries()) {
        await page.waitForFunction(({i,z})=>{const d=document.querySelector('#alpine').dataset;return d.phase==='failed'||(Number(d.gate)===i&&Number(d.z)>=z-4.6);},{i,z:g.z},{timeout:20000});
        if((await page.locator('#alpine').getAttribute('data-phase'))!=='playing')throw new Error('Capture driver failed');
        await page.keyboard.press(g.direction<0?'ArrowLeft':'ArrowRight');
      }
      await page.waitForFunction(()=>['clear','failed'].includes(document.querySelector('#alpine').dataset.phase),null,{timeout:20000});
      const end=await page.locator('#alpine').evaluate(el=>({...el.dataset})),measurement=await metrics;
      samples.push({label,viewport,course,measurement,end,errors:[...errors]});await writeFile(`${out}/${label}-course${course+1}-${viewport.width}.json`,JSON.stringify(samples.at(-1),null,2));
      if(end.phase!=='clear')throw new Error(JSON.stringify(end));await page.screenshot({path:`${out}/${label}-course${course+1}-clear-${viewport.width}.png`});
      // Separate diagnostic retry: ordinary queued input, no hidden overlays or state writes.
      await page.getByRole('button',{name:'Retry now',exact:true}).click();
      const first=COURSES[course].gates[0];await page.waitForFunction(z=>Number(document.querySelector('#alpine').dataset.z)>=z-2.6,first.z);
      await page.keyboard.press(first.direction<0?'ArrowLeft':'ArrowRight');
      const approach=await page.locator('#alpine').evaluate(el=>({...el.dataset}));await page.screenshot({path:`${out}/${label}-course${course+1}-approach-${viewport.width}.png`});
      await writeFile(`${out}/${label}-course${course+1}-approach-${viewport.width}.json`,JSON.stringify({approach,afterCapture:await page.locator('#alpine').evaluate(el=>({...el.dataset})),note:'Separate native retry diagnostic. No held input during screenshot. Main metrics and clear came from the uninterrupted run.'},null,2));
      await page.keyboard.press('Escape');
      if(label==='after'&&course<2){await page.getByRole('button',{name:'Courses',exact:true}).click();await page.locator(`#ad-courses button[data-course="${course+1}"]`).click();}
    }
    if(errors.length)throw new Error(errors.join('\n'));await context.close();
  }
} finally {
  await writeFile(`${out}/report.json`,JSON.stringify({source:process.env.GITHUB_SHA,baseline:'0740cb3272e92f934a350ba9a8d5f55a23cd7158',browser:browser.version(),fileComparison,samples,note:'Fixed matched viewport/input/sound-OFF conditions. Full ordinary-keyboard clears and uncensored wall-clock frame intervals. Baseline Alpine had no existing FPS gate: measurements are diagnostic, not a new all-green performance claim.'},null,2));
  await browser.close();for(const server of servers)server.close();
}
