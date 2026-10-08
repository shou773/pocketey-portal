import { chromium } from '@playwright/test';
import fs from 'node:fs/promises';
const browser=await chromium.launch({executablePath:'/usr/bin/chromium',args:['--no-sandbox','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
const frames=[],errors=[];
try {
 const context=await browser.newContext({viewport:{width:390,height:844},deviceScaleFactor:1,hasTouch:true,isMobile:true});
 const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));
 await page.goto(`${process.env.TILT_ART_BASE||'http://127.0.0.1:4342'}/games/tilttrail/?lang=en`);
 await page.getByRole('button',{name:'Play this stage'}).click();
 const session=await context.newCDPSession(page);
 const point=async(type,id)=>{const b=await page.locator(`[data-tt-input="${type}"]`).boundingBox();return {id,x:b.x+b.width/2,y:b.y+b.height/2,radiusX:5,radiusY:5,force:1};};
 const end=()=>session.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
 const start=async types=>session.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:await Promise.all(types.map((type,i)=>point(type,i+1)))});
 const snapshot=()=>page.locator('#tilttrail').evaluate(el=>({state:{...el.dataset},held:[...el.querySelectorAll('[data-tt-input]')].filter(b=>b.getAttribute('aria-pressed')==='true').map(b=>b.getAttribute('data-tt-input'))}));
 async function capture(name){const before=await snapshot();await page.screenshot({path:new URL(`./evidence/sequence-${name}.png`,import.meta.url).pathname});frames.push({name,before,after:await snapshot()});}
 await start(['brake']);
 await page.waitForFunction(()=>Number(document.querySelector('#tilttrail').dataset.time)>=1.5);await capture('01-braking');
 await page.waitForFunction(()=>Number(document.querySelector('#tilttrail').dataset.time)>=3);await capture('02-rolling');
 await page.waitForFunction(()=>Number(document.querySelector('#tilttrail').dataset.z)>=10);
 await end();await start(['left','brake']);await page.waitForTimeout(220);await capture('03-turning-braked');
 await end();await start(['brake']);await page.waitForTimeout(200);await capture('04-settling');
 await end();await page.waitForTimeout(350);await capture('05-released');
 if(errors.length||frames.some(f=>f.after.state.phase!=='playing'))throw Error('Unexpected play interruption');
 await fs.writeFile(new URL('./evidence/play-sequence.json',import.meta.url),JSON.stringify({input:'native CDP multi-touch only; no keyboard/model/time writes',viewport:[390,844],errors,frames},null,2)+'\n');
 console.log(frames.map(f=>({name:f.name,time:f.after.state.time,z:f.after.state.z,calls:f.after.state.drawCalls,triangles:f.after.state.triangles,held:f.after.held})));
}finally{await browser.close();}
