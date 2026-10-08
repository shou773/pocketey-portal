import {test,expect} from '@playwright/test';
import {SAVE_KEY} from '../../src/games/model';
import {LANGUAGE_KEY} from '../../src/lib/locale';
import {play,read} from '../games/input';
import fs from 'node:fs';
test.beforeEach(async({page})=>{await page.route('https://challenges.cloudflare.com/**',r=>r.abort());await page.route('https://pocketey-contact.shishiyo1.workers.dev/**',r=>r.abort());});

test('English default, Japanese selection, navigation and reload retention',async({page},info)=>{
 await page.goto('/');await expect(page.locator('html')).toHaveAttribute('lang','en');await expect(page).toHaveTitle('Pocketey Games — Small adventures, one more try');
 await expect(page.getByRole('heading',{name:'Small worlds. One more try.'})).toBeVisible();
 await expect(page.locator('.site-header a[href*="/news"]')).toHaveCount(0);
 await page.screenshot({path:info.outputPath('home-en-390.png'),fullPage:true});
 await page.getByRole('button',{name:'日本語',exact:true}).click();await expect(page.locator('html')).toHaveAttribute('lang','ja');await expect(page).toHaveTitle(/小さな冒険/);expect(await page.evaluate(k=>localStorage.getItem(k),LANGUAGE_KEY)).toBe('ja');
 await page.screenshot({path:info.outputPath('home-ja-390.png'),fullPage:true});
 await page.setViewportSize({width:1280,height:900});await page.screenshot({path:info.outputPath('home-ja-desktop.png'),fullPage:true});
 await page.locator('.orbit .play-link').click();await expect(page.getByRole('button',{name:'ステージ 1 をはじめる'})).toBeVisible();await page.reload();await expect(page.locator('html')).toHaveAttribute('lang','ja');
 await page.getByRole('button',{name:'English',exact:true}).click();await expect(page.getByRole('button',{name:'Start stage 1'})).toBeVisible();await page.locator('.back-link').click();await expect(page.locator('html')).toHaveAttribute('lang','en');await expect(page).toHaveURL(/\/games\/\?lang=en/);
});

test('Japanese browser defaults and explicit choice priority',async({browser})=>{
 const context=await browser.newContext({locale:'ja-JP'}),page=await context.newPage();
 try{await page.goto('http://127.0.0.1:4322/');await expect(page.locator('html')).toHaveAttribute('lang','ja');await page.evaluate(k=>localStorage.setItem(k,'broken'),LANGUAGE_KEY);await page.reload();await expect(page.locator('html')).toHaveAttribute('lang','ja');await page.getByRole('button',{name:'English',exact:true}).click();await page.goto('http://127.0.0.1:4322/about/');await expect(page.locator('html')).toHaveAttribute('lang','en');await page.goto('http://127.0.0.1:4322/privacy/?lang=ja');await expect(page.locator('html')).toHaveAttribute('lang','ja');expect(await page.evaluate(k=>localStorage.getItem(k),LANGUAGE_KEY)).toBe('ja');}finally{await context.close();}
});

test('blocked or corrupt language storage keeps selection and links usable',async({page})=>{
 await page.addInitScript(()=>{Object.defineProperty(Storage.prototype,'getItem',{value(){throw new Error('blocked')}});Object.defineProperty(Storage.prototype,'setItem',{value(){throw new Error('blocked')}});});
 await page.goto('/?lang=ja');await expect(page.locator('html')).toHaveAttribute('lang','ja');await page.getByRole('button',{name:'English',exact:true}).click();await page.locator('.site-header').getByRole('link',{name:'About',exact:true}).click();await expect(page.locator('html')).toHaveAttribute('lang','en');await page.reload();await expect(page.locator('html')).toHaveAttribute('lang','en');
});

test('retired URLs return 404 and sitemap contains only current pages',async({request,page})=>{
 for(const path of ['/news/','/news/2026-09-04-welcome-to-pocketey/','/guides/','/affiliate-disclosure/','/not-a-page/']){const response=await request.get(path,{maxRedirects:0});expect(response.status(),path).toBe(404);expect(response.headers().location).toBeUndefined();}
 const sitemap=await request.get('/sitemap-0.xml');expect(sitemap.status()).toBe(200);const xml=await sitemap.text();expect(xml).not.toMatch(/\/(news|guides|affiliate-disclosure|404)[/.<]/);for(const slug of ['games/orbit-ribbon/','games/amber-step/','games/pulse-drift/','games/tilttrail/','about/','privacy/','contact/'])expect(xml).toContain(slug);
 await page.goto('/not-a-page/?lang=ja');await expect(page.getByRole('heading',{name:'このページは見つかりません。'})).toBeVisible();await page.getByRole('link',{name:'ゲーム一覧へ',exact:true}).click();await expect(page).toHaveURL(/\/games\/\?lang=ja/);
});

