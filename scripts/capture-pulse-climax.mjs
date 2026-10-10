import {chooseTimeoutLane} from '../tests/prototypes/shooter/timeout-driver.ts';
import {chromium} from '@playwright/test';import {createServer} from 'node:http';import {readFile,stat,mkdir,writeFile,readdir} from 'node:fs/promises';import {createHash} from 'node:crypto';import path from 'node:path';import {drivePulse,readPulse} from '../tests/prototypes/shooter/native-driver.ts';
const before=process.argv[2];if(!before)throw Error('Expected frozen baseline dist');const out='test-results/pulse-climax/comparison';await mkdir(out,{recursive:true});
const types={'.html':'text/html','.js':'text/javascript','.css':'text/css','.json':'application/json','.png':'image/png','.svg':'image/svg+xml','.glb':'model/gltf-binary','.wav':'audio/wav','.ogg':'audio/ogg','.mp3':'audio/mpeg'};
async function serve(root,port){const server=createServer(async(req,res)=>{try{let file=path.join(root,decodeURIComponent(new URL(req.url,'http://localhost').pathname));if((await stat(file)).isDirectory())file=path.join(file,'index.html');res.setHeader('Content-Type',types[path.extname(file)]??'application/octet-stream');res.end(await readFile(file));}catch{res.statusCode=404;res.end('Not found');}});await new Promise(resolve=>server.listen(port,'127.0.0.1',resolve));return server;}
async function manifest(root,prefix=''){const result={};for(const e of await readdir(path.join(root,prefix),{withFileTypes:true})){const name=path.join(prefix,e.name);if(e.isDirectory())Object.assign(result,await manifest(root,name));else result[name]=createHash('sha256').update(await readFile(path.join(root,name))).digest('hex');}return result;}
const a=await manifest(before),b=await manifest(path.resolve('dist')),files=[...new Set([...Object.keys(a),...Object.keys(b)])].sort();const fileComparison={identical:files.filter(p=>a[p]&&a[p]===b[p]),different:files.filter(p=>a[p]!==b[p])};
const servers=[await serve(before,4364),await serve(path.resolve('dist'),4365)],browser=await chromium.launch({args:['--no-sandbox','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']}),samples=[];
const helpCaptures=[];
try{for(const[label,port]of[['before',4364],['after',4365]])for(const profile of[{width:390,height:844,art:'ready'},{width:320,height:568,art:'ready'},{width:320,height:568,art:'fallback'}]){
 const tag=`${profile.width}-${profile.art}`;
 const context=await browser.newContext({viewport:{width:profile.width,height:profile.height},deviceScaleFactor:1,hasTouch:true,isMobile:true,reducedMotion:'reduce'}),page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
 if(profile.art==='fallback')await page.route('**/pulse-vehicles.glb',route=>route.abort());
 await page.addInitScript(()=>{const raf=window.requestAnimationFrame;window.__pulseFrames=[];let last=0;window.requestAnimationFrame=function(cb){return raf.call(window,t=>{const start=performance.now();cb(t);if(last)window.__pulseFrames.push({delta:t-last,work:performance.now()-start});last=t;});};});
 await page.goto(`http://127.0.0.1:${port}/games/pulse-drift/?lang=en`);await page.waitForFunction(art=>document.querySelector('canvas').dataset.pulseArt===art,profile.art);await page.getByRole('button',{name:'Stage 3',exact:true}).click();await page.screenshot({path:`${out}/${label}-menu-${tag}.png`});await page.getByRole('button',{name:'Launch',exact:true}).click();await page.waitForFunction(()=>JSON.parse(document.querySelector('#pulse').dataset.state).time>.1);await page.evaluate(()=>window.__pulseFrames=[]);
 const captured=[],done=new Set();const result=await drivePulse(page,true,async s=>{for(const[name,time]of[['normal',4.2],['warning-minimum',5.23],['sweep',24.8],['arrival',28.7],['handoff',30.5]])if(s.time>=time&&!done.has(name)){done.add(name);const before=await readPulse(page);await page.screenshot({path:`${out}/${label}-${name}-native-${tag}.png`});const after=await readPulse(page);captured.push({name,before,after,notice:await page.locator('#arrival').count()?await page.locator('#arrival').textContent():null});}});
 const frames=await page.evaluate(()=>window.__pulseFrames),deltas=frames.map(f=>f.delta).sort((a,b)=>a-b),work=frames.map(f=>f.work).sort((a,b)=>a-b),environment=await page.evaluate(()=>{const c=document.querySelector('canvas'),gl=c.getContext('webgl2'),ext=gl.getExtension('WEBGL_debug_renderer_info');return{viewport:[innerWidth,innerHeight],framebuffer:[c.width,c.height],dpr:devicePixelRatio,hover:matchMedia('(hover:hover)').matches,fine:matchMedia('(pointer:fine)').matches,reducedMotion:matchMedia('(prefers-reduced-motion:reduce)').matches,renderer:ext?gl.getParameter(ext.UNMASKED_RENDERER_WEBGL):gl.getParameter(gl.RENDERER)};});
 const sample={label,profile,...result,captured,environment,performance:{frames:frames.length,fps:1000/(deltas.reduce((a,b)=>a+b,0)/deltas.length),p95:deltas[Math.floor(deltas.length*.95)],workP95:work[Math.floor(work.length*.95)],raw:frames},errors};samples.push(sample);await writeFile(`${out}/${label}-course3-${tag}.json`,JSON.stringify(sample,null,2));await page.screenshot({path:`${out}/${label}-clear-${tag}.png`});if(result.final.status!=='won'||captured.length!==5||errors.length)throw Error(`Incomplete ${label} ordinary capture route`);await context.close();

}

// Same-condition header pixels are separate from the timed gameplay captures.
for(const[label,port]of[['before',4364],['after',4365]])for(const game of['orbit-ribbon','amber-step']){
 const context=await browser.newContext({viewport:{width:320,height:568},deviceScaleFactor:1,hasTouch:true,isMobile:true,reducedMotion:'reduce'}),page=await context.newPage();
 for(const lang of['en','ja']){
  await page.goto(`http://127.0.0.1:${port}/games/${game}/?lang=${lang}`);const sound=page.locator('#sound');if(await sound.getAttribute('aria-pressed')==='true')await sound.click();
  await page.getByRole('button',{name:lang==='en'?'Start stage 1':'ステージ 1 をはじめる',exact:true}).click();await page.keyboard.press('Escape');
  for(const enabled of[false,true]){
   if((await sound.getAttribute('aria-pressed')==='true')!==enabled)await sound.click();await page.keyboard.press('Tab');await page.locator('#pause').focus();
   const controls=await page.locator('.game-bar button').evaluateAll(elements=>elements.map(e=>{const r=e.getBoundingClientRect();return{text:e.textContent,x:r.x,y:r.y,width:r.width,height:r.height};}));
   const file=`${label}-header-${game}-${lang}-${enabled?'on':'off'}-320.png`;await page.screenshot({path:`${out}/${file}`});helpCaptures.push({label,game,lang,enabled,controls,file});
  }
 }
 await context.close();
}
// The candidate timeout route already ran in the native suite. Capture the old
// advice once with the same ordinary touch policy, without a second candidate run.
{
 const context=await browser.newContext({viewport:{width:320,height:568},deviceScaleFactor:1,hasTouch:true,isMobile:true,reducedMotion:'reduce'}),page=await context.newPage();
 await page.goto('http://127.0.0.1:4364/games/pulse-drift/?lang=en');await page.getByRole('button',{name:'Stage 3',exact:true}).click();await page.getByRole('button',{name:'Launch',exact:true}).click();
 await page.waitForFunction(()=>JSON.parse(document.querySelector('#pulse').dataset.state).time>.1);const result=await drivePulse(page,true,undefined,chooseTimeoutLane);
 await writeFile(`${out}/before-deadline-320.json`,JSON.stringify(result,null,2));await page.screenshot({path:`${out}/before-deadline-320-en.png`});
 if(result.final.status!=='lost'||result.final.hp<=0||result.final.time+1e-9<48||!result.final.enemies.some(e=>e.kind==='boss'&&e.hp>0))throw Error('Baseline timeout observation was not a real surviving-shield deadline');
 const files=await readdir('test-results/pulse-climax/native',{recursive:true}),candidate=files.find(p=>p.endsWith('deadline-route.json'));
 if(!candidate)throw Error('Candidate native deadline evidence is missing');const after=JSON.parse(await readFile(path.join('test-results/pulse-climax/native',candidate),'utf8'));
 if(after.final.status!=='lost'||after.final.hp<=0||after.final.time+1e-9<48)throw Error('Candidate native deadline evidence is invalid');
 helpCaptures.push({kind:'deadline',baseline:'before-deadline-320.json',candidate:`../native/${candidate}`,note:'Same320px touch/reduced-motion profile and controller. The candidate result/language/retry/save assertions run in the native suite; the baseline is captured once here.'});await context.close();
}

}finally{await writeFile(`${out}/report.json`,JSON.stringify({source:process.env.SOURCE_SHA,baseline:'f39361caddbf992179f21edf62d59925dc214866',fileComparison,samples,helpCaptures,note:'Matched accepted/current unchanged boss scenes at390/320, with a separate blocked-art fallback pair and shared320px header pairs. Original4HP ordinary touch routes; no in-run state writes. Warning, white core and pink bullets are unchanged. Before/after use identical profile, reduced motion and controller. Full intervals retain screenshot overhead and are diagnostic, not a speedup or physical-phone claim.'},null,2));await browser.close();for(const server of servers)server.close();}
