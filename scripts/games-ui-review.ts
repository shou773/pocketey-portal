import {chromium} from 'playwright';
import fs from 'node:fs';
import {play} from '../tests/games/input';
const label=process.argv[2];if(!['before','after'].includes(label))throw new Error('Use before or after');
const out=`docs/games/evidence/ui-refresh/${label}`;fs.mkdirSync(out,{recursive:true});
const browser=await chromium.launch({executablePath:'/usr/bin/chromium',args:['--no-sandbox','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
try{for(const kind of ['orbit','amber'] as const){
 const c=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true,deviceScaleFactor:1});const p=await c.newPage();
 await p.goto(`http://127.0.0.1:4322/games/${kind==='orbit'?'orbit-ribbon':'amber-step'}/`);
 await p.waitForFunction(()=>document.querySelector('#game')?.getAttribute('data-mode')==='menu');
 await p.waitForTimeout(350);await p.screenshot({path:`${out}/${kind}-390-start.png`});
 await p.setViewportSize({width:320,height:568});await p.waitForTimeout(250);await p.waitForTimeout(350);await p.screenshot({path:`${out}/${kind}-320-start.png`});
 await p.setViewportSize({width:390,height:844});await p.getByRole('button',{name:'ステージ 1 をはじめる'}).click();await p.locator('#pause').click();
 await p.waitForTimeout(350);await p.screenshot({path:`${out}/${kind}-390-pause.png`});
 await p.getByRole('button',{name:'つづける'}).click();await p.waitForTimeout(350);await p.screenshot({path:`${out}/${kind}-390-play.png`});
 await p.keyboard.press('KeyR');await p.waitForFunction(()=>document.querySelector('#game')?.getAttribute('data-status')==='running');await play(p,kind,0,true);
 await p.waitForTimeout(350);await p.screenshot({path:`${out}/${kind}-390-clear.png`});
 await p.keyboard.press('KeyR');if(kind==='amber')await p.keyboard.down('ArrowRight');
 await p.waitForFunction(()=>document.querySelector('#game')?.getAttribute('data-status')==='dead');await p.keyboard.up('ArrowRight');
 await p.waitForTimeout(350);await p.screenshot({path:`${out}/${kind}-390-retry.png`});
 await p.getByRole('button',{name:'すぐにリトライ'}).click();await p.locator('#pause').click();await p.setViewportSize({width:844,height:390});
 await p.waitForTimeout(300);await p.waitForTimeout(350);await p.screenshot({path:`${out}/${kind}-844-pause.png`});await c.close();console.log(kind,label,'captured');
}}finally{await browser.close()}
