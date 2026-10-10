import { expect, type Page } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';
import { length, track } from '../../../src/games/prototypes/ball/model';
export const evidence='test-results/tilt-courses';
export async function snapshot(page:Page){return page.locator('#tilttrail').evaluate(el=>{const d=(el as HTMLElement).dataset;return {phase:d.phase,stage:Number(d.stage),x:Number(d.x),z:Number(d.z),vx:Number(d.vx),speed:Number(d.speed),time:Number(d.time),drawCalls:Number(d.drawCalls),triangles:Number(d.triangles),brakePressed:el.querySelector('[data-tt-input="brake"]')?.getAttribute('aria-pressed')==='true'};});}
/** Observe state only; all gameplay changes use ordinary keyboard/multitouch and
 * visible Pause/Resume controls. The control rule matches the original suite. */
export async function driveCourse(page:Page,touch:boolean,label:string,measure=true,policy:'width'|'conservative'|'release'='width'){
  await mkdir(evidence,{recursive:true});
  const session=touch?await page.context().newCDPSession(page):null;
  const bounds=await Promise.all(['left','right','brake'].map(async type=>({type,bounds:(await page.locator(`[data-tt-input="${type}"]`).boundingBox())!})));
  let active:string[]=[],maxCalls=0,maxTriangles=0,capture=0;
  const samples:unknown[]=[],initial=await snapshot(page),captureAt=initial.stage===5?[]:initial.stage===3?[27,48]:initial.stage===4?[26,36,62]:[50];
  if(touch&&initial.stage===5)await page.evaluate(()=>{
    const events:unknown[]=[];(window as any).__tiltDriverEvents=events;
    for(const type of ['pointerdown','pointerup','pointercancel','lostpointercapture'])document.addEventListener(type,event=>{
      const target=(event.target as Element).closest?.('[data-tt-input]') as HTMLElement|null;if(!target)return;
      const root=document.querySelector('#tilttrail') as HTMLElement,e=event as PointerEvent;
      events.push({type,id:e.pointerId,control:target.dataset.ttInput,at:performance.now(),phase:root.dataset.phase,z:Number(root.dataset.z),brakePressed:root.querySelector('[data-tt-input="brake"]')?.getAttribute('aria-pressed')==='true'});
    });
  });
  const measurement=measure?page.evaluate(async()=>{
    const intervals:number[]=[];let previous=performance.now(),wasPlaying=false;
    await new Promise<void>(resolve=>{function frame(now:number){const playing=(document.querySelector('#tilttrail') as HTMLElement).dataset.phase==='playing';if(playing&&wasPlaying)intervals.push(now-previous);previous=now;wasPlaying=playing;if(intervals.length>=180||['falling','failed','clear'].includes((document.querySelector('#tilttrail') as HTMLElement).dataset.phase??''))resolve();else requestAnimationFrame(frame);}requestAnimationFrame(frame);});
    const sorted=intervals.slice(10).sort((a,b)=>a-b),canvas=document.querySelector('canvas')!,gl=canvas.getContext('webgl2')!,ext=gl.getExtension('WEBGL_debug_renderer_info');
    const full=intervals.slice().sort((a,b)=>a-b);
    return {legacyGateNote:'The retained gate excludes the first ten intervals; uncensored metrics below retain all intervals.',uncensored:{frames:full.length,fps:1000/(full.reduce((a,b)=>a+b,0)/full.length),p95:full[Math.floor(full.length*.95)],max:Math.max(...full)},hover:matchMedia('(hover:hover)').matches,finePointer:matchMedia('(pointer:fine)').matches,maxTouchPoints:navigator.maxTouchPoints,frames:intervals.length,fps:1000/(sorted.reduce((a,b)=>a+b,0)/sorted.length),p95:sorted[Math.floor(sorted.length*.95)],intervals,renderer:ext?gl.getParameter(ext.UNMASKED_RENDERER_WEBGL):gl.getParameter(gl.RENDERER),viewport:[innerWidth,innerHeight],framebuffer:[canvas.width,canvas.height]};
  }):null;
  async function release(){if(session){if(active.length)await session.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});}else for(const key of ['ArrowLeft','ArrowRight','Space'])await page.keyboard.up(key);active=[];}
  const begin=Date.now();
  while(Date.now()-begin<110000){
    const s=await snapshot(page);samples.push(s);maxCalls=Math.max(maxCalls,s.drawCalls);maxTriangles=Math.max(maxTriangles,s.triangles);if(s.phase!=='playing')break;
    const road=track(s.stage,s.z),future=track(s.stage,s.z+.7),diff=(future.x-road.x)/.7*s.speed+(road.x-s.x)*3-s.vx;
    const next=[diff>.3?'right':diff<-.3?'left':'',(policy==='conservative'||(policy==='release'?(s.z>=36&&s.z<47):road.width<4))?'brake':''].filter(Boolean);
    if(session){if(next.join()!==active.join()){const points=bounds.filter(b=>next.includes(b.type)).map(b=>({id:b.type==='left'?1:b.type==='right'?2:3,x:b.bounds.x+b.bounds.width/2,y:b.bounds.y+b.bounds.height/2,radiusX:5,radiusY:5,force:1}));if(policy==='width'){
      // Preserve the historical driver and its prior measurements for courses1–5.
      if(active.length)await session.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});if(points.length)await session.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:points});
    }else{
      // CDP active-point updates preserve the brake finger while steering changes.
      // https://chromedevtools.github.io/devtools-protocol/tot/Input/#method-dispatchTouchEvent
      await session.send('Input.dispatchTouchEvent',{type:points.length?(active.length?'touchMove':'touchStart'):'touchEnd',touchPoints:points});
    }}}
    else {const key=(c:string)=>c==='left'?'ArrowLeft':c==='right'?'ArrowRight':'Space';for(const c of active.filter(a=>!next.includes(a)))await page.keyboard.up(key(c));for(const c of next.filter(a=>!active.includes(a)))await page.keyboard.down(key(c));}
    active=next;
    if(capture<captureAt.length&&s.z>captureAt[capture]){
      await page.locator('#tt-pause').click();await release();await page.screenshot({path:`${evidence}/${label}-course${s.stage+1}-rhythm${capture+1}.png`});
      await page.getByRole('button',{name:'Resume',exact:true}).last().click();capture++;continue;
    }
    await page.waitForTimeout(65);
  }
  await release();if(session)await session.detach();const end=await snapshot(page),timing=measurement?await measurement:null;
  const pointerEvents=touch&&initial.stage===5?await page.evaluate(()=>(window as any).__tiltDriverEvents):[];
  await writeFile(`${evidence}/${label}-course${end.stage+1}.json`,JSON.stringify({end,policy,pointerEvents,maxCalls,maxTriangles,performance:timing,samples,note:'Ordinary-input feasibility and software-rendered timing. Controller activity is not a measure of human difficulty.'},null,2));
  expect(end.phase,JSON.stringify(end)).toBe('clear');expect(maxCalls).toBeLessThanOrEqual(initial.stage===5?14:16);expect(maxTriangles).toBeLessThan(6000);
  if(touch&&policy==='conservative'){
    expect(pointerEvents.filter((e:any)=>e.control==='brake'&&e.type==='pointerdown')).toHaveLength(1);
    expect(pointerEvents.filter((e:any)=>e.phase==='playing'&&e.control==='brake'&&e.type!=='pointerdown')).toEqual([]);
    expect((samples as Awaited<ReturnType<typeof snapshot>>[]).filter(s=>s.phase==='playing'&&s.time>.5).every(s=>s.brakePressed)).toBe(true);
  }
  if(timing){expect(timing.frames).toBe(180);expect.soft(timing.fps).toBeGreaterThanOrEqual(45);expect.soft(timing.p95).toBeLessThanOrEqual(40);}
  await page.screenshot({path:`${evidence}/${label}-course${end.stage+1}-clear.png`});return end;
}
