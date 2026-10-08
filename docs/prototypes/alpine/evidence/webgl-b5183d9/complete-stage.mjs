import { chromium } from '@playwright/test';
import { fileURLToPath } from 'node:url';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
const directory=fileURLToPath(new URL('.',import.meta.url));
const flags=['--no-sandbox','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader'];
const report={sourceHead:'b5183d9835b7b9c2ddbbbbd0e371c7a22639e5f0',attempts:1,clock:'Ordinary wall clock; NOT an FPS or device-performance measurement',renderer:'Real Three.js / SwiftShader; no interception',input:'CDP touch flicks only, then the visible Retry button; no input or state mutation',flags,turns:[],errors:[],screenshots:[]};
let browser,page;
const started=Date.now();
try{
 browser=await chromium.launch({executablePath:'/usr/bin/chromium',args:flags});report.browser=browser.version();
 page=await browser.newPage({viewport:{width:390,height:844},deviceScaleFactor:1,hasTouch:true,locale:'ja-JP'});
 page.setDefaultTimeout(15000);page.on('pageerror',e=>report.errors.push(e.message));
 const state=()=>page.locator('#alpine').evaluate(e=>({...e.dataset}));
 const capture=async name=>{await page.screenshot({path:directory+'/'+name,fullPage:true});report.screenshots.push(name);};
 await page.goto((process.env.ALPINE_REVIEW_ORIGIN || 'http://127.0.0.1:4342')+'/prototypes/alpine-drive/?lang=ja');
 await page.waitForFunction(()=>Number(document.querySelector('#alpine')?.dataset.drawCalls)>0);
 await page.getByRole('button',{name:'ドライブ開始',exact:true}).click();
 for(const [index,direction] of [-1,1,1,-1].entries()){
  await page.waitForFunction(i=>{const d=document.querySelector('#alpine').dataset;return d.phase==='failed'||(Number(d.gate)===i&&d.window==='true');},index,{timeout:15000});
  const before=await state();assert.equal(before.phase,'playing');assert.equal(before.gate,String(index));assert.equal(before.window,'true');
  const rect=await page.locator('#ad-canvas').boundingBox(),x=rect.x+rect.width*.5,y=rect.y+rect.height*.6;
  const session=await page.context().newCDPSession(page);
  await session.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x,y,id:1}]});
  await session.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:x+direction*80,y:y+3,id:1}]});
  await session.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});await session.detach();
  const queued=await state();assert.equal(queued.queued,String(direction));
  await page.waitForFunction(i=>{const d=document.querySelector('#alpine').dataset;return d.phase==='failed'||Number(d.gate)>i;},index,{timeout:10000});
  const after=await state();assert.equal(after.phase,'playing');assert.equal(after.gate,String(index+1));
  report.turns.push({index,direction,before,queued,after});
  if(index===0)await capture('04-full-run-first-turn.png');
 }
 await page.waitForFunction(()=>{const d=document.querySelector('#alpine').dataset;return d.phase==='failed'||Number(d.z)>=46;},undefined,{timeout:10000});
 assert.equal((await state()).phase,'playing');await capture('05-full-run-near-finish.png');
 await page.waitForFunction(()=>['failed','clear'].includes(document.querySelector('#alpine').dataset.phase),undefined,{timeout:10000});
 report.goal=await state();assert.equal(report.goal.phase,'clear');assert.equal(report.goal.gate,'4');
 assert.equal(await page.locator('#ad-title').textContent(),'ゴール！');
 report.saved=await page.evaluate(()=>JSON.parse(localStorage.getItem('pocketey-alpine-prototype-v1')));assert.equal(report.saved.clears,1);
 await capture('06-full-run-goal.png');
 await page.getByRole('button',{name:'すぐリトライ',exact:true}).click();
 report.retry=await state();assert.equal(report.retry.phase,'playing');assert.equal(report.retry.gate,'0');assert.equal(report.retry.heading,'0');assert.equal(report.retry.queued,'null');assert.ok(Number(report.retry.z)<1);
 await capture('07-full-run-retry.png');assert.deepEqual(report.errors,[]);report.passed=true;
}catch(error){report.passed=false;report.failure=String(error);process.exitCode=1;if(page){report.failureState=await page.locator('#alpine').evaluate(e=>({...e.dataset})).catch(()=>null);await page.screenshot({path:directory+'/full-run-failure.png',fullPage:true,timeout:5000}).catch(()=>{});}}
finally{report.wallDurationMs=Date.now()-started;if(browser)await browser.close();await fs.writeFile(directory+'/complete-stage.json',JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify({passed:report.passed,turns:report.turns.length,goal:report.goal,retry:report.retry,errors:report.errors,failure:report.failure,wallDurationMs:report.wallDurationMs},null,2));}
