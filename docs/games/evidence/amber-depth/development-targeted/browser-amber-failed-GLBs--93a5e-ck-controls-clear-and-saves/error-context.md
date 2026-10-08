# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: browser.spec.ts >> amber: failed GLBs retain fallback, controls, clear and saves
- Location: tests/games/browser.spec.ts:271:2

# Error details

```
Error: amber/1 {"kind":"amber","audio":"off","music":"idle","audioSamples":"0","audioVoices":"0","audioMaxVoices":"0","audioLoops":"0","audioStarts":"0","mode":"play","status":"running","x":"0.000","y":"0.000","z":"0.000","grounded":"true","jumps":"0","geometries":"9"}

expect(received).toBe(expected) // Object.is equality

Expected: "clear"
Received: "running"
```

# Page snapshot

```yaml
- generic [ref=e1]:
  - main [ref=e2]:
    - generic [ref=e3]:
      - link "POCKETEY / PLAY" [ref=e4] [cursor=pointer]:
        - /url: /games/?lang=ja
      - generic [ref=e5]:
        - button "音を切り替え" [ref=e6] [cursor=pointer]: 音 OFF
        - button "音量設定" [ref=e7] [cursor=pointer]: ♫
        - button "一時停止" [ref=e8] [cursor=pointer]
    - generic [ref=e9]:
      - generic "Amber Step の3Dゲーム画面" [ref=e10]
      - generic:
        - generic:
          - text: 01 / 03
          - strong: 小さな一歩
        - generic:
          - text: "50.17"
          - generic: SECONDS
      - paragraph
    - generic [ref=e12]:
      - generic [ref=e13]:
        - button "左へ移動" [ref=e14] [cursor=pointer]
        - button "右へ移動" [active] [ref=e16] [cursor=pointer]
      - button "ジャンプ" [ref=e18] [cursor=pointer]: JUMP
  - generic [ref=e21]:
    - button [ref=e22]
    - button [ref=e28]
    - button [ref=e32]
    - button [ref=e37]
```

# Test source

```ts
  1  | import {expect,type Page} from '@playwright/test';
  2  | import {stages,type Kind} from '../../src/games/model';
  3  | export const read = (page:Page) => page.locator('#game').evaluate(e=>({... (e as HTMLElement).dataset}));
  4  | export async function play(page:Page,kind:Kind,index:number,touch=false,trace?:unknown[]){
  5  |  const level=stages[kind][index];const down=new Set<string>();let lastJump=-10;const started=Date.now();
  6  |  const session=touch?await page.context().newCDPSession(page):null;
  7  |  const points:Record<string,{x:number;y:number;id:number}>={};
  8  |  for(const [i,name] of ['left','right','jump'].entries()){const b=await page.locator(`[data-input=${name}]`).boundingBox();points[name]={x:b!.x+b!.width/2,y:b!.y+b!.height/2,id:i+1};}
  9  |  async function input(names:string[]){
  10 |   if(session){
  11 |    const added=names.filter(n=>!down.has(n)),removed=[...down].filter(n=>!names.includes(n));
  12 |    if(removed.length)await session.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:removed.map(n=>points[n])});
  13 |    if(added.length)await session.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:names.map(n=>points[n])});
  14 |    down.clear();names.forEach(n=>down.add(n));
  15 |   }
  16 |   else {for(const key of [...down])if(!names.includes(key)){await page.keyboard.up(key);down.delete(key);}for(const key of names)if(!down.has(key)){await page.keyboard.down(key);down.add(key);}}
  17 |  }
  18 |  while(Date.now()-started<50000){
  19 |   const readStarted=Date.now();const d=await read(page);const readFinished=Date.now();if(d.status!=='running')break;
  20 |   const x=Number(d.x),z=Number(d.z),t=x/(kind==='orbit'?7:5);const tile=level.platforms.find(p=>x>=p.a-.23&&x<=p.b+.23);
  21 |   const gap=!!tile&&tile.b<level.length&&tile.b-x<(kind==='orbit'?1.1:1.0)&&tile.b-x>-.15;
  22 |   // Trigger near the early safe takeoff edge, leaving room for browser/CDP delivery.
  23 |   // Amber3 combos have sampled windows [spikeX-1.8, spikeX-1.0]; a
  24 |   // 1.35m trigger was centred before delivery and arrived beyond that window in CI.
  25 |   const spike=kind==='amber'&&level.hazards.some(h=>h.x-x<(tile && tile.b-h.x<.9?1.7:2.0)&&h.x-x>0);
  26 |   let axis=1;if(kind==='orbit'){const h=level.hazards.find(h=>h.x+h.d/2+.3>x);const target=h&&h.x-x<12?(h.z>=0?-1.85:1.85):0;axis=Math.abs(target-z)<.18?0:Math.sign(target-z);}
  27 |   const jump=(gap||spike)&&d.grounded==='true'&&t-lastJump>.3;if(jump)lastJump=t;
  28 |   const names:string[]=[];if(axis)names.push(touch?(axis>0?'right':'left'):(axis>0?'ArrowRight':'ArrowLeft'));if(jump)names.push(touch?'jump':'Space');await input(names);
  29 |   trace?.push({stage:index+1,readStarted,readFinished,inputFinished:Date.now(),x:d.x,y:d.y,z:d.z,names});
  30 |   await page.waitForTimeout(25);
  31 |  }
> 32 |  await input([]);await session?.detach();expect((await read(page)).status,`${kind}/${index+1} ${JSON.stringify(await read(page))}`).toBe('clear');
     |                                                                                                                                     ^ Error: amber/1 {"kind":"amber","audio":"off","music":"idle","audioSamples":"0","audioVoices":"0","audioMaxVoices":"0","audioLoops":"0","audioStarts":"0","mode":"play","status":"running","x":"0.000","y":"0.000","z":"0.000","grounded":"true","jumps":"0","geometries":"9"}
  33 | }
  34 |
```
