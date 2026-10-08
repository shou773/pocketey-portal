# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: browser.spec.ts >> amber-keyboard >> three stages through normal input, unlock and persistence
- Location: tests/games/browser.spec.ts:31:2

# Error details

```
Error: expect(received).toBeGreaterThanOrEqual(expected)

Expected: >= 45
Received:    42.859398614964675
```

# Page snapshot

```yaml
- main [ref=f1e2]:
  - generic [ref=f1e3]:
    - link "POCKETEY / PLAY" [ref=f1e4] [cursor=pointer]:
      - /url: /games/?lang=ja
    - generic [ref=f1e5]:
      - button "音を切り替え" [pressed] [ref=f1e6] [cursor=pointer]: 音 ON
      - button "音量設定" [ref=f1e7] [cursor=pointer]: ♫
      - button "一時停止" [ref=f1e8] [cursor=pointer]
  - generic [ref=f1e9]:
    - generic "Amber Step の3Dゲーム画面" [ref=f1e10]
    - generic:
      - generic:
        - text: 03 / 03
        - strong: 琥珀の庭
      - generic:
        - text: "0.18"
        - generic: SECONDS
    - paragraph: ふちのトゲは、次の足場までまとめてジャンプ。上りと下りで間合いを変えよう。
  - generic [ref=f1e12]:
    - generic [ref=f1e13]:
      - button "左へ移動" [ref=f1e14] [cursor=pointer]
      - button "右へ移動" [ref=f1e16] [cursor=pointer]
    - generic [ref=f1e18]: MOVE← → / A D
    - button "ジャンプ" [ref=f1e19] [cursor=pointer]: JUMP
```

# Test source

