import {chromium} from '@playwright/test';
import fs from 'node:fs';
import {stages, SAVE_KEY} from '../../../../src/games/model';
const phase=process.argv[2];
if(!['before','after','observe'].includes(phase)) throw Error('before, after or observe');
const out=new URL(`./${phase}/`,import.meta.url).pathname; fs.mkdirSync(out,{recursive:true});
const browser=await chromium.launch({executablePath:'/usr/bin/chromium',args:['--no-sandbox','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
const reports=[];
try {
 for(const width of phase==='observe'?[390]:[390,1280]) for(const checkpoint of phase==='observe'?['late-steer','late-jump']:['start','gap','motion']) {
  if(checkpoint==='motion'&&width!==390)continue;
  const context=await browser.newContext({locale:'ja-JP',viewport:{width,height:width===390?844:720},isMobile:width===390,hasTouch:width===390,deviceScaleFactor:1});
  const page=await context.newPage(); const errors:string[]=[];
  page.on('pageerror',e=>errors.push(e.message));
  await page.addInitScript(key=>{
   localStorage.setItem(key,JSON.stringify({version:1,sound:false,orbit:{unlocked:3,best:[13,16,18]}}));
   const raf=requestAnimationFrame.bind(window);
   (window as any).held=false;
   window.requestAnimationFrame=cb=>raf(now=>{if((window as any).held)(window as any).next=cb;else cb(now)});
   const stats={calls:0,triangles:0}; (window as any).drawStats=stats;
   const proto=WebGL2RenderingContext.prototype;
   const clear=proto.clear; proto.clear=function(mask){stats.calls=0;stats.triangles=0;return clear.call(this,mask)};
   const draw=proto.drawElements;proto.drawElements=function(mode,count,type,offset){stats.calls++;if(mode===4)stats.triangles+=count/3;return draw.call(this,mode,count,type,offset)};
   const instanced=proto.drawElementsInstanced;proto.drawElementsInstanced=function(mode,count,type,offset,n){stats.calls++;if(mode===4)stats.triangles+=count/3*n;return instanced.call(this,mode,count,type,offset,n)};
   const arrays=proto.drawArrays;proto.drawArrays=function(mode,first,count){stats.calls++;if(mode===4)stats.triangles+=count/3;return arrays.call(this,mode,first,count)};
  },SAVE_KEY);
  await page.goto((process.env.ORBIT_BASE_URL||'http://127.0.0.1:4322')+'/games/orbit-ribbon/?lang=ja');
  await page.waitForFunction(()=>document.querySelector('canvas')?.dataset.artAdopted==='true');
  await page.addStyleTag({content:'astro-dev-toolbar{display:none!important}'});
  if(checkpoint!=='start')await page.getByRole('button',{name:/ステージ 3 /}).click();
  await page.evaluate(()=>{(window as any).held=true});
  await page.waitForFunction(()=>!!(window as any).next,null,{polling:50});
  await page.getByRole('button',{name:`ステージ ${checkpoint==='start'?1:3} をはじめる`}).evaluate(button=>{
   (button as HTMLButtonElement).click();(window as any).now=performance.now();(window as any).next((window as any).now);
  });
  const trace=[];let lastJump=-10;const held=new Set<string>();let motion=0;let approached=false;
  const frames=[24.2,25.2,26.2,27.5,29.2,31.2];
  if(checkpoint!=='start')for(let i=0;i<420;i++) {
   const d=await page.locator('#game').evaluate(e=>Object.fromEntries(Object.entries((e as HTMLElement).dataset).filter(([key])=>!key.startsWith('astro'))));
   const x=Number(d.x),z=Number(d.z),time=Number(d.time||x/7);
   if(d.status!=='running'){if(phase==='observe')break;throw Error(JSON.stringify(d));}
   if(phase==='observe'&&!approached&&x>=(checkpoint==='late-steer'?13:25.9)){
    await page.screenshot({path:`${out}${width}-${checkpoint}-approach.png`});approached=true;
   }
   if(phase==='observe'&&checkpoint==='late-jump'){
    if(!motion&&x>=27.5){await page.screenshot({path:`${out}${width}-${checkpoint}-airborne.png`});motion++;}
    if(x>=31.2)break;
   }
   if(checkpoint==='motion'&&motion<frames.length&&x>=frames[motion]){
    await page.screenshot({path:`${out}${width}-motion-${motion+1}.png`});motion++;
   }
   if(phase!=='observe'&&x>=(checkpoint==='gap'?20.7:31.2))break;
   const tile=stages.orbit[2].platforms.find(p=>x>=p.a-.23&&x<=p.b+.23);
   const gap=!!tile&&tile.b<stages.orbit[2].length&&tile.b-x<1.1&&tile.b-x>-.15;
   const h=stages.orbit[2].hazards.find(h=>h.x+h.d/2+.3>x),target=h&&h.x-x<(checkpoint==='late-steer'?1:12)?(h.z>=0?-1.85:1.85):0;
   const axis=Math.abs(target-z)<.18?0:Math.sign(target-z);
   const jump=checkpoint==='late-jump'?(x>=26.35&&x<26.5):gap&&d.grounded==='true'&&time-lastJump>.3;if(jump)lastJump=time;
   const keys=[...(axis?[axis>0?'ArrowRight':'ArrowLeft']:[]),...(jump?['Space']:[])];
   for(const k of held)if(!keys.includes(k))await page.keyboard.up(k);
   for(const k of keys)if(!held.has(k))await page.keyboard.down(k);
   held.clear();keys.forEach(k=>held.add(k));trace.push({state:d,keys});
   await page.evaluate(()=>{(window as any).now+=1000/60;(window as any).next((window as any).now)});
  }
  await page.screenshot({path:`${out}${width}-${checkpoint}.png`});
  reports.push({width,checkpoint,state:await page.locator('#game').evaluate(e=>Object.fromEntries(Object.entries((e as HTMLElement).dataset).filter(([key])=>!key.startsWith('astro')))),canvas:await page.locator('canvas').evaluate(c=>({width:(c as HTMLCanvasElement).width,height:(c as HTMLCanvasElement).height,art:(c as HTMLElement).dataset.art})),stats:await page.evaluate(()=>(window as any).drawStats),errors});
  if(trace.length)fs.writeFileSync(`${out}${width}-${checkpoint}-inputs.json`,JSON.stringify(trace));
  await context.close();
 }
 fs.writeFileSync(out+'capture.json',JSON.stringify({method:'Native saved stage selection and start button; normal keyboard input. Held rAF advances at 60Hz for identical simulation states, with no physics writes. DPR 1, same viewport/camera, same assets adopted. Draw submissions counted through WebGL2 calls.',reports},null,2));
} finally {await browser.close()}
