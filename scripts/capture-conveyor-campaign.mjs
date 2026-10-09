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
try{
 for(const [label,port] of [['before',4352],['after',4353]]){
  const context=await browser.newContext({viewport:{width:390,height:844},deviceScaleFactor:1,hasTouch:true,locale:'en-US'});
  if(label==='after')await context.addInitScript(()=>localStorage.setItem('pocketey-conveyor-v1',JSON.stringify({version:1,rotations:[1,0,3,0,0,2,1,3],turns:0,best:null})));
  const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto(`http://127.0.0.1:${port}/prototypes/conveyor/?lang=en`);
  const root=page.locator('#conveyor');await root.waitFor({state:'visible'});
  await page.waitForFunction(()=>document.querySelector('#conveyor')?.getAttribute('data-render-pending')==='false');
  if(await root.getAttribute('data-webgl')!=='true')throw new Error(`${label} has no WebGL`);
  await page.screenshot({path:`${out}/${label}-original-start-390.png`,fullPage:true});
  await page.locator('#cv-canvas').screenshot({path:`${out}/${label}-original-board-390.png`});
  for(const[id,count]of[['a',3],['c',1],['d',1],['e',1],['g',1]])for(let n=0;n<count;n++)await page.locator(`[data-tile="${id}"]`).tap();
  await page.locator('#cv-play').tap();
  await page.waitForFunction(()=>document.querySelector('#conveyor')?.getAttribute('data-phase')==='success');
  await page.waitForFunction(()=>document.querySelector('#conveyor')?.getAttribute('data-render-pending')==='false');
  await page.screenshot({path:`${out}/${label}-original-clear-390.png`,fullPage:true});
  report.push({label,viewport:{width:390,height:844},errors,rotations:await root.getAttribute('data-rotations'),phase:await root.getAttribute('data-phase'),drawCalls:await root.getAttribute('data-draw-calls'),triangles:await root.getAttribute('data-triangles'),renderer:await page.locator('#cv-canvas').evaluate(canvas=>{const gl=canvas.getContext('webgl2');const ext=gl.getExtension('WEBGL_debug_renderer_info');return ext?gl.getParameter(ext.UNMASKED_RENDERER_WEBGL):gl.getParameter(gl.RENDERER);})});
  if(errors.length)throw new Error(errors.join('\n'));await context.close();
 }
 await writeFile(`${out}/report.json`,JSON.stringify({baseline:'975d3acfb03b02ddd2d5ae1f79edca228e0b9f90',note:'Actual production WebGL renders. Before/after original-board captures use identical viewport, initial rotations and full assets; page layouts differ. New campaign captures come from ordinary-input browser tests. SwiftShader is not a physical-phone benchmark.',browser:browser.version(),fileComparison,samples:report},null,2));
}finally{await browser.close();for(const s of servers)s.close();}