```ts
  1   | import {test,expect,type Page} from '@playwright/test';
  2   | import { stages, SAVE_KEY, type Kind } from '../../src/games/model';
  3   | import fs from 'node:fs';
  4   | import {read,play} from './input';
  5   | test('licensed UI artwork loads and existing progress survives the visual refresh',async({page,request})=>{
  6   |  await page.emulateMedia({reducedMotion:'reduce'});
  7   |  await page.addInitScript(k=>localStorage.setItem(k,JSON.stringify({version:1,sound:true,orbit:{unlocked:3,best:[13,16,18]},amber:{unlocked:2,best:[10,null,null]}})),SAVE_KEY);
  8   |  await page.goto('/games/orbit-ribbon/');
  9   |  await expect(page.getByRole('button',{name:/ステージ 3 /})).toBeEnabled();
  10  |  await expect(page.locator('#sound')).toHaveText('音 ON');
  11  |  await expect(page.locator('#save-note')).toContainText('旧コースBEST 13.00秒');
  12  |  for(const name of ['orbit','gem','trophy','flag','lock-keyhole','check','arrow-left','arrow-right','arrow-up-right','play','rotate-ccw','sparkles','footprints']){
  13  |   const response=await request.get(`/games/assets/lucide/${name}.svg`);expect(response.status()).toBe(200);expect(await response.text()).toContain('<svg');
  14  |  }
  15  |  const license=await request.get('/games/assets/lucide/LICENSE.txt');expect(await license.text()).toContain('ISC License');expect(await license.text()).toContain('The MIT License');
  16  |  await expect(page.locator('.hero-mark .asset-icon')).toBeVisible();
  17  |  await page.getByRole('button',{name:'ステージ 1 をはじめる'}).click();
  18  |  const animationObservation=page.evaluate(async()=>{let active=false;const start=performance.now();await new Promise<void>(resolve=>{function observe(){active ||= document.querySelector('#landing-cue')!.getAnimations().length>0;if(performance.now()-start<1400)requestAnimationFrame(observe);else resolve();}requestAnimationFrame(observe);});return active;});
  19  |  await page.keyboard.press('Space');await expect(page.locator('#game')).toHaveAttribute('data-grounded','false');await expect(page.locator('#game')).toHaveAttribute('data-grounded','true');
  20  |  expect(await animationObservation).toBe(false);
  21  |  await page.locator('#pause').click();await page.getByRole('button',{name:'ステージ選択'}).click();
  22  |  await expect(page.getByRole('button',{name:/ステージ 3 /})).toBeEnabled();
  23  |  const save=await page.evaluate(k=>JSON.parse(localStorage.getItem(k)!),SAVE_KEY);expect(save.orbit.best).toEqual([13,16,18]);
  24  |  await page.getByRole('button',{name:'ステージ 1 をはじめる'}).click();await play(page,'orbit',0,true);
  25  |  const updated=await page.evaluate(k=>JSON.parse(localStorage.getItem(k)!),SAVE_KEY);
  26  |  expect(updated.orbit.best).toEqual([13,16,18]);expect(updated.orbit.challengeBest[0]).toBeGreaterThan(13);
  27  |  expect(updated.orbit.challengeBest.slice(1)).toEqual([null,null]);
  28  | });
  29  | for(const kind of ['orbit','amber'] as const)for(const touch of [false,true])test.describe(`${kind}-${touch?'touch':'keyboard'}`,()=>{
  30  |  test.use({isMobile:touch,hasTouch:touch,viewport:touch?{width:390,height:844}:{width:1280,height:720}});
  31  |  test('three stages through normal input, unlock and persistence',async({page,browser},info)=>{
  32  |  const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
  33  |  const inputTrace:unknown[]=[];
  34  |  await page.goto(`/games/${kind==='orbit'?'orbit-ribbon':'amber-step'}/`);await expect(page.locator('#game')).toHaveAttribute('data-mode','menu');
  35  |  await expect(page.getByRole('button',{name:/ステージ 2 /})).toBeDisabled();
  36  |  await page.locator('#sound').click();await expect(page.locator('#sound')).toHaveText('音 ON');
  37  |  for(let i=0;i<3;i++){
  38  |   if(i===0)await page.getByRole('button',{name:'ステージ 1 をはじめる'}).click();else await page.getByRole('button',{name:'次のステージ'}).click();
  39  |   // Wait for the first new-run frame, not a blocking screenshot, before driving.
  40  |   await expect(page.locator('#game')).toHaveAttribute('data-mode','play');
  41  |   await expect(page.locator('#game')).toHaveAttribute('data-status','running');
  42  |   const measurement = i===2 ? page.evaluate(async()=>{const samples:number[]=[];let last=performance.now();await new Promise<void>(resolve=>{function sample(now:number){samples.push(now-last);last=now;if(samples.length<200)requestAnimationFrame(sample);else resolve();}requestAnimationFrame(sample);});const sorted=samples.slice(10).sort((a,b)=>a-b);return{fps:1000/(sorted.reduce((a,b)=>a+b)/sorted.length),p95:sorted[Math.floor(sorted.length*.95)],p99:sorted[Math.floor(sorted.length*.99)],max:Math.max(...sorted),rawIntervals:samples,startedAt:performance.timeOrigin+performance.now()-samples.reduce((a,b)=>a+b)};}) : null;
  43  |   try { await play(page,kind,i,touch,inputTrace); }
  44  |   finally { fs.writeFileSync(info.outputPath('input-timing.json'),JSON.stringify(inputTrace)); }
  45  |   if(measurement) fs.writeFileSync(info.outputPath('environment.json'),JSON.stringify({browser:browser.version(),contexts:browser.contexts().length,pages:page.context().pages().length,...await page.evaluate(()=>{const canvas=document.querySelector('canvas')!,gl=canvas.getContext('webgl2')!,ext=gl.getExtension('WEBGL_debug_renderer_info');return{viewport:[innerWidth,innerHeight],dpr:devicePixelRatio,canvas:[canvas.width,canvas.height],renderer:ext?gl.getParameter(ext.UNMASKED_RENDERER_WEBGL):gl.getParameter(gl.RENDERER)};})},null,2));
> 46  |   if(measurement){const performance=await measurement;fs.writeFileSync(info.outputPath('stage3-performance.json'),JSON.stringify(performance,null,2));console.log(kind,touch?'touch':'keyboard',{fps:performance.fps,p95:performance.p95,p99:performance.p99,max:performance.max});expect.soft(performance.fps).toBeGreaterThanOrEqual(45);expect.soft(performance.p95).toBeLessThanOrEqual(40);}
      |                                                                                                                                                                                                                                                                                                                 ^ Error: expect(received).toBeGreaterThanOrEqual(expected)
  47  |   await page.locator('.hero-mark').evaluate(async e=>{await Promise.all(e.getAnimations().map(a=>a.finished));});
  48  |   await page.screenshot({path:info.outputPath(`${kind}-${i+1}-clear.png`)});
  49  |  }
  50  |  await page.getByRole('button',{name:'ステージ選択'}).click();await expect(page.locator('#stages').getByRole('button',{name:/ステージ 3 /})).toBeEnabled();
  51  |  await page.reload();await expect(page.locator('#sound')).toHaveText('音 ON');await expect(page.locator('#stages').getByRole('button',{name:/ステージ 3 /})).toBeEnabled();
  52  |  const stored=await page.evaluate(k=>JSON.parse(localStorage.getItem(k)!),SAVE_KEY);expect(stored[kind].challengeBest.every((x:number)=>x>0)).toBeTruthy();
  53  |  const reopened=await page.context().newPage();await reopened.goto(page.url());await expect(reopened.locator('#stages').getByRole('button',{name:/ステージ 3 /})).toBeEnabled();await reopened.close();expect(errors).toEqual([]);
  54  |  await page.locator('#stages').getByRole('button',{name:/ステージ 3 /}).click();await page.getByRole('button',{name:'ステージ 3 をはじめる'}).click();await expect(page.locator('#game')).toHaveAttribute('data-mode','play');
  55  |  fs.writeFileSync(info.outputPath('functional-completion.json'),JSON.stringify({kind,touch,threeNativeClears:true,stored,reload:true,reopened:true,restartStage3:true,errors},null,2));
  56  | });});
  57  | test('failure/retry, pause/focus clears held input, restart cycles, orientation',async({page},info)=>{
  58  |  await page.goto('/games/orbit-ribbon/');await page.getByRole('button',{name:'ステージ 1 をはじめる'}).click();
  59  |  await expect(page.locator('#game')).toHaveAttribute('data-status','dead',{timeout:10000});await page.getByRole('button',{name:'すぐにリトライ'}).click();await expect.poll(async()=>Number((await read(page)).x)).toBeLessThan(2);
  60  |  await page.keyboard.down('ArrowRight');await page.waitForTimeout(100);await page.keyboard.press('Escape');await page.keyboard.up('ArrowRight');const before=await read(page);await page.waitForTimeout(250);expect((await read(page)).x).toBe(before.x);
  61  |  await page.getByRole('button',{name:'つづける'}).click();const z=(await read(page)).z;await page.waitForTimeout(200);expect((await read(page)).z).toBe(z);
  62  |  await page.keyboard.down('ArrowLeft');await page.evaluate(()=>window.dispatchEvent(new Event('blur')));await page.keyboard.up('ArrowLeft');await expect(page.locator('#game')).toHaveAttribute('data-mode','pause');await page.getByRole('button',{name:'つづける'}).click();const z2=(await read(page)).z;await page.waitForTimeout(150);expect((await read(page)).z).toBe(z2);
  63  |  const geometries=(await read(page)).geometries;
  64  |  for(let i=0;i<20;i++){await page.keyboard.press('KeyR');await page.waitForTimeout(20);}await page.keyboard.press('KeyR');await page.waitForTimeout(1000);const x=Number((await read(page)).x);expect(x).toBeGreaterThan(5.5);expect(x).toBeLessThan(9.5);expect((await read(page)).geometries).toBe(geometries);
  65  |  await page.locator('#pause').click();await page.setViewportSize({width:844,height:390});await page.screenshot({path:info.outputPath('landscape-pause.png')});await expect(page.getByRole('button',{name:'つづける'})).toBeInViewport();await page.getByRole('button',{name:'つづける'}).click();await expect(page.locator('[data-input=jump]')).toBeInViewport();await page.screenshot({path:info.outputPath('landscape-play.png')});
  66  | });
  67  | test('corrupt/blocked storage and scoped confirmed reset',async({page})=>{
  68  |  await page.addInitScript(k=>{localStorage.setItem(k,'{bad');localStorage.setItem('unrelated-progress','keep');},SAVE_KEY);
  69  |  await page.goto('/games/amber-step/');await expect(page.getByRole('button',{name:'ステージ 1 をはじめる'})).toBeVisible();
  70  |  await page.locator('#reset').click();await page.getByRole('button',{name:'キャンセル'}).click();expect(await page.evaluate(()=>localStorage.getItem('unrelated-progress'))).toBe('keep');
  71  |  await page.locator('#reset').click();await page.getByRole('button',{name:'この2作品をリセット',exact:true}).click();expect(await page.evaluate(()=>localStorage.getItem('unrelated-progress'))).toBe('keep');expect(await page.evaluate(k=>JSON.parse(localStorage.getItem(k)!).orbit.unlocked,SAVE_KEY)).toBe(1);
  72  |  const blocked=await page.context().newPage();await blocked.addInitScript(()=>{Object.defineProperty(window,'localStorage',{get(){throw new Error('blocked');}});});await blocked.goto('/games/amber-step/');await blocked.locator('#sound').click();await expect(blocked.locator('#save-note')).toContainText('保存を利用できません');await blocked.getByRole('button',{name:'ステージ 1 をはじめる'}).click();await expect(blocked.locator('#game')).toHaveAttribute('data-mode','play');await blocked.close();
  73  | });
  74  | test('touch simultaneous move+jump, touch cancel, layout, renderer performance and site navigation',async({page,browser},info)=>{
  75  |  await page.goto('/');await page.locator('.site-header').getByRole('link',{name:'ゲーム',exact:true}).click();await expect(page).toHaveURL(/\/games\//);await page.locator('.amber .play-link').click();await page.getByRole('button',{name:'ステージ 1 をはじめる'}).click();
  76  |  const session=await page.context().newCDPSession(page);const right=await page.locator('[data-input=right]').boundingBox(),jump=await page.locator('[data-input=jump]').boundingBox();
  77  |  await session.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:right!.x+20,y:right!.y+20,id:1},{x:jump!.x+20,y:jump!.y+20,id:2}]});await page.waitForTimeout(200);const s=await read(page);expect(Number(s.x)).toBeGreaterThan(.5);expect(Number(s.y)).toBeGreaterThan(.5);
  78  |  await session.send('Input.dispatchTouchEvent',{type:'touchCancel',touchPoints:[]});const x=(await read(page)).x;await page.waitForTimeout(100);expect((await read(page)).x).toBe(x);
  79  |  await page.screenshot({path:info.outputPath('amber-touch.png')});
  80  |  const perf=await page.evaluate(async()=>{const samples:number[]=[];let last=performance.now();await new Promise<void>(resolve=>{function frame(now:number){samples.push(now-last);last=now;if(samples.length<300)requestAnimationFrame(frame);else resolve();}requestAnimationFrame(frame);});const sorted=samples.slice(10).sort((a,b)=>a-b);const canvas=document.querySelector('canvas')!;const gl=canvas.getContext('webgl2')!;const extension=gl.getExtension('WEBGL_debug_renderer_info');return{fps:1000/(sorted.reduce((a,b)=>a+b)/sorted.length),p95:sorted[Math.floor(sorted.length*.95)],renderer:extension?gl.getParameter(extension.UNMASKED_RENDERER_WEBGL):gl.getParameter(gl.RENDERER),viewport:[innerWidth,innerHeight],userAgent:navigator.userAgent};});
  81  |  fs.writeFileSync(info.outputPath('performance.json'),JSON.stringify({browser:browser.version(),...perf},null,2));console.log('PERFORMANCE',perf);expect(perf.fps).toBeGreaterThanOrEqual(45);expect(perf.p95).toBeLessThanOrEqual(40);
  82  |  for(const size of [{width:320,height:568},{width:844,height:390},{width:1440,height:900}]){await page.setViewportSize(size);await expect(page.locator('[data-input=jump]')).toBeInViewport();expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);await page.screenshot({path:info.outputPath(`layout-${size.width}.png`)});}
  83  | });
  84  | 
  85  | for(const kind of ['orbit','amber'] as const)test(`${kind}: WebGL context loss freezes play until reload and preserves saved data`,async({page},info)=>{
  86  |  await page.goto(`/games/${kind==='orbit'?'orbit-ribbon':'amber-step'}/`);
  87  |  await page.locator('#sound').click();
  88  |  await page.getByRole('button',{name:'ステージ 1 をはじめる'}).click();
  89  |  await play(page,kind,0,true);
  90  |  const saved=await page.evaluate(k=>localStorage.getItem(k),SAVE_KEY);
  91  |  await page.getByRole('button',{name:'次のステージ'}).click();
  92  |  await page.keyboard.down('ArrowRight');
  93  |  await page.waitForTimeout(150);
  94  |  const supported=await page.evaluate(()=>{
  95  |   const gl=document.querySelector('canvas')!.getContext('webgl2')!;
  96  |   const loss=gl.getExtension('WEBGL_lose_context');
  97  |   if(!loss)return false;
  98  |   (window as unknown as {restoreTestContext:()=>void}).restoreTestContext=()=>loss.restoreContext();
  99  |   loss.loseContext();return true;
  100 |  });
  101 |  expect(supported).toBe(true);
  102 |  await expect(page.locator('#game')).toHaveAttribute('data-mode','recovery');
  103 |  await page.keyboard.up('ArrowRight');
  104 |  const frozen=await read(page), time=await page.locator('#timer').textContent();
  105 |  await expect(page.locator('#pause')).toBeDisabled();
  106 |  await expect(page.locator('#sound')).toBeDisabled();
  107 |  await expect(page.locator('[data-input=jump]')).toBeDisabled();
  108 |  await expect(page.getByRole('button',{name:'つづける',exact:true})).toHaveCount(0);
  109 |  await expect(page.getByRole('button',{name:'やり直す',exact:true})).toHaveCount(0);
  110 |  await page.keyboard.press('Escape');await page.keyboard.press('KeyR');await page.keyboard.press('Space');
  111 |  await page.evaluate(()=>window.dispatchEvent(new Event('blur')));
  112 |  await page.waitForTimeout(300);
  113 |  expect((await read(page)).x).toBe(frozen.x);expect((await read(page)).y).toBe(frozen.y);
  114 |  expect(await page.locator('#timer').textContent()).toBe(time);
  115 |  expect(await page.evaluate(k=>localStorage.getItem(k),SAVE_KEY)).toBe(saved);
  116 |  await page.screenshot({path:info.outputPath(`${kind}-context-loss.png`)});
  117 |  // Even an actual restoration must not silently restart the interrupted simulation.
  118 |  await page.evaluate(()=>(window as unknown as {restoreTestContext:()=>void}).restoreTestContext());
  119 |  await expect.poll(()=>page.evaluate(()=>document.querySelector('canvas')!.getContext('webgl2')!.isContextLost())).toBe(false);
  120 |  await expect(page.locator('#game')).toHaveAttribute('data-mode','recovery');
  121 |  expect((await read(page)).x).toBe(frozen.x);
  122 |  await page.getByRole('button',{name:'再読み込み',exact:true}).click();
  123 |  await expect(page.locator('#game')).toHaveAttribute('data-mode','menu');
  124 |  await expect(page.locator('#sound')).toHaveText('音 ON');
  125 |  expect(await page.evaluate(k=>localStorage.getItem(k),SAVE_KEY)).toBe(saved);
  126 |  await page.getByRole('button',{name:'ステージ 1 をはじめる'}).click();
  127 |  await expect(page.locator('#game')).toHaveAttribute('data-mode','play');
  128 | });
  129 | 
  130 | for(const kind of ['orbit','amber'] as const)test(`${kind}: 320x568 menus and clear screen remain scroll-accessible`,async({page},info)=>{
  131 |  await page.setViewportSize({width:320,height:568});
  132 |  await page.goto(`/games/${kind==='orbit'?'orbit-ribbon':'amber-step'}/`);
  133 |  async function accessiblePanel(name:string){
  134 |   await page.locator('#overlay').evaluate(e=>{e.scrollTop=0;});
  135 |   const top=await page.locator('#overlay').evaluate(e=>{const panel=e.querySelector('.panel')!;return{overlay:e.getBoundingClientRect().top,panel:panel.getBoundingClientRect().top};});
  136 |   expect(top.panel).toBeGreaterThanOrEqual(top.overlay);
  137 |   await expect(page.locator('#panel-title')).toBeInViewport();
  138 |   await page.screenshot({path:info.outputPath(`${kind}-320-${name}-top.png`)});
  139 |   const controls=page.locator('#overlay button:visible, #overlay a:visible');
  140 |   for(let i=0;i<await controls.count();i++){
  141 |    const item=controls.nth(i);await item.scrollIntoViewIfNeeded();
  142 |    const fits=await item.evaluate(e=>{const a=e.getBoundingClientRect(),b=document.querySelector('#overlay')!.getBoundingClientRect();return a.top>=b.top-1&&a.bottom<=b.bottom+1&&a.left>=b.left-1&&a.right<=b.right+1;});
  143 |    expect(fits,`${name} / ${await item.textContent()}`).toBe(true);
  144 |   }
  145 |   await page.screenshot({path:info.outputPath(`${kind}-320-${name}-bottom.png`)});
  146 |  }
```