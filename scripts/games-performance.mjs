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
const results = [];
try {
 for (let round=0; round<3; round++) for (const game of ['orbit-ribbon','amber-step']) for (const variant of (round%2 ? [1,0] : [0,1])) {
  const context = await browser.newContext({viewport:{width:1280,height:720},deviceScaleFactor:1});
  const page = await context.newPage(); const session = await context.newCDPSession(page);
  await page.addInitScript(() => {
   const seen = new WeakSet(); const probe = window.__renderProbe = {contexts:0,drawCalls:0};
   const getContext = HTMLCanvasElement.prototype.getContext;
   HTMLCanvasElement.prototype.getContext = function(...args) { const result = getContext.apply(this,args); if(result && String(args[0]).includes('webgl') && !seen.has(result)){seen.add(result);probe.contexts++;}return result; };
   for (const name of ['drawElements','drawArrays','drawElementsInstanced','drawArraysInstanced']) {
    const original = WebGL2RenderingContext.prototype[name];
    WebGL2RenderingContext.prototype[name] = function(...args){probe.drawCalls++;return original.apply(this,args);};
   }
  });
  await session.send('Performance.enable');
  await page.goto(`http://127.0.0.1:${servers[variant].address().port}/games/${game}/`);
  await page.getByRole('button',{name:'ステージ 1 をはじめる'}).click();
  const before = await session.send('Performance.getMetrics');
  const sample = await page.evaluate(async () => {
   const callsBefore=window.__renderProbe.drawCalls; const samples=[];let last=performance.now();
   await new Promise(resolve=>{function sample(now){samples.push(now-last);last=now;if(samples.length<110)requestAnimationFrame(sample);else resolve();}requestAnimationFrame(sample);});
   const sorted=samples.slice(10).sort((a,b)=>a-b), canvas=document.querySelector('canvas'), gl=canvas.getContext('webgl2'), ext=gl.getExtension('WEBGL_debug_renderer_info');
   return {fps:1000/(sorted.reduce((a,b)=>a+b)/sorted.length),p95:sorted[Math.floor(sorted.length*.95)],canvas:[canvas.width,canvas.height],dpr:devicePixelRatio,renderer:ext?gl.getParameter(ext.UNMASKED_RENDERER_WEBGL):gl.getParameter(gl.RENDERER),contextsCreated:window.__renderProbe.contexts,drawCalls:window.__renderProbe.drawCalls-callsBefore,state:{...document.querySelector('#game').dataset}};
  });
  const after = await session.send('Performance.getMetrics'), delta={};
  for (const name of ['TaskDuration','ScriptDuration','LayoutDuration','RecalcStyleDuration','LayoutCount','RecalcStyleCount']) delta[name]=after.metrics.find(x=>x.name===name).value-before.metrics.find(x=>x.name===name).value;
  results.push({round,game,variant:variant?'candidate':'baseline',...sample,delta,browserContexts:browser.contexts().length});
  console.log(JSON.stringify(results.at(-1)));
  await context.close();
  if(browser.contexts().length!==0) throw new Error('Browser contexts accumulated');
 }
 mkdirSync('performance-results',{recursive:true});
 writeFileSync('performance-results/comparison.json',JSON.stringify({browser:browser.version(),node:process.version,os:os.platform(),cpu:os.cpus()[0]?.model,cpuCount:os.cpus().length,description:'Three predeclared alternating rounds. Same browser, 1280x720 DPR1, stage 1 first 110 rAF callbacks; first 10 excluded. No threshold assertions or release-completion claim. Fresh closed context per sample.',results},null,2));
} finally {await browser.close(); for(const server of servers) server.close();}
