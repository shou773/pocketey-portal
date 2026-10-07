// Diagnostic comparison only: ordinary stage-1 start, no completion claim or game-state writes.
// Alternating variants in one browser/runner reduces ordering and host-load confounding.
import { chromium } from 'playwright-core';
import { createServer } from 'node:http';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { resolve, extname } from 'node:path';
import os from 'node:os';
const roots = process.argv.slice(2);
if (roots.length !== 2) throw new Error('Expected baseline dist and candidate dist');
const servers = [];
for (const root of roots) {
 const server = createServer((req, res) => {
  try {
   const path = resolve(root, '.' + decodeURIComponent(req.url.split('?')[0]) + (req.url.endsWith('/') ? 'index.html' : ''));
   if (!path.startsWith(resolve(root) + '/')) throw new Error('Invalid path');
   res.setHeader('Content-Type', ({'.html':'text/html','.js':'text/javascript','.css':'text/css','.svg':'image/svg+xml'})[extname(path)] || 'application/octet-stream');
   res.end(readFileSync(path));
  } catch { res.writeHead(404); res.end(); }
 });
 await new Promise(r => server.listen(0, '127.0.0.1', r)); servers.push(server);
}
const browser = await chromium.launch({executablePath:process.env.CI ? undefined : '/usr/bin/chromium',args:['--no-sandbox','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
const environment={browser:browser.version(),node:process.version,os:os.platform(),cpu:os.cpus()[0]?.model,cpuCount:os.cpus().length};
console.log('ENVIRONMENT',JSON.stringify(environment));
const results = [];
try {
 for (let round=0; round<3; round++) for (const mobile of [false,true]) for (const game of ['orbit-ribbon','amber-step']) for (const variant of (round%2 ? [1,0] : [0,1])) {
  const context = await browser.newContext({locale:'ja-JP',viewport:mobile?{width:390,height:844}:{width:1280,height:720},isMobile:mobile,hasTouch:mobile,deviceScaleFactor:1});
  const page = await context.newPage(); const session = await context.newCDPSession(page);
  await page.addInitScript(() => {
   const seen = new WeakSet(); const probe = window.__renderProbe = {contexts:0,drawCalls:0,triangles:0,drawSubmitMs:0};
   const getContext = HTMLCanvasElement.prototype.getContext;
   HTMLCanvasElement.prototype.getContext = function(...args) { const result = getContext.apply(this,args); if(result && String(args[0]).includes('webgl') && !seen.has(result)){seen.add(result);probe.contexts++;}return result; };
   for (const name of ['drawElements','drawArrays','drawElementsInstanced','drawArraysInstanced']) {
    const original = WebGL2RenderingContext.prototype[name];
    WebGL2RenderingContext.prototype[name] = function(...args){probe.drawCalls++;
     const instances = name === 'drawElementsInstanced' ? args[4] : name === 'drawArraysInstanced' ? args[3] : 1;
     if(args[0] === this.TRIANGLES) probe.triangles += args[name.includes('Elements') ? 1 : 2] / 3 * instances;
     const start = performance.now(); const result = original.apply(this,args); probe.drawSubmitMs += performance.now()-start; return result;};
   }
  });
  await session.send('Performance.enable');
  await page.goto(`http://127.0.0.1:${servers[variant].address().port}/games/${game}/`);
  await page.waitForFunction(() => { const canvas = document.querySelector('canvas'); return canvas && (!canvas.dataset.art || canvas.dataset.artAdopted === 'true'); });
  await page.waitForTimeout(300);
  await page.getByRole('button',{name:'ステージ 1 をはじめる'}).click();
  const before = await session.send('Performance.getMetrics');
  const sample = await page.evaluate(async () => {
   const callsBefore=window.__renderProbe.drawCalls, trianglesBefore=window.__renderProbe.triangles, submitBefore=window.__renderProbe.drawSubmitMs; const samples=[];const start=performance.now();let last=start;
   await new Promise(resolve=>{function sample(now){samples.push(now-last);last=now;if(now-start<1500)requestAnimationFrame(sample);else resolve();}requestAnimationFrame(sample);});
   const sorted=samples.slice(10).sort((a,b)=>a-b), canvas=document.querySelector('canvas'), gl=canvas.getContext('webgl2'), ext=gl.getExtension('WEBGL_debug_renderer_info');
   return {valid:sorted.length>=10,sampleCount:samples.length,rawIntervals:samples,fps:sorted.length>=10?1000/(sorted.reduce((a,b)=>a+b,0)/sorted.length):null,p95:sorted.length>=10?sorted[Math.floor(sorted.length*.95)]:null,canvas:[canvas.width,canvas.height],dpr:devicePixelRatio,renderer:ext?gl.getParameter(ext.UNMASKED_RENDERER_WEBGL):gl.getParameter(gl.RENDERER),contextsCreated:window.__renderProbe.contexts,drawCalls:window.__renderProbe.drawCalls-callsBefore,triangles:window.__renderProbe.triangles-trianglesBefore,drawSubmitMs:window.__renderProbe.drawSubmitMs-submitBefore,gpuTimerAvailable:!!gl.getExtension('EXT_disjoint_timer_query_webgl2'),art:{...canvas.dataset},state:{...document.querySelector('#game').dataset}};
  });
  const after = await session.send('Performance.getMetrics'), delta={};
  for (const name of ['TaskDuration','ScriptDuration','LayoutDuration','RecalcStyleDuration','LayoutCount','RecalcStyleCount']) delta[name]=after.metrics.find(x=>x.name===name).value-before.metrics.find(x=>x.name===name).value;
  if(sample.state.status!=='running') {sample.valid=false;sample.invalidReason='left running state';}
  if(sample.sampleCount<20) sample.invalidReason='fewer than 10 measured callbacks after warm-up';
  results.push({round,mobile,game,variant:variant?'candidate':'baseline',...sample,delta,browserContexts:browser.contexts().length});
  console.log(JSON.stringify(results.at(-1)));
  await context.close();
  if(browser.contexts().length!==0) throw new Error('Browser contexts accumulated');
 }
 mkdirSync('performance-results',{recursive:true});
 writeFileSync('performance-results/comparison.json',JSON.stringify({...environment,description:'Three predeclared alternating rounds. Same browser, desktop 1280x720 and mobile 390x844 DPR1, stage 1 first 1500ms after asset adoption and equal 300ms menu dwell; first 10 callbacks excluded. Samples ending outside running state or with fewer than 10 measured callbacks after warm-up are marked invalid and retained, never silently discarded. Draw-submit timing is CPU/driver submission, not asynchronous GPU execution time. Triangle counts include submitted instanced geometry, not just visible fragments. Static initial segment only, not a stage-3 or touch-animation substitute. No threshold assertions or release-completion claim. Fresh closed context per sample.',results},null,2));
} finally {await browser.close(); for(const server of servers) server.close();}
