import {test,expect} from '@playwright/test';
const games=[{slug:'orbit-ribbon',key:'orbit',root:'#game',sound:'#sound',start:'Start stage 1',pause:'#pause'}, {slug:'amber-step',key:'amber',root:'#game',sound:'#sound',start:'Start stage 1',pause:'#pause'}, {slug:'pulse-drift',key:'pulse',root:'#pulse',sound:'#sound',start:'Launch',pause:'#pause'}, {slug:'tilttrail',key:'tilt',root:'#tilttrail',sound:'#tt-sound',start:'Play this stage',pause:'#tt-pause'}];
for(const game of games)for(const fallback of [false,true])test(`${game.slug}: ${fallback?'MP3 fallback':'preferred codec'} music is lazy, single-owner and stops on pause/hidden`,async({page})=>{
 const requests:string[]=[];page.on('request',r=>{if(/\/audio\/music\/.*\.(ogg|mp3)$/.test(r.url()))requests.push(r.url());});
 if(fallback)await page.route('**/audio/music/*.ogg',r=>r.abort());
 await page.goto(`/games/${game.slug}/?lang=en`);await page.waitForTimeout(150);expect(requests).toEqual([]);
 await page.locator(game.sound).click();await page.waitForTimeout(150);expect(requests).toEqual([]);
 await page.getByRole('button',{name:game.start,exact:true}).click();await page.locator(game.pause).click();
 await expect(page.locator(game.root)).toHaveAttribute('data-music','ready',{timeout:15000});
 expect(requests.length).toBeGreaterThan(0);expect(requests.every(url=>url.includes(`/music/${game.key}.`))).toBe(true);
 if(fallback)await expect(page.locator(game.root)).toHaveAttribute('data-music-codec','mp3');
 const loaded=requests.length;
 await page.getByRole('button',{name:'Resume',exact:true}).last().click();await expect(page.locator(game.root)).toHaveAttribute('data-audio-loops','1');
 await page.waitForTimeout(150);await page.locator(game.pause).click();await expect(page.locator(game.root)).toHaveAttribute('data-audio-loops','0');
 await page.getByRole('button',{name:'Resume',exact:true}).last().click();await expect(page.locator(game.root)).toHaveAttribute('data-audio-loops','1');expect(requests.length).toBe(loaded);
 await page.evaluate(()=>{Object.defineProperty(document,'hidden',{configurable:true,get:()=>true});document.dispatchEvent(new Event('visibilitychange'));});
 await expect(page.locator(game.root)).toHaveAttribute('data-audio-loops','0');await expect(page.locator(game.root)).toHaveAttribute('data-audio','suspended');
 await page.evaluate(()=>{Object.defineProperty(document,'hidden',{configurable:true,get:()=>false});document.dispatchEvent(new Event('visibilitychange'));});
 await expect(page.locator(game.root)).toHaveAttribute('data-audio-loops','0');
 await page.getByRole('button',{name:'Resume',exact:true}).last().click();await expect(page.locator(game.root)).toHaveAttribute('data-audio-loops','1');
 await page.locator(game.sound).click();await expect(page.locator(game.root)).toHaveAttribute('data-audio-loops','0');
});
test('both delivered codecs decode to full-length stereo scores with headroom',async({page},info)=>{
 await page.goto('/games/?lang=en');
 const metrics=await page.evaluate(async()=>{
  const manifest=await fetch('/games/audio/music/SOURCES.json').then(r=>r.json());const context=new AudioContext();const result=[];
  for(const track of manifest.tracks)for(const asset of track.delivered){
   // Explicit codec QA, separate from the game's lazy-loading network assertions.
   const buffer=await context.decodeAudioData(await fetch('/games/audio/music/'+asset.file).then(r=>r.arrayBuffer()));let peak=0;
   for(let channel=0;channel<buffer.numberOfChannels;channel++){const data=buffer.getChannelData(channel);for(let i=0;i<data.length;i++)peak=Math.max(peak,Math.abs(data[i]));}
   result.push({file:asset.file,seconds:buffer.duration,originalSeconds:track.originalSeconds,channels:buffer.numberOfChannels,peakDBFS:20*Math.log10(peak)});
  }await context.close();return result;
 });
 await info.attach('decoded-music.json',{body:JSON.stringify(metrics,null,2),contentType:'application/json'});
 for(const metric of metrics){expect(metric.channels).toBe(2);expect(Math.abs(metric.seconds-metric.originalSeconds)).toBeLessThan(.065);expect(metric.peakDBFS).toBeLessThan(-5.5);}
});
