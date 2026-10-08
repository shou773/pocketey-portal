import {expect,type Page} from '@playwright/test';
import {stages,type Kind} from '../../src/games/model';
export const read = (page:Page) => page.locator('#game').evaluate(e=>({... (e as HTMLElement).dataset}));
export async function play(page:Page,kind:Kind,index:number,touch=false,trace?:unknown[],settleAmberJumps=false){
 const level=stages[kind][index];const down=new Set<string>();let lastJump=-10;const started=Date.now();
 const session=touch?await page.context().newCDPSession(page):null;
 const points:Record<string,{x:number;y:number;id:number}>={};
 for(const [i,name] of ['left','right','jump'].entries()){const b=await page.locator(`[data-input=${name}]`).boundingBox();points[name]={x:b!.x+b!.width/2,y:b!.y+b!.height/2,id:i+1};}
 async function input(names:string[]){
  if(session){
   const added=names.filter(n=>!down.has(n)),removed=[...down].filter(n=>!names.includes(n));
   if(removed.length)await session.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:removed.map(n=>points[n])});
   if(added.length)await session.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:names.map(n=>points[n])});
   down.clear();names.forEach(n=>down.add(n));
  }
  else {for(const key of [...down])if(!names.includes(key)){await page.keyboard.up(key);down.delete(key);}for(const key of names)if(!down.has(key)){await page.keyboard.down(key);down.add(key);}}
 }
 while(Date.now()-started<50000){
  const readStarted=Date.now();const d=await read(page);const readFinished=Date.now();if(d.status!=='running')break;
  const x=Number(d.x),z=Number(d.z),t=x/(kind==='orbit'?7:5);const tile=level.platforms.find(p=>x>=p.a-.23&&x<=p.b+.23);
  const gap=!!tile&&tile.b<level.length&&tile.b-x<(kind==='orbit'?1.1:1.0)&&tile.b-x>-.15;
  // Trigger near the early safe takeoff edge, leaving room for browser/CDP delivery.
  // Amber3 combos have sampled windows [spikeX-1.8, spikeX-1.0]; a
  // 1.35m trigger was centred before delivery and arrived beyond that window in CI.
  const spike=kind==='amber'&&level.hazards.some(h=>h.x-x<(tile && tile.b-h.x<.9?1.7:2.0)&&h.x-x>0);
  let axis=1;if(kind==='orbit'){const h=level.hazards.find(h=>h.x+h.d/2+.3>x);const target=h&&h.x-x<12?(h.z>=0?-1.85:1.85):0;axis=Math.abs(target-z)<.18?0:Math.sign(target-z);}
  const jump=(gap||spike)&&d.grounded==='true'&&t-lastJump>.3;if(jump)lastJump=t;
  const names:string[]=[];if(axis)names.push(touch?(axis>0?'right':'left'):(axis>0?'ArrowRight':'ArrowLeft'));if(jump)names.push(touch?'jump':'Space');
  if(settleAmberJumps&&kind==='amber'&&jump){
   // Release movement while a native jump travels through CDP, then resume
   // after physics confirms acceptance in the asset-fallback check.
   await input([]);await input([touch?'jump':'Space']);
   await expect.poll(async()=>{const state=await read(page);return Number(state.jumps)>Number(d.jumps)&&(!spike||Number(state.y)>=.65);},{timeout:1500}).toBe(true);
  }
  await input(names);
  trace?.push({stage:index+1,readStarted,readFinished,inputFinished:Date.now(),x:d.x,y:d.y,z:d.z,names});
  await page.waitForTimeout(25);
 }
 await input([]);await session?.detach();expect((await read(page)).status,`${kind}/${index+1} ${JSON.stringify(await read(page))}`).toBe('clear');
}
