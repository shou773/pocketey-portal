// Fixed-state visual probe of the real game renderer. This is not an input test.
// Run against orbit-review-server.mjs; never inject this into the published game.
import {chromium} from '@playwright/test';
import fs from 'node:fs/promises';

const phase=process.argv[2];
if(!['before','after'].includes(phase))throw Error('Expected before or after');
const base=process.env.ORBIT_BASE_URL || 'http://127.0.0.1:4340';
const out='docs/release/orbit-capsule/evidence';
await fs.mkdir(out,{recursive:true});
const browser=await chromium.launch({executablePath:'/usr/bin/chromium',args:['--no-sandbox','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
const reports=[];
try {
  for(const mobile of [false,true]) {
    const context=await browser.newContext({viewport:mobile?{width:390,height:844}:{width:1280,height:720},hasTouch:mobile,isMobile:mobile,deviceScaleFactor:1});
    const sizing=await context.newPage();
    await sizing.goto(base+'/games/orbit-ribbon/');
    const size=await sizing.locator('canvas').evaluate(c=>({width:c.clientWidth,height:c.clientHeight}));
    await sizing.close();
    for(const shot of [
      {name:'approach',stage:0,x:10,z:-1.85,y:0,grounded:true},
      {name:'gap',stage:0,x:24.9,z:0,y:1.35,grounded:false},
      {name:'stage3',stage:2,x:41,z:-1.85,y:0,grounded:true},
    ]) {
      const page=await context.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
      await page.goto(base+'/');
      await page.setContent(`<style>body{margin:0}</style><canvas style="display:block;width:${size.width}px;height:${size.height}px"></canvas>`);
      const result=await page.evaluate(async shot=>{
        const {createView,createState}=await import('/orbit-review-renderer.js');
        const canvas=document.querySelector('canvas');const view=createView(canvas,'orbit');
        view.load(shot.stage);
        const state={...createState('orbit',shot.stage),...shot,time:shot.x/7};
        view.draw(state);
        const started=performance.now();
        while(canvas.dataset.artAdopted!=='true') {
          if(performance.now()-started>15000)throw Error('Art adoption timed out');
          await new Promise(r=>setTimeout(r,20));
        }
        await new Promise(requestAnimationFrame);view.draw(state);
        const gl=view.renderer.getContext(),ext=gl.getExtension('WEBGL_debug_renderer_info');
        const result={state,art:{...canvas.dataset},stats:{calls:view.renderer.info.render.calls,triangles:view.renderer.info.render.triangles,geometries:view.renderer.info.memory.geometries},framebuffer:[canvas.width,canvas.height],css:[canvas.clientWidth,canvas.clientHeight],renderer:ext?gl.getParameter(ext.UNMASKED_RENDERER_WEBGL):gl.getParameter(gl.RENDERER),data:canvas.toDataURL('image/png')};
        return result;
      },shot);
      const name=`${phase}-${mobile?'mobile':'desktop'}-${shot.name}`;
      await fs.writeFile(`${out}/${name}.png`,Buffer.from(result.data.split(',')[1],'base64'));delete result.data;
      reports.push({name,...result,errors});
      await page.close();
    }
    await context.close();
  }
  await fs.writeFile(`${out}/${phase}.json`,JSON.stringify({browser:browser.version(),base,source:process.env.ORBIT_SOURCE || 'working-tree',method:'Real createView / draw WebGL renderer, fixed fixture states, original camera and canvas dimensions. No Blender, postprocessing, reference image or gameplay completion claim.',reports},null,2));
  console.log(reports.map(({name,stats,framebuffer,errors})=>({name,stats,framebuffer,errors})));
  if(phase==='after') {
    const page=await browser.newPage({viewport:{width:816,height:766},deviceScaleFactor:1});
    const images=await Promise.all(['before','after'].map(async p=>`<section><h2>${p==='before'?'PUBLIC MAIN · 7adf12a':'CANDIDATE · CAPSULE RIBBON'}</h2><img src="data:image/png;base64,${(await fs.readFile(`${out}/${p}-mobile-approach.png`)).toString('base64')}"></section>`));
    await page.setContent(`<style>*{box-sizing:border-box}body{margin:0;padding:12px;background:#0b1526;color:#e8e1d3;font:12px sans-serif}.row{display:flex;gap:12px}h2{font-size:12px;margin:0 0 10px}img{display:block;width:390px;height:690px}p{margin:12px 0}</style><div class="row">${images.join('')}</div><p>Real WebGL · identical camera / state (Stage 1, x=10, z=-1.85) · original 390×690 framebuffer</p>`);
    await page.screenshot({path:`${out}/comparison-mobile.png`});await page.close();
  }
} finally {await browser.close();}
