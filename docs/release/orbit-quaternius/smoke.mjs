import {chromium} from '@playwright/test';import fs from 'node:fs';
const b=await chromium.launch({executablePath:'/usr/bin/chromium',args:['--no-sandbox','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});const reports=[];
for(const fallback of [false,true]) {
 const c=await b.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true});const p=await c.newPage();const errors=[];p.on('pageerror',e=>errors.push(e.message));if(fallback)await p.route('**/quaternius-2021/challenger.glb',r=>r.abort());
 await p.goto('http://127.0.0.1:4352/games/orbit-ribbon/?lang=ja');await p.waitForFunction(()=>document.querySelector('canvas')?.dataset.artAdopted==='true');await p.getByRole('button',{name:'ステージ 1 をはじめる'}).tap();
 const read=()=>p.locator('#game').evaluate(e=>Object.fromEntries(Object.entries(e.dataset).filter(([k])=>!k.startsWith('astro'))));
 await p.waitForFunction(()=>Number(document.querySelector('#game').dataset.x)>.7);const playing=await read();
 

 await p.getByRole('button',{name:'一時停止',exact:true}).tap();const paused=await read();await p.getByRole('button',{name:'つづける',exact:true}).tap();await p.waitForFunction(()=>Number(document.querySelector('#game').dataset.x)>1.5);const resumed=await read();
 reports.push({fallback,craft:await p.locator('canvas').getAttribute('data-orbit-craft'),playing,paused,resumed,errors});await c.close();
}
await b.close();fs.writeFileSync(new URL('./smoke.json',import.meta.url),JSON.stringify(reports,null,2));
