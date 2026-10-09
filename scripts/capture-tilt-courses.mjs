import { chromium } from '@playwright/test';
import { createServer } from 'node:http';
import { readFile,stat,mkdir,writeFile,readdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import path from 'node:path';
const before=process.argv[2];if(!before)throw new Error('Expected baseline dist path');
const out='test-results/tilt-courses/comparison';await mkdir(out,{recursive:true});
const types={'.html':'text/html','.js':'text/javascript','.css':'text/css','.json':'application/json','.png':'image/png','.svg':'image/svg+xml','.glb':'model/gltf-binary','.wav':'audio/wav','.ogg':'audio/ogg','.mp3':'audio/mpeg'};
async function serve(root,port){const server=createServer(async(req,res)=>{try{let file=path.join(root,decodeURIComponent(new URL(req.url,'http://localhost').pathname));if((await stat(file)).isDirectory())file=path.join(file,'index.html');res.setHeader('Content-Type',types[path.extname(file)]??'application/octet-stream');res.end(await readFile(file));}catch{res.statusCode=404;res.end('Not found');}});await new Promise(resolve=>server.listen(port,'127.0.0.1',resolve));return server;}
async function manifest(root,prefix=''){const result={};for(const entry of await readdir(path.join(root,prefix),{withFileTypes:true})){const name=path.join(prefix,entry.name);if(entry.isDirectory())Object.assign(result,await manifest(root,name));else result[name]=createHash('sha256').update(await readFile(path.join(root,name))).digest('hex');}return result;}
const a=await manifest(before),b=await manifest(path.resolve('dist')),files=[...new Set([...Object.keys(a),...Object.keys(b)])].sort();
const fileComparison={identical:files.filter(p=>a[p]&&a[p]===b[p]),different:files.filter(p=>a[p]!==b[p])};
const servers=[await serve(before,4356),await serve(path.resolve('dist'),4357)];
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
}await writeFile(`${out}/report.json`,JSON.stringify({baseline:'29424ba7300e5ded81bc07b9f2e73f05f078a137',browser:browser.version(),fileComparison,samples,note:'Actual production renders with both full assets loaded. Live original-course3 states are not pixel-matched. New-course captures use ordinary input and visible Pause/Resume. Software timing is not a physical-phone benchmark.'},null,2));}finally{await browser.close();for(const s of servers)s.close();}