test('current pages and both-language internal links work without travel placeholders',async({page,request},info)=>{
 for(const lang of ['ja','en'])for(const route of ['/','/games/','/about/','/privacy/','/contact/']){
  const response=await page.goto(route+'?lang='+lang);expect(response?.status()).toBe(200);await expect(page.locator('html')).toHaveAttribute('lang',lang);
  expect(await page.locator('body').innerText()).not.toMatch(/Starter copy|Weekly Dispatch|Japan Travel Intelligence|Newsletter signup/);
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  const links=await page.locator('a[href]').evaluateAll(es=>es.map(e=>(e as HTMLAnchorElement).href).filter(h=>h.startsWith(location.origin)&&!h.includes('#')));
  for(const link of [...new Set(links)])expect((await request.get(link)).status(),link).toBe(200);
  if(route==='/privacy/'||route==='/contact/')await page.screenshot({path:info.outputPath(`${route.split('/')[1]}-${lang}.png`),fullPage:true});
 }
 await page.setViewportSize({width:320,height:568});await page.goto('/?lang=en');expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);for(const lang of ['English','日本語'])await expect(page.getByRole('button',{name:lang,exact:true})).toBeInViewport();await page.screenshot({path:info.outputPath('home-en-320.png'),fullPage:true});
});

for(const kind of ['orbit','amber'] as const)test(`${kind}: English full-stage play and translated results`,async({page},info)=>{
 await page.goto(`/games/${kind==='orbit'?'orbit-ribbon':'amber-step'}/?lang=en`);
 for(let stage=0;stage<3;stage++){
  await page.getByRole('button',{name:stage?'Next stage':'Start stage 1',exact:true}).click();await expect(page.locator('#game')).toHaveAttribute('data-mode','play');const trace:unknown[]=[];try{await play(page,kind,stage,true,trace);}finally{fs.writeFileSync(info.outputPath(`${kind}-stage${stage+1}-input.json`),JSON.stringify(trace));}
  await expect(page.getByRole('button',{name:stage<2?'Next stage':'Play again',exact:true})).toBeVisible();
  if(stage===0){const save=await page.evaluate(k=>localStorage.getItem(k),SAVE_KEY);await page.getByRole('button',{name:'日本語',exact:true}).click();await expect(page.getByRole('button',{name:'次のステージ'})).toBeVisible();expect(await page.evaluate(k=>localStorage.getItem(k),SAVE_KEY)).toBe(save);await page.getByRole('button',{name:'English',exact:true}).click();}
 }
 await page.locator('.hero-mark').evaluate(async e=>{await Promise.all(e.getAnimations().map(a=>a.finished));});await page.screenshot({path:info.outputPath(`${kind}-english-all-clear.png`)});
 const saved=await page.evaluate(k=>JSON.parse(localStorage.getItem(k)!),SAVE_KEY);expect(saved[kind].unlocked).toBe(3);expect(saved[kind].challengeBest.every((n:number)=>n>0)).toBe(true);
});

for(const kind of ['orbit','amber'] as const)test(`${kind}: both languages at 320px, existing saves, pause and recovery translation`,async({page},info)=>{
 await page.setViewportSize({width:320,height:568});await page.addInitScript(k=>localStorage.setItem(k,JSON.stringify({version:1,sound:true,orbit:{unlocked:3,best:[13,16,18]},amber:{unlocked:3,best:[10,12,14]}})),SAVE_KEY);
 await page.goto(`/games/${kind==='orbit'?'orbit-ribbon':'amber-step'}/?lang=en`);await expect(page.getByRole('button',{name:/Stage 3 /})).toBeEnabled();await expect(page.locator('#sound')).toHaveText('Sound ON');
 const bounds=[];
 for(const lang of ['English','日本語']){await page.getByRole('button',{name:lang,exact:true}).click();const box=await page.locator('#actions .primary').evaluate(e=>{const a=e.getBoundingClientRect(),b=document.querySelector('#overlay')!.getBoundingClientRect();return{top:a.top,bottom:a.bottom,height:a.height,viewportBottom:b.bottom,inside:a.top>=b.top&&a.bottom<=b.bottom};});expect(box.inside).toBe(true);bounds.push({lang,...box});expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);await page.screenshot({path:info.outputPath(`${kind}-320-${lang==='English'?'en':'ja'}.png`)});}
 fs.writeFileSync(info.outputPath(`${kind}-initial-bounds.json`),JSON.stringify(bounds,null,2));
 const saved=await page.evaluate(k=>localStorage.getItem(k),SAVE_KEY);await page.getByRole('button',{name:'ステージ 1 をはじめる'}).click();await page.locator('#pause').click();await expect(page.locator('#game')).toHaveAttribute('data-mode','pause');const frozen=await read(page);await page.getByRole('button',{name:'English',exact:true}).click();await expect(page.getByRole('button',{name:'Resume'})).toBeVisible();expect((await read(page)).x).toBe(frozen.x);expect(await page.evaluate(k=>localStorage.getItem(k),SAVE_KEY)).toBe(saved);await page.getByRole('button',{name:'Resume'}).click();
 await page.evaluate(()=>document.querySelector('canvas')!.getContext('webgl2')!.getExtension('WEBGL_lose_context')!.loseContext());await expect(page.getByRole('heading',{name:'Reload the game'})).toBeVisible();await page.getByRole('button',{name:'日本語',exact:true}).click();await expect(page.getByRole('button',{name:'再読み込み',exact:true})).toBeVisible();await expect(page.locator('#pause')).toBeDisabled();expect(await page.evaluate(k=>localStorage.getItem(k),SAVE_KEY)).toBe(saved);
});

