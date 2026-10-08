import { chromium } from '@playwright/test';
import fs from 'node:fs/promises';
const phase=process.argv[2]||'after',base=process.env.TILT_ART_BASE||'http://127.0.0.1:4342';
const browser=await chromium.launch({executablePath:'/usr/bin/chromium',args:['--no-sandbox','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
const reports=[];
try {
 for(const mobile of [true,false]) {
  const context=await browser.newContext({viewport:mobile?{width:390,height:844}:{width:1280,height:900},hasTouch:mobile,isMobile:mobile,deviceScaleFactor:1});
  const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto(base);
  await page.setContent(`<canvas style="width:${mobile?390:1280}px;height:${mobile?694:750}px;display:block"></canvas><style>body{margin:0}</style>`);
  const result=await page.evaluate(async()=>{
   const m=await import('/src/games/prototypes/ball/model.ts'),v=await import('/src/games/prototypes/ball/render.ts');
   const state=m.createState(2);state.phase='playing';
   for(let i=0;i<6/m.STEP;i++){
    const road=m.track(2,state.z),future=m.track(2,state.z+.7),target=(future.x-road.x)/.7*state.speed+(road.x-state.x)*3,diff=target-state.vx;
    m.advance(state,{steer:diff>.3?1:diff<-.3?-1:0,brake:road.width<4});
   }
   const canvas=document.querySelector('canvas'),view=v.createView(canvas);await view.ready;
   view.draw(state);await new Promise(requestAnimationFrame);view.draw(state);
   const result={state,css:[canvas.clientWidth,canvas.clientHeight],framebuffer:[canvas.width,canvas.height],calls:view.renderer.info.render.calls,triangles:view.renderer.info.render.triangles,image:canvas.toDataURL()};
   view.dispose();return result;
  });
  await fs.writeFile(new URL(`./evidence/${phase}-stage3-${mobile?'mobile':'desktop'}.png`,import.meta.url),Buffer.from(result.image.split(',')[1],'base64'));
  delete result.image;reports.push({mobile,errors,...result});await context.close();
 }
 await fs.writeFile(new URL(`./evidence/${phase}-stage3.json`,import.meta.url),JSON.stringify(reports,null,2)+'\n');console.log(reports);
}finally{await browser.close();}
