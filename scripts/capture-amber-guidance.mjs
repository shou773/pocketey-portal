import { chromium } from '@playwright/test';
import { createServer } from 'node:http';
import { readFile,stat,mkdir,writeFile,readdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import path from 'node:path';
const before=process.argv[2];if(!before)throw new Error('Expected immutable baseline dist');
const out='test-results/amber-guidance/comparison';await mkdir(out,{recursive:true});
const types={'.html':'text/html','.js':'text/javascript','.css':'text/css','.json':'application/json','.png':'image/png','.svg':'image/svg+xml','.glb':'model/gltf-binary','.wav':'audio/wav','.ogg':'audio/ogg','.mp3':'audio/mpeg'};
async function serve(root,port){const server=createServer(async(req,res)=>{try{let file=path.join(root,decodeURIComponent(new URL(req.url,'http://localhost').pathname));if((await stat(file)).isDirectory())file=path.join(file,'index.html');res.setHeader('Content-Type',types[path.extname(file)]??'application/octet-stream');res.end(await readFile(file));}catch{res.statusCode=404;res.end('Not found');}});await new Promise(resolve=>server.listen(port,'127.0.0.1',resolve));return server;}
async function manifest(root,prefix=''){const result={};for(const entry of await readdir(path.join(root,prefix),{withFileTypes:true})){const name=path.join(prefix,entry.name);if(entry.isDirectory())Object.assign(result,await manifest(root,name));else result[name]=createHash('sha256').update(await readFile(path.join(root,name))).digest('hex');}return result;}
const a=await manifest(before),b=await manifest(path.resolve('dist')),files=[...new Set([...Object.keys(a),...Object.keys(b)])].sort();
const fileComparison={identical:files.filter(p=>a[p]&&a[p]===b[p]),different:files.filter(p=>a[p]!==b[p])};
const servers=[await serve(before,4362),await serve(path.resolve('dist'),4363)],browser=await chromium.launch({args:['--no-sandbox','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
const samples=[];
try {
 for(const [label,port]of[['before',4362],['after',4363]])for(const viewport of[{width:390,height:844},{width:844,height:390}]) {
  const context=await browser.newContext({viewport,deviceScaleFactor:1,hasTouch:true,isMobile:true,locale:'en-US'}),page=await context.newPage(),errors=[];
  page.on('pageerror',e=>errors.push(e.message));await page.goto(`http://127.0.0.1:${port}/games/amber-step/?lang=en`);await page.waitForFunction(()=>document.querySelector('#scene').dataset.artAdopted==='true');
  await page.getByRole('button',{name:'Start stage 1',exact:true}).click();await page.waitForTimeout(5500);
  const waiting=await page.locator('#game').evaluate(el=>({...el.dataset}));await page.screenshot({path:`${out}/${label}-first-lesson-${viewport.width}.png`});
  await page.keyboard.down('ArrowRight');await page.waitForFunction(()=>document.querySelector('#game').dataset.status==='dead');await page.keyboard.up('ArrowRight');
  const failed=await page.locator('#game').evaluate(el=>({...el.dataset})),copy=await page.locator('#panel-copy').textContent();await page.screenshot({path:`${out}/${label}-spike-retry-${viewport.width}.png`});
  if(label==='after'&&!copy.includes('You hit a spike'))throw new Error('Missing observed spike guidance');
  await page.goto(`http://127.0.0.1:${port}/games/orbit-ribbon/?lang=en`);await page.waitForFunction(()=>document.querySelector('#scene').dataset.artAdopted==='true');await page.screenshot({path:`${out}/${label}-orbit-menu-${viewport.width}.png`});
  if(await page.locator('#amber-coach').count())throw new Error('Amber coach leaked into Orbit');
  const sample={label,viewport,waiting,failed,copy,errors};samples.push(sample);await writeFile(`${out}/${label}-${viewport.width}.json`,JSON.stringify(sample,null,2));if(errors.length)throw new Error(errors.join('\n'));await context.close();
 }
} finally {
 await writeFile(`${out}/report.json`,JSON.stringify({source:process.env.SOURCE_SHA??process.env.GITHUB_SHA,baseline:'a3c3fc6bb3d46cba1036fc660167435a5a0c22a1',fileComparison,samples,note:'Actual unchanged-physics wait and spike collision using ordinary keyboard input. No held input during captures. Orbit behavior/collection are covered separately; its new shared bundle only adds guarded Amber code.'},null,2));
 await browser.close();for(const server of servers)server.close();
}
