import { expect, type Page } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';
import { stages } from '../../src/games/model';
import { SIGNALS } from '../../src/games/signals';
export const evidence = 'test-results/orbit-signals';
export const readSignals = (page: Page) => page.locator('#game').evaluate(el => ({ ...(el as HTMLElement).dataset }));
/** Observe diagnostics only. Every movement and jump uses keyboard/CDP touch. */
export async function driveSignals(page: Page, index: number, collect: boolean, touch: boolean, label: string) {
  await mkdir(evidence, { recursive: true });
  const session = touch ? await page.context().newCDPSession(page) : null;
  const points: Record<string, { x: number; y: number; id: number }> = {};
  for (const [i, key] of ['left','right','jump'].entries()) { const b = (await page.locator(`[data-input="${key}"]`).boundingBox())!; points[key] = { x:b.x+b.width/2, y:b.y+b.height/2, id:i+1 }; }
  let active: string[] = [], lastJump = -10, maxCalls = 0, maxTriangles = 0; const samples: unknown[] = [];
  const timing = index === 2 ? page.evaluate(async () => {
    const intervals: number[] = []; let previous = performance.now();
    await new Promise<void>(resolve => { function frame(now: number) { intervals.push(now-previous); previous=now; if(intervals.length<200)requestAnimationFrame(frame);else resolve(); } requestAnimationFrame(frame); });
    const sorted=intervals.slice(10).sort((a,b)=>a-b),canvas=document.querySelector('canvas')!,gl=canvas.getContext('webgl2')!,ext=gl.getExtension('WEBGL_debug_renderer_info');
    return { fps:1000/(sorted.reduce((a,b)=>a+b,0)/sorted.length),p95:sorted[Math.floor(sorted.length*.95)],intervals,viewport:[innerWidth,innerHeight],framebuffer:[canvas.width,canvas.height],renderer:ext?gl.getParameter(ext.UNMASKED_RENDERER_WEBGL):gl.getParameter(gl.RENDERER) };
  }) : null;
  async function input(names: string[]) {
    if (session) {
      if (names.join() !== active.join()) {
        if (active.length) await session.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
        if (names.length) await session.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:names.map(n=>points[n])});
      }
    } else {
      const key=(name:string)=>name==='left'?'ArrowLeft':name==='right'?'ArrowRight':'Space';
      for(const n of active.filter(n=>!names.includes(n)))await page.keyboard.up(key(n));
      for(const n of names.filter(n=>!active.includes(n)))await page.keyboard.down(key(n));
    }
    active=names;
  }
  const began=Date.now(),level=stages.orbit[index];
  while(Date.now()-began<60000) {
    const d=await readSignals(page); samples.push(d); maxCalls=Math.max(maxCalls,Number(d.drawCalls));maxTriangles=Math.max(maxTriangles,Number(d.triangles));
    if(d.status!=='running')break;
    const x=Number(d.x),z=Number(d.z),tile=level.platforms.find(p=>x>=p.a-.23&&x<=p.b+.23);
    const gap=!!tile&&tile.b<level.length&&tile.b-x<1.1&&tile.b-x>-.15;
    const h=level.hazards.find(h=>h.x+h.d/2+.3>x);let target=h&&h.x-x<12?(h.z>=0?-1.85:1.85):0;
    const signal=SIGNALS[index].find(p=>p.x+.65>x);if(collect&&signal&&signal.x-x<8)target=signal.z;
    const axis=Math.abs(target-z)<.14?0:Math.sign(target-z),jump=gap&&d.grounded==='true'&&x/7-lastJump>.3;if(jump)lastJump=x/7;
    await input([axis>0?'right':axis<0?'left':'',jump?'jump':''].filter(Boolean));await page.waitForTimeout(25);
  }
  await input([]);await session?.detach();const end=await readSignals(page),performanceResult=timing?await timing:null;
  await writeFile(`${evidence}/${label}-course${index+1}.json`,JSON.stringify({end,maxCalls,maxTriangles,performance:performanceResult,samples,note:'Ordinary input; no gameplay state writes. Optional collection does not change fixed-speed clear times.'},null,2));
  expect(end.status,JSON.stringify(end)).toBe('clear');expect(Number(end.signals)).toBe(collect?3:0);
  if(performanceResult){expect.soft(performanceResult.fps).toBeGreaterThanOrEqual(45);expect.soft(performanceResult.p95).toBeLessThanOrEqual(40);}
  await page.screenshot({path:`${evidence}/${label}-course${index+1}-clear.png`});return end;
}
