// One bounded real-WebGL capture. Deliberately separate from input tests.
// Start `npm run preview -- --host 127.0.0.1 --port 4341` after building.
import { chromium } from '@playwright/test';
import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
const directory='docs/prototypes/alpine/evidence';
await fs.mkdir(directory,{recursive:true});
const browser=await chromium.launch({executablePath:process.env.CI?undefined:'/usr/bin/chromium',args:['--no-sandbox','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
const report={browser:browser.version(),rendering:'Real Three.js / SwiftShader',clock:'Controlled for repeatable screenshots; NOT a performance result',errors:[],screenshots:[]};
try {
  const page=await browser.newPage({viewport:{width:390,height:844},deviceScaleFactor:1,hasTouch:true,locale:'ja-JP'});
  page.setDefaultTimeout(15000);page.on('pageerror',e=>report.errors.push(e.message));
  await page.clock.install();
  await page.goto('http://127.0.0.1:4341/prototypes/alpine-drive/?lang=ja');
  await page.getByRole('button',{name:'ドライブ開始',exact:true}).waitFor();
  await page.clock.pauseAt(new Date(Date.now()+1000));
  await page.screenshot({path:`${directory}/01-ready.png`});report.screenshots.push('01-ready.png');
  await page.getByRole('button',{name:'ドライブ開始',exact:true}).click();
  await page.clock.runFor(1500);
  const cdp=await page.context().newCDPSession(page);
  await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:195,y:520,id:1}]});
  await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:115,y:520,id:1}]});
  await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
  await cdp.detach();await page.clock.runFor(50);
  report.queued=await page.locator('#alpine').evaluate(e=>({...e.dataset}));
  assert.equal(report.queued.queued,'-1');assert.equal(report.queued.phase,'playing');
  assert.ok(Number(report.queued.triangles)>0);assert.ok(Number(report.queued.drawCalls)>0);
  await page.screenshot({path:`${directory}/02-turn-queued.png`});report.screenshots.push('02-turn-queued.png');
  await page.clock.runFor(1300);
  report.afterTurn=await page.locator('#alpine').evaluate(e=>({...e.dataset}));
  assert.equal(report.afterTurn.heading,'-1');assert.equal(report.afterTurn.gate,'1');assert.equal(report.afterTurn.phase,'playing');
  await page.screenshot({path:`${directory}/03-after-turn.png`});report.screenshots.push('03-after-turn.png');
  assert.deepEqual(report.errors,[]);report.passed=true;
} catch(error) {report.passed=false;report.failure=String(error);process.exitCode=1;}
finally {await fs.writeFile(`${directory}/render-smoke.json`,JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report,null,2));await browser.close();}
