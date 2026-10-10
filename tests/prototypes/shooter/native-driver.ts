import type {Page} from '@playwright/test';import {chooseLane,type Observation} from './controller';
export const readPulse=async(page:Page):Promise<Observation>=>JSON.parse((await page.locator('#pulse').getAttribute('data-state'))!);
export async function drivePulse(page:Page,touch:boolean,observe?:(s:Observation)=>Promise<void>,choose=chooseLane){
 const initial=await readPulse(page),rect=(await page.locator('#field').boundingBox())!,center=rect.x+rect.width/2,a=initial.limits[0],b=initial.limits[1],f=(initial.screen.y-b.y)/(a.y-b.y),ppu=((center-a.x)*f+(b.x-center)*(1-f))/3.8,ty=initial.screen.y;
 const cdp=await page.context().newCDPSession(page);let held:string|null=null,last=-1,inputs=0,minHp=4,maxCalls=0,maxTriangles=0;const trace:Observation[]=[];let arrivalSeen=false,bossSeen=false,beamSeen=false;
 if(touch)await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:center,y:ty,id:1}]});
 const start=Date.now();try{while(Date.now()-start<100000){const s=await readPulse(page);minHp=Math.min(minHp,s.hp);maxCalls=Math.max(maxCalls,s.render.calls);maxTriangles=Math.max(maxTriangles,s.render.triangles);if(s.status!=='playing')break;if(s.time===last){await page.waitForTimeout(20);continue;}last=s.time;
  if(s.time>=28&&s.time<=32.2)trace.push(s);if(s.enemies.some(e=>e.kind==='boss'))bossSeen=true;if(s.beams.some(b=>b.age<1.3)&&s.time>=30)beamSeen=true;if(await page.locator('#arrival').isVisible())arrivalSeen=true;
  if(observe)await observe(s);
  const best=choose(s);if(touch){await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:Math.max(rect.x+5,Math.min(rect.x+rect.width-5,center+best*ppu)),y:ty,id:1}]});inputs++;}else{const key=Math.abs(best-s.x)>.13?(best>s.x?'ArrowRight':'ArrowLeft'):null;if(key){await page.keyboard.down(key);held=key;inputs++;await page.waitForTimeout(50);await page.keyboard.up(key);held=null;}}
  await page.waitForTimeout(touch?50:20);
 }}finally{if(touch)await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});else if(held)await page.keyboard.up(held);}
 await page.waitForTimeout(150);return{final:await readPulse(page),inputs,minHp,maxCalls,maxTriangles,arrivalSeen,bossSeen,beamSeen,trace,elapsedMs:Date.now()-start,note:'Ordinary keyboard/CDP touch with original four shields. Observational feasibility, not a novice or physical-phone claim.'};
}
