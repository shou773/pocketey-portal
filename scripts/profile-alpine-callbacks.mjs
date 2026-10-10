import {chromium} from '@playwright/test';
import {createServer} from 'node:http';
import {readFile,stat,mkdir,writeFile} from 'node:fs/promises';
import path from 'node:path';
import {COURSES} from '../src/games/prototypes/alpine/model.ts';
const root=process.argv[2];if(!root)throw Error('Expected immutable accepted dist');
const out='test-results/alpine-callback-profile';await mkdir(out,{recursive:true});
const types={'.html':'text/html','.js':'text/javascript','.css':'text/css','.json':'application/json','.png':'image/png','.svg':'image/svg+xml','.glb':'model/gltf-binary','.wav':'audio/wav','.ogg':'audio/ogg','.mp3':'audio/mpeg'};
const server=createServer(async(req,res)=>{try{let file=path.join(root,decodeURIComponent(new URL(req.url,'http://localhost').pathname));if((await stat(file)).isDirectory())file=path.join(file,'index.html');res.setHeader('Content-Type',types[path.extname(file)]??'application/octet-stream');res.end(await readFile(file));}catch{res.statusCode=404;res.end('Not found');}});await new Promise(resolve=>server.listen(4366,'127.0.0.1',resolve));
const browser=await chromium.launch({args:['--no-sandbox','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']}),samples=[];
const summary=values=>{const sorted=[...values].sort((a,b)=>a-b);return{count:values.length,mean:values.reduce((a,b)=>a+b,0)/values.length,p95:sorted[Math.floor(sorted.length*.95)],max:Math.max(...values)};};
try{
 for(const viewport of[{width:390,height:844},{width:1280,height:800}])for(const [course,instrumented]of[[0,true],[2,true],[2,false]]){
  const touch=viewport.width<700,context=await browser.newContext({viewport,deviceScaleFactor:1,hasTouch:touch,isMobile:touch,locale:'en-US'}),page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.addInitScript(({instrumented,course})=>{
   // Unlock fixture affects menu selection only. No gameplay state is modified.
   if(course===2)localStorage.setItem('pocketey-alpine-campaign-v2',JSON.stringify({version:2,muted:true,records:{'mountain-pass':{clears:1,best:null},'long-return':{clears:1,best:null}}}));
   window.__adProfile={callbacks:[],frames:[],longTasks:[],start:null,end:null,launch:null,instrumented};
   document.addEventListener('click',event=>{const button=event.target instanceof Element?event.target.closest('#ad-actions button'):null;if(button?.textContent==='Start driving')window.__adProfile.launch=performance.now();},true);
   const log=window.__adProfile,native=window.requestAnimationFrame,ids=new WeakMap();let nextID=0;
   const state=()=>{const d=document.querySelector('#alpine')?.dataset;return d?{phase:d.phase,course:d.course,z:d.z,gate:d.gate,draws:Number(d.drawCalls),triangles:Number(d.triangles)}:null;};
   if(instrumented){window.requestAnimationFrame=function(callback){let id=ids.get(callback);if(!id){id=++nextID;ids.set(callback,id);}return native.call(window,time=>{const begin=performance.now();try{callback(time);}finally{const end=performance.now();log.callbacks.push({id,name:callback.name,time,begin,end,work:end-begin,state:state()});}});};}
   else{ // Control does not wrap app callbacks; this independent observer only records frame timestamps.
    const tick=time=>{log.frames.push({time,state:state()});native.call(window,tick);};native.call(window,tick);
   }
   try{new PerformanceObserver(list=>{for(const entry of list.getEntries())log.longTasks.push({start:entry.startTime,duration:entry.duration,name:entry.name});}).observe({type:'longtask',buffered:true});}catch{log.longTasksUnavailable=true;}
  },{instrumented,course});
  await page.goto('http://127.0.0.1:4366/prototypes/alpine-drive/?lang=en');await page.waitForFunction(()=>Number(document.querySelector('#alpine').dataset.drawCalls)>0);
  if(course===2)await page.locator('#ad-courses button[data-course="2"]').click();
  await page.evaluate(()=>window.__adProfile.start=performance.now());await page.getByRole('button',{name:'Start driving',exact:true}).click();
  const inputs=[];
  for(const[i,g]of COURSES[course].gates.entries()){
   await page.waitForFunction(({i,z})=>{const d=document.querySelector('#alpine').dataset;return d.phase==='failed'||(Number(d.gate)===i&&Number(d.z)>=z-4.6);},{i,z:g.z},{timeout:25000});
   const before=await page.locator('#alpine').evaluate(el=>({...el.dataset}));if(before.phase!=='playing')throw Error('Profile ordinary driver failed');
   await page.keyboard.press(g.direction<0?'ArrowLeft':'ArrowRight');inputs.push({i,direction:g.direction,before,after:await page.locator('#alpine').evaluate(el=>({...el.dataset}))});
  }
  await page.waitForFunction(()=>['clear','failed'].includes(document.querySelector('#alpine').dataset.phase),null,{timeout:25000});
  if(!instrumented)await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(resolve))); // Allow the control observer to see the terminal phase.
  const telemetry=await page.evaluate(()=>{const log=window.__adProfile;log.end=performance.now();const c=document.querySelector('canvas'),gl=c.getContext('webgl2'),ext=gl.getExtension('WEBGL_debug_renderer_info');return{...log,final:{...document.querySelector('#alpine').dataset},environment:{viewport:[innerWidth,innerHeight],framebuffer:[c.width,c.height],dpr:devicePixelRatio,hover:matchMedia('(hover:hover)').matches,fine:matchMedia('(pointer:fine)').matches,maxTouchPoints:navigator.maxTouchPoints,antialias:gl.getContextAttributes().antialias,renderer:ext?gl.getParameter(ext.UNMASKED_RENDERER_WEBGL):gl.getParameter(gl.RENDERER)}};});
  const callbacks=telemetry.callbacks.filter(c=>c.time>=telemetry.start&&c.time<=telemetry.end),counts=new Map();for(const c of callbacks)counts.set(c.id,(counts.get(c.id)||0)+1);const gameID=[...counts].sort((a,b)=>b[1]-a[1])[0]?.[0];
  const selected=instrumented?callbacks.filter(c=>c.id===gameID):telemetry.frames.filter(c=>c.time>=telemetry.start&&c.time<=telemetry.end);
  const frames=[...new Map(selected.map(c=>[c.time,c])).values()].sort((a,b)=>a.time-b.time),preceding=(instrumented?telemetry.callbacks.filter(c=>c.id===gameID):telemetry.frames).filter(c=>c.time<telemetry.start).at(-1);
  const intervals=frames.map((c,i)=>c.time-(i?frames[i-1].time:preceding?.time??telemetry.start));
  const launch=telemetry.launch,clearFrame=frames.find(c=>c.time>=launch&&c.state?.phase==='clear');
  if(!Number.isFinite(launch)||!clearFrame)throw Error('Missing actual launch/clear timing markers');
  const gameplayFrames=frames.filter(c=>c.time>=launch&&c.time<=clearFrame.time),gameplayIntervals=gameplayFrames.map(c=>{const i=frames.indexOf(c);return c.time-(i?frames[i-1].time:preceding?.time??launch);});
  const gameplay={launch,clearObserved:clearFrame.time,firstCallbackDelay:gameplayFrames[0].time-launch,intervals:gameplayIntervals,intervalSummary:summary(gameplayIntervals),callbackSummary:instrumented?summary(gameplayFrames.map(c=>c.work)):null};
  const sample={course,viewport,instrumented,unlockFixture:course===2,inputs,gameCallbackID:gameID,callbackIDs:[...counts],intervals,intervalSummary:summary(intervals),callbackSummary:instrumented?summary(selected.map(c=>c.work)):null,gameplay,maxDraws:Math.max(...frames.map(c=>c.state?.draws??0)),maxTriangles:Math.max(...frames.map(c=>c.state?.triangles??0)),telemetry,errors};samples.push(sample);
  const name=`course${course+1}-${viewport.width}-${instrumented?'wrapped':'control'}`;await writeFile(`${out}/${name}.json`,JSON.stringify(sample,null,2));
  if(telemetry.final.phase!=='clear'||errors.length)throw Error(`Incomplete ${name}`);
  // Evidence image is explicitly after the timed interval.
  await page.screenshot({path:`${out}/${name}-clear.png`});await context.close();
 }
}finally{
 await writeFile(`${out}/report.json`,JSON.stringify({testSource:process.env.SOURCE_SHA,immutableGameSource:'284d8441a8235dd2eff27c31a21bded81919872e',browser:browser.version(),samples:samples.map(({telemetry,inputs,intervals,...rest})=>({...rest,environment:telemetry.environment,phase:telemetry.final.phase,longTasks:telemetry.longTasks.filter(t=>t.start+t.duration>=telemetry.start&&t.start<=telemetry.end)})),note:'Six bounded runs: course1/3 callback instrumentation and one course3 unwrapped control per viewport. The control has a timestamp-only frame observer; it is not zero-overhead. Raw records include menu/control latency; the additional actual launch-click to first observed clear span is used for gameplay attribution. Launch-time startup/stalls are retained (menu shader/scene preparation has already occurred), no warm-up exclusions and no screenshots during measurement. Low app callback time cannot establish a GPU bottleneck: compositor, browser scheduling and software rendering remain possible. No production changes or phone-latency claim.'},null,2));await browser.close();server.close();
}
