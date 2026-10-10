import { expect,type Page } from '@playwright/test';
import { read } from './input';
export async function driveLanding(page:Page,touch:boolean,stopOnPads:boolean,trace:unknown[],capture?: (name:string)=>Promise<void>) {
 const targets=[2.9,9.1,20.1,25.9,32.9,39.1,45.1,55.3,63.9],stopped=new Set<number>(),seen=new Set<string>();
 let next=0,pauseUntil=0;const down=new Set<string>(),start=Date.now();
 const session=touch?await page.context().newCDPSession(page):null,points:Record<string,{x:number;y:number;id:number}>={};
 for(const [i,name]of['left','right','jump'].entries()){const b=(await page.locator(`[data-input=${name}]`).boundingBox())!;points[name]={x:b.x+b.width/2,y:b.y+b.height/2,id:i+1};}
 await page.evaluate(()=>{const timing={running:true,intervals:[] as number[],maxDraws:0,maxTriangles:0,start:performance.now(),end:0};(window as any).landingTiming=timing;let last=timing.start;function sample(now:number){timing.intervals.push(now-last);last=now;const d=document.querySelector<HTMLElement>('#game')!.dataset;timing.maxDraws=Math.max(timing.maxDraws,Number(d.drawCalls));timing.maxTriangles=Math.max(timing.maxTriangles,Number(d.triangles));if(timing.running&&d.mode==='play')requestAnimationFrame(sample);else timing.end=now;}requestAnimationFrame(sample);const events:unknown[]=[];(window as any).landingEvents=events;for(const type of['pointerdown','pointerup','pointercancel','keydown','keyup'])document.addEventListener(type,e=>{const input=(e.target as Element)?.closest<HTMLElement>('[data-input]')?.dataset.input;const d=document.querySelector<HTMLElement>('#game')!.dataset;events.push({type,input,key:(e as KeyboardEvent).code,pointerId:(e as PointerEvent).pointerId,at:performance.now(),x:d.x,y:d.y,grounded:d.grounded,jumps:d.jumps});},true);});
 async function input(names:string[]){
  const removed=[...down].filter(n=>!names.includes(n)),added=names.filter(n=>!down.has(n));
  if(session){if(removed.length)await session.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:removed.map(n=>points[n])});if(added.length)await session.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:added.map(n=>points[n])});}
  else {for(const n of removed)await page.keyboard.up(n==='right'?'ArrowRight':'Space');for(const n of added)await page.keyboard.down(n==='right'?'ArrowRight':'Space');}
  down.clear();names.forEach(n=>down.add(n));
 }
 try {
  while(Date.now()-start<65000){
   const d=await read(page);if(d.status!=='running')break;const x=Number(d.x),time=Number(await page.locator('#timer').textContent());
   const pad=d.grounded==='true'?(x>=23.2&&x<=26.8?2:x>=42.2&&x<=46?4:-1):-1;
   if(stopOnPads&&pad>=0&&!stopped.has(pad)){stopped.add(pad);pauseUntil=time+.65;await input([]);trace.push({stop:pad,before:d,after:await read(page)});if(capture)await capture(`pad${pad}-standing`);}
   const approach=x>=17.3&&x<19?'lower-approach':x>=37&&x<38.8?'rising-approach':null;
   if(capture&&approach&&!seen.has(approach)&&d.grounded==='true'){seen.add(approach);await input([]);await capture(approach);}
   const moving=time>=pauseUntil,jump=moving&&d.grounded==='true'&&next<targets.length&&x>=targets[next];
   if(jump)next++;const requested=[...(moving?['right']:[]),...(jump?['jump']:[])];await input(requested);
   const actual=await page.locator('#game').evaluate(el=>({state:{...(el as HTMLElement).dataset},held:[...el.querySelectorAll<HTMLElement>('[data-input].held')].map(b=>b.dataset.input).sort(),time:document.querySelector('#timer')?.textContent}));
   trace.push({observed:d,time,requested,actual});
   if(touch&&actual.state.mode==='play')expect(actual.held).toEqual([...requested].sort());
   await page.waitForTimeout(20);
  }
 } finally {await input([]);await session?.detach();trace.push({events:await page.evaluate(()=>(window as any).landingEvents),timing:await page.evaluate(()=>{const t=(window as any).landingTiming;t.running=false;const a=t.intervals as number[],sorted=[...a].sort((a,b)=>a-b);return{...t,fps:1000/(a.reduce((a,b)=>a+b,0)/a.length),p95:sorted[Math.floor(sorted.length*.95)],max:Math.max(...a),note:'Every observed interval retained from driver setup through completion; no first-frame trimming. Separate from historical gate. Capture routes include screenshot overhead.'};}),final:await read(page),stopped:[...stopped]});}
 expect((await read(page)).status).toBe('clear');expect(Number((await read(page)).jumps)).toBe(9);expect(stopped.size).toBe(stopOnPads?2:0);
}
