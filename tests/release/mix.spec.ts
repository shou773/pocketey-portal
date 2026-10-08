import {test,expect} from '@playwright/test';
import {writeFile} from 'node:fs/promises';
import {effectsLevel,musicLevel,MASTER_GAIN,MUSIC_TRIM,EFFECTS_PEAK_BOUND,MUSIC_PEAK_BOUND,MIX_BUDGET} from '../../src/games/audio-mix';
import {installAudioCapture,stopAudioCapture} from './capture-audio';
const games=[{key:'orbit',slug:'orbit-ribbon',root:'#game',sound:'#sound',pause:'#pause',start:'Start stage 1'},{key:'amber',slug:'amber-step',root:'#game',sound:'#sound',pause:'#pause',start:'Start stage 1'},{key:'pulse',slug:'pulse-drift',root:'#pulse',sound:'#sound',pause:'#pause',start:'Launch'},{key:'tilt',slug:'tilttrail',root:'#tilttrail',sound:'#tt-sound',pause:'#tt-pause',start:'Play this stage'}] as const;
for(const game of games)for(const codec of ['ogg','mp3'])test(`${game.key}: ${codec} actual score crosses its loop boundary once`,async({page},info)=>{
 test.skip(info.project.name!=='chromium','Boundary recordings generated once; codecs/lifecycle run in all engines.');
 if(codec==='mp3')await page.route('**/audio/music/*.ogg',r=>r.abort());
 await installAudioCapture(page);
 await page.addInitScript(()=>{
  const start=AudioBufferSourceNode.prototype.start;
  AudioBufferSourceNode.prototype.start=function(when=0,offset=0,duration?:number){
   if(this.loop&&this.buffer&&this.buffer.duration>90){
    const buffer=this.buffer;let step=0,zeroRun=0,maxZeroRun=0;const boundaryFrames=Math.round(buffer.sampleRate*.05);
    const data=buffer.getChannelData(0);const joined=[...data.slice(-boundaryFrames),...data.slice(0,boundaryFrames)];
    for(let i=0;i<joined.length;i++){if(Math.abs(joined[i])<.0001){zeroRun++;maxZeroRun=Math.max(maxZeroRun,zeroRun);}else zeroRun=0;if(i)step=Math.max(step,Math.abs(joined[i]-joined[i-1]));}
    (window as any).__loopMetrics={duration:buffer.duration,bytes:buffer.length*buffer.numberOfChannels*4,boundaryStep:Math.abs(data.at(-1)!-data[0]),maxAdjacentStep:step,maxNearZeroMS:maxZeroRun/buffer.sampleRate*1000};
    offset=buffer.duration-.4;
   }
   if(duration===undefined)return start.call(this,when,offset);return start.call(this,when,offset,duration);
  };
 });
 await page.goto(`/games/${game.slug}/?lang=en`);await page.locator(game.sound).click();await page.getByRole('button',{name:game.start,exact:true}).click();await page.locator(game.pause).click();await expect(page.locator(game.root)).toHaveAttribute('data-music','ready');
 await page.getByRole('button',{name:'Resume',exact:true}).last().click();await expect(page.locator(game.root)).toHaveAttribute('data-audio-loops','1');
 const starts=await page.locator(game.root).getAttribute('data-audio-starts');await page.waitForTimeout(1100);
 await expect(page.locator(game.root)).toHaveAttribute('data-audio-loops','1');await expect(page.locator(game.root)).toHaveAttribute('data-audio-starts',starts!);
 await page.locator(game.pause).click();await page.waitForTimeout(100);
 const metrics=await page.evaluate(()=>(window as any).__loopMetrics);expect(metrics.boundaryStep).toBe(0);expect(metrics.maxNearZeroMS).toBeLessThan(15);
 await writeFile(info.outputPath(`${game.key}-${codec}-loop.webm`),await stopAudioCapture(page));await info.attach('loop.json',{body:JSON.stringify(metrics,null,2),contentType:'application/json'});
 await page.evaluate(()=>window.dispatchEvent(new PageTransitionEvent('pagehide',{persisted:false})));await expect(page.locator(game.root)).toHaveAttribute('data-audio-samples','0');await expect(page.locator(game.root)).toHaveAttribute('data-audio-loops','0');await expect(page.locator(game.root)).toHaveAttribute('data-music','idle');
});
test('maximum music, effects and ten-voice mix render without clipping',async({page},info)=>{
 test.skip(info.project.name!=='chromium','Offline maximum-level stress evidence generated once.');
 await page.goto('/games/?lang=en');const results=[];
 for(const game of games)for(const variation of ['music-max','sfx-max','worst-mix']){
  const weights=8.9;const music=variation==='sfx-max'?0:musicLevel(game.key,1,false);
  const effects=variation==='music-max'?0:effectsLevel(game.key,1,false,weights);
  const peakBound=MASTER_GAIN*(MUSIC_PEAK_BOUND*MUSIC_TRIM[game.key]+EFFECTS_PEAK_BOUND*effects*weights);expect(peakBound).toBeLessThanOrEqual(MASTER_GAIN*MIX_BUDGET+1e-8);
  const result=await page.evaluate(async({key,music,effects,master})=>{
   const context=new OfflineAudioContext(2,88200,44100),bus=context.createGain();bus.gain.value=master;bus.connect(context.destination);
   const buffer=await context.decodeAudioData(await fetch(`/games/audio/music/${key}.ogg`).then(r=>r.arrayBuffer()));
   let peak=0,peakFrame=0;for(let c=0;c<2;c++){const data=buffer.getChannelData(c);for(let i=0;i<data.length;i++)if(Math.abs(data[i])>peak){peak=Math.abs(data[i]);peakFrame=i;}}
   const score=context.createBufferSource(),scoreGain=context.createGain();score.buffer=buffer;scoreGain.gain.value=music;score.connect(scoreGain);scoreGain.connect(bus);score.start(0,Math.min(buffer.duration-2,Math.max(0,peakFrame/44100-1)));
   // Exactly two per cue, ten voices overall. No music duck: stricter than gameplay.
   for(const file of ['shot','warning','damage','death','clear']){
    const sample=await context.decodeAudioData(await fetch(`/games/audio/${file}.wav`).then(r=>r.arrayBuffer()));
    for(let voice=0;voice<2;voice++){const source=context.createBufferSource(),gain=context.createGain();source.buffer=sample;gain.gain.value=effects*(file==='shot'?.45:1);source.connect(gain);gain.connect(bus);source.start(.2);}
   }
   const rendered=await context.startRendering(),channels=[rendered.getChannelData(0),rendered.getChannelData(1)];let maximum=0;
   const pcm=new Int16Array(rendered.length*2);for(let i=0;i<rendered.length;i++)for(let c=0;c<2;c++){maximum=Math.max(maximum,Math.abs(channels[c][i]));pcm[i*2+c]=Math.max(-32768,Math.min(32767,Math.round(channels[c][i]*32767)));}
   const bytes=new Uint8Array(pcm.buffer);let binary='';for(const b of bytes)binary+=String.fromCharCode(b);return{peak:maximum,pcm:btoa(binary)};
  },{key:game.key,music,effects,master:MASTER_GAIN});
  expect(result.peak).toBeLessThan(.89);const pcm=Buffer.from(result.pcm,'base64');
  const header=Buffer.alloc(44);header.write('RIFF');header.writeUInt32LE(pcm.length+36,4);header.write('WAVEfmt ',8);header.writeUInt32LE(16,16);header.writeUInt16LE(1,20);header.writeUInt16LE(2,22);header.writeUInt32LE(44100,24);header.writeUInt32LE(176400,28);header.writeUInt16LE(4,32);header.writeUInt16LE(16,34);header.write('data',36);header.writeUInt32LE(pcm.length,40);
  await writeFile(info.outputPath(`${game.key}-${variation}.wav`),Buffer.concat([header,pcm]));results.push({game:game.key,variation,musicGain:music,effectsGain:effects,master:MASTER_GAIN,peakDBFS:20*Math.log10(result.peak),theoreticalBoundDBTP:20*Math.log10(peakBound)});
 }
 await info.attach('maximum-levels.json',{body:JSON.stringify(results,null,2),contentType:'application/json'});
});