test('contact retains Worker payload and localizes success, failure and blocked security',async({page},info)=>{
 await page.addInitScript(()=>{window.turnstile={render:(_target,options)=>{setTimeout(()=>{(options.callback as (s:string)=>void)('test-only-token')},0);return'test-widget';},reset:()=>{},remove:()=>{}};});
 const sent:Record<string,unknown>[]=[];let success=true;
 await page.route('https://pocketey-contact.shishiyo1.workers.dev',async route=>{sent.push(route.request().postDataJSON());await route.fulfill({status:success?200:500,contentType:'application/json',body:JSON.stringify(success?{ok:true}:{ok:false,error:'test failure'})});});
 await page.goto('/contact/?lang=ja&type=site&url=https%3A%2F%2Fwww.pocketey.com%2Fgames%2Forbit-ribbon%2F');await page.locator('#name').fill('Test player');await page.locator('#email').fill('player@example.test');await page.locator('#message').fill('Test-only form submission.');await expect(page.locator('#security-note')).toHaveText('セキュリティ確認が完了しました。');await page.getByRole('button',{name:'メッセージを送る',exact:true}).click();await expect(page.locator('#form-status')).toHaveText('メッセージを送信しました。ありがとうございます。');
 expect(Object.keys(sent[0]).sort()).toEqual(['category','email','message','name','pageUrl','turnstileToken','website']);expect(sent[0].category).toBe('Site problem');expect(sent[0].pageUrl).toBe('https://www.pocketey.com/games/orbit-ribbon/');expect(sent[0].turnstileToken).toBe('test-only-token');
 await page.getByRole('button',{name:'English',exact:true}).click();success=false;await page.locator('#name').fill('Test player');await page.locator('#email').fill('player@example.test');await page.locator('#message').fill('Test-only failed submission.');await expect(page.locator('#security-note')).toHaveText('Security check complete.');await page.getByRole('button',{name:'Send message',exact:true}).click();await expect(page.locator('#form-status')).toContainText('could not be sent');expect(sent).toHaveLength(2);
 await page.screenshot({path:info.outputPath('contact-mocked-error.png'),fullPage:true});
});

test('contact without a challenge cannot send and offers the established email',async({page})=>{
 let posts=0;await page.route('https://pocketey-contact.shishiyo1.workers.dev',r=>{posts++;return r.abort();});await page.goto('/contact/?lang=en');await page.locator('#name').fill('Test player');await page.locator('#email').fill('player@example.test');await page.locator('#message').fill('A message which must not leave this browser.');await page.getByRole('button',{name:'Send message',exact:true}).click();await expect(page.locator('#form-status')).toContainText('wait for the security check');expect(posts).toBe(0);await expect(page.getByRole('link',{name:'contact@pocketey.com',exact:true})).toHaveAttribute('href','mailto:contact@pocketey.com');
});


test('unsupported WebGL shows a translated recovery explanation and usable exit',async({page})=>{
 await page.addInitScript(()=>Object.defineProperty(HTMLCanvasElement.prototype,'getContext',{value:()=>null}));
 await page.goto('/games/orbit-ribbon/?lang=ja');await expect(page.getByRole('heading',{name:'3D画面を起動できません'})).toBeVisible();await expect(page.locator('[data-input=jump]')).toBeDisabled();await page.getByRole('button',{name:'English',exact:true}).click();await expect(page.getByRole('heading',{name:'3D could not start'})).toBeVisible();await page.locator('.back-link').click();await expect(page).toHaveURL(/\/games\/\?lang=en/);
});

for(const slug of ['pulse-drift','tilttrail'])test(`${slug}: public metadata and four-card portal`,async({page,request})=>{
 for(const lang of ['en','ja']){
  await page.goto('/games/?lang='+lang);await expect(page.locator('.game-card')).toHaveCount(4);
  await page.goto('/games/'+slug+'/?lang='+lang);await expect(page.locator('html')).toHaveAttribute('lang',lang);
  await expect(page.locator('link[rel=canonical]')).toHaveAttribute('href','https://www.pocketey.com/games/'+slug+'/');
  expect(await page.locator('meta[name=robots]').count()).toBe(0);
  const image=await page.locator('meta[property="og:image"]').getAttribute('content');expect((await request.get(new URL(image!).pathname)).status()).toBe(200);
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
 }
});
