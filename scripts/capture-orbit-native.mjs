// Screenshot-only rAF hold after ordinary steering; no game state is written.
import {chromium} from '@playwright/test';
import fs from 'node:fs/promises';
const phase=process.argv[2];
if(!['before','after'].includes(phase))throw Error('Expected before or after');
const base=process.env.ORBIT_BASE_URL || 'http://127.0.0.1:4322';
const out='docs/release/orbit-capsule/evidence';
const browser=await chromium.launch({executablePath:'/usr/bin/chromium',args:['--no-sandbox','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
try {
  const page=await browser.newPage({locale:'ja-JP',viewport:{width:390,height:844},hasTouch:true,isMobile:true,deviceScaleFactor:1});
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.addInitScript(()=>{
    const raf=requestAnimationFrame;window.captureHold=false;
    window.requestAnimationFrame=callback=>raf(time=>{
      if(window.captureHold)return;
      callback(time);
      const d=document.querySelector('#game')?.dataset;
      if(d?.mode==='play'&&Number(d.x)>=10)window.captureHold=true;
    });
  });
  await page.goto(base+'/games/orbit-ribbon/');
  await page.waitForFunction(()=>document.querySelector('canvas')?.dataset.artAdopted==='true');
  await page.getByRole('button',{name:'ステージ 1 をはじめる'}).click();
  await page.keyboard.down('ArrowLeft');await page.waitForTimeout(370);await page.keyboard.up('ArrowLeft');
  await page.waitForFunction(()=>window.captureHold,null,{polling:100});
  const state=await page.locator('#game').evaluate(e=>({...e.dataset}));
  if(state.mode!=='play'||state.status!=='running'||errors.length)throw Error('Native capture did not remain in active play');
  await page.screenshot({path:`${out}/${phase}-native.png`});
  await fs.writeFile(`${out}/${phase}-native.json`,JSON.stringify({base,browser:browser.version(),viewport:[390,844],method:'Normal start button and ArrowLeft for 370ms; only screenshot-time rAF held at x >= 10. No game-state or camera override.',state,errors},null,2));
  console.log(state);
} finally {await browser.close();}
