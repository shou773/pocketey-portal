import {chromium} from '@playwright/test';
import fs from 'node:fs/promises';
const phase=process.argv[2];const out=process.env.DEPTH_EVIDENCE || 'docs/release/new-games-depth/evidence';await fs.mkdir(out,{recursive:true});
const browser=await chromium.launch({executablePath:'/usr/bin/chromium',args:['--no-sandbox','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
const reports=[];
for(const mobile of [false,true])for(const game of ['pulse','tilt']){
 const context=await browser.newContext({viewport:mobile?{width:390,height:844}:{width:1280,height:900},hasTouch:mobile,isMobile:mobile,deviceScaleFactor:1});const page=await context.newPage();await page.goto(process.env.DEPTH_BASE_URL || 'http://127.0.0.1:4332/');
 await page.setContent(`<canvas id="capture" style="width:${mobile?390:1280}px;height:${mobile?694:650}px;display:block"></canvas><style>body{margin:0}</style>`);
 const result=await page.evaluate(async({game,phase})=>{
  const canvas=document.querySelector('canvas');let state,view;
  if(game==='pulse'){const m=await import('/src/games/prototypes/shooter/model.ts');const v=await import('/src/games/prototypes/shooter/view.ts');state=m.createState(2);for(let i=0;i<9*60;i++)m.step(state,m.STEP,{x:Math.sin(i/180)*2,y:1.8});view=v.createView(canvas);}
  else{const m=await import('/src/games/prototypes/ball/model.ts');const v=await import('/src/games/prototypes/ball/render.ts');state=m.createState(2);state.phase='playing';for(let i=0;i<6/m.STEP;i++){const road=m.track(2,state.z),future=m.track(2,state.z+.7),target=(future.x-road.x)/.7*state.speed+(road.x-state.x)*3,diff=target-state.vx;m.advance(state,{steer:diff>.3?1:diff<-.3?-1:0,brake:road.width<4});}view=v.createView(canvas);}
  view.draw(state);await new Promise(requestAnimationFrame);view.draw(state);const renderer=view.renderer;const stats=renderer?{calls:renderer.info.render.calls,triangles:renderer.info.render.triangles}:view.stats();const data=canvas.toDataURL('image/png');const result={state,stats,width:canvas.width,height:canvas.height,css:{width:canvas.clientWidth,height:canvas.clientHeight},data};view.dispose();return result;
 },{game,phase});const name=`${phase}-${game}-${mobile?'mobile':'desktop'}`;await fs.writeFile(`${out}/${name}.png`,Buffer.from(result.data.split(',')[1],'base64'));delete result.data;reports.push({name,...result});await context.close();
}
await fs.writeFile(`${out}/${phase}.json`,JSON.stringify(reports,null,2));await browser.close();console.log(reports.map(({name,stats,width,height,state})=>({name,stats,width,height,status:state.status||state.phase,time:state.time})));
