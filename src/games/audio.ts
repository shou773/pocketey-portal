import { LANGUAGE_EVENT, tr } from '../lib/locale';
import './audio.css';

export type AudioGame = 'orbit' | 'amber' | 'pulse' | 'tilt';
export type Cue = 'select' | 'start' | 'jump' | 'land' | 'shot' | 'hit' | 'warning' | 'damage' | 'death' | 'clear' | 'brake';
type Settings = { music: number; sfx: number; musicMuted: boolean; sfxMuted: boolean };
const KEY = 'pocketey-audio-v1';
const files = ['click','jump','land','roll','clear','shot','warning','damage','death'] as const;
type Sample = typeof files[number];
// Music URLs are populated only after the licensed originals are received and verified.
const music: Partial<Record<AudioGame, string>> = {};
function parse(value: unknown, enabled: boolean): Settings {
  const s = value && typeof value === 'object' ? value as Partial<Settings> : {};
  const volume = (n: unknown, fallback: number) => typeof n === 'number' && Number.isFinite(n) ? Math.max(0,Math.min(1,n)) : fallback;
  return { music: volume(s.music,.65), sfx: volume(s.sfx,.8), musicMuted: typeof s.musicMuted==='boolean'?s.musicMuted:!enabled, sfxMuted:typeof s.sfxMuted==='boolean'?s.sfxMuted:!enabled };
}

/** One audio owner per game page. Audio failures never control the simulation. */
export function createGameAudio(game: AudioGame, legacyEnabled: boolean, root: HTMLElement, changed: (enabled: boolean)=>void) {
  let settings = parse(null,legacyEnabled), ctx: AudioContext | null = null;
  try { settings=parse(JSON.parse(localStorage.getItem(KEY)||'{}')[game],legacyEnabled); } catch { /* Tab-local settings remain usable. */ }
  let master: GainNode, effects: GainNode, score: GainNode;
  let active=false, disposed=false, loading: Promise<void>|null=null, bgm:AudioBuffer|null=null, loop:AudioBufferSourceNode|null=null;
  let loopEnvelope:GainNode|null=null;
  const fading=new Set<AudioBufferSourceNode>();
  let loopStarted=0, offset=0, musicError=false, sfxError=false;
  const buffers=new Map<Sample,AudioBuffer>(), voices=new Map<AudioBufferSourceNode,{cue:Cue;priority:number}>(), last=new Map<Cue,number>();
  let maxVoices=0, started=0;
  let loaded=false,pending:Cue|null=null;
  const enabled=()=>!settings.musicMuted||!settings.sfxMuted;
  function diagnostics(){root.dataset.audio=ctx?.state??'off';root.dataset.music=loop?'playing':musicError?'unavailable':bgm?'ready':'idle';root.dataset.audioSamples=String(buffers.size);root.dataset.audioVoices=String(voices.size);root.dataset.audioMaxVoices=String(maxVoices);root.dataset.audioLoops=String(loop?1:0);root.dataset.audioStarts=String(started);}
  function gains(){if(!ctx)return;effects.gain.setTargetAtTime(settings.sfxMuted?0:settings.sfx*.24,ctx.currentTime,.02);score.gain.setTargetAtTime(settings.musicMuted?0:settings.music*.2,ctx.currentTime,.06);}
  function persist(){try{let all:Record<string,unknown>={};try{all=JSON.parse(localStorage.getItem(KEY)||'{}');if(!all||typeof all!=='object'||Array.isArray(all))all={};}catch{/* Replace malformed settings. */}all[game]=settings;localStorage.setItem(KEY,JSON.stringify(all));}catch{/* Storage is optional. */}changed(enabled());gains();labels();}
  async function decode(url:string){const response=await fetch(url);if(!response.ok)throw new Error('Audio asset unavailable');return ctx!.decodeAudioData(await response.arrayBuffer());}
  function ensure(){
    if(disposed||!enabled())return;
    try{
      if(!ctx){ctx=new AudioContext();master=ctx.createGain();master.gain.value=.85;master.connect(ctx.destination);effects=ctx.createGain();score=ctx.createGain();effects.gain.value=settings.sfxMuted?0:settings.sfx*.24;score.gain.value=settings.musicMuted?0:settings.music*.2;effects.connect(master);score.connect(master);
        ctx.addEventListener('statechange',()=>{if(ctx?.state==='running')playMusic();diagnostics();});
      }
      if(ctx.state!=='running')void ctx.resume().then(()=>{playMusic();diagnostics();}).catch(()=>diagnostics());
      if(!loading){loading=(async()=>{
        await Promise.all(files.map(async file=>{try{buffers.set(file,await decode(`/games/audio/${file}.wav`));}catch{sfxError=true;}}));
        loaded=true;if(pending&&!disposed&&!document.hidden){const event=pending;pending=null;if(event!=='start'||active)cue(event);}
        diagnostics();
      })();}
      if(active&&!settings.musicMuted&&!bgm&&!musicError&&music[game]){musicError=true;void decode(music[game]!).then(buffer=>{bgm=buffer;musicError=false;playMusic();diagnostics();}).catch(()=>{musicError=true;diagnostics();});}
    }catch{/* Context creation or resume cannot interrupt gameplay. */}
    diagnostics();
  }
  function playMusic(){if(disposed||!active||document.hidden||!ctx||ctx.state!=='running'||settings.musicMuted||!bgm||loop||fading.size)return;loop=ctx.createBufferSource();loop.buffer=bgm;loop.loop=true;loopEnvelope=ctx.createGain();loopEnvelope.gain.setValueAtTime(0,ctx.currentTime);loopEnvelope.gain.linearRampToValueAtTime(1,ctx.currentTime+.04);loop.connect(loopEnvelope);loopEnvelope.connect(score);loopStarted=ctx.currentTime;loop.start(0,offset%bgm.duration);started++;diagnostics();}
  function stopMusic(reset=false){if(loop&&ctx){offset=reset?0:(offset+ctx.currentTime-loopStarted)%(bgm?.duration||1);const source=loop,envelope=loopEnvelope!;loop=null;loopEnvelope=null;fading.add(source);envelope.gain.cancelScheduledValues(ctx.currentTime);envelope.gain.setValueAtTime(envelope.gain.value,ctx.currentTime);envelope.gain.linearRampToValueAtTime(0,ctx.currentTime+.035);source.onended=()=>{fading.delete(source);source.disconnect();envelope.disconnect();playMusic();diagnostics();};source.stop(ctx.currentTime+.04);}else if(reset)offset=0;diagnostics();}
  function silence(){stopMusic();for(const source of voices.keys()){try{source.stop();}catch{/* Already ended. */}source.disconnect();}voices.clear();diagnostics();}
  function setPlaying(value:boolean,restart=false){active=value;if(!value){silence();return;}if(restart)stopMusic(true);ensure();playMusic();}
  function cue(cue:Cue){
    if(settings.sfxMuted||disposed||document.hidden)return;ensure();if(!ctx||ctx.state!=='running')return;
    const now=ctx.currentTime, cooldown=cue==='shot'||cue==='hit'?.1:cue==='warning'?1:cue==='brake'?.65:.08;
    if(now-(last.get(cue)??-Infinity)<cooldown)return;
    const map:Record<Cue,Sample>={select:'click',start:'click',jump:game==='orbit'?'warning':'jump',land:'land',shot:'shot',hit:'roll',warning:'warning',damage:'damage',death:'death',clear:'clear',brake:'roll'};
    const buffer=buffers.get(map[cue]);if(!buffer){if(!loaded&&(cue==='start'||cue==='select'))pending=cue;return;}
    const priority=['warning','damage','death','clear'].includes(cue)?2:1;
    if([...voices.values()].filter(v=>v.cue===cue).length>=2)return;
    if(voices.size>=10){const victim=[...voices].find(([,v])=>v.priority<priority);if(!victim)return;victim[0].stop();victim[0].disconnect();voices.delete(victim[0]);}
    last.set(cue,now);const source=ctx.createBufferSource();source.buffer=buffer;
    source.playbackRate.value=cue==='jump'?game==='orbit'?1.6:1.25:cue==='land'?.95:1;
    const gain=ctx.createGain();gain.gain.value=cue==='shot'?.45:cue==='land'?.65:1;source.connect(gain);gain.connect(effects);
    voices.set(source,{cue,priority});maxVoices=Math.max(maxVoices,voices.size);source.onended=()=>{voices.delete(source);source.disconnect();gain.disconnect();diagnostics();};source.start();diagnostics();
  }
  function toggle(){const mute=enabled();settings.musicMuted=mute;settings.sfxMuted=mute;persist();if(mute)silence();else{ensure();playMusic();cue('select');}}
  // A separate settings button preserves the established one-tap Sound ON/OFF control.
  const dialog=document.createElement('dialog');dialog.className='game-audio-settings';
  const heading=document.createElement('h2'), notice=document.createElement('p'), close=document.createElement('button');
  const rows=(['music','sfx'] as const).map(channel=>{const row=document.createElement('label'),text=document.createElement('span'),range=document.createElement('input'),mute=document.createElement('button');range.type='range';range.min='0';range.max='100';range.step='5';range.value=String(Math.round(settings[channel]*100));mute.type='button';range.addEventListener('input',()=>{settings[channel]=Number(range.value)/100;persist();});mute.onclick=e=>{e.preventDefault();const key=channel==='music'?'musicMuted':'sfxMuted';settings[key]=!settings[key];persist();ensure();if(settings.musicMuted)stopMusic();else playMusic();};row.append(text,range,mute);return{channel,row,text,range,mute};});
  close.type='button';close.onclick=()=>dialog.close();dialog.append(heading,...rows.map(r=>r.row),notice,close);document.body.append(dialog);
  const settingsButton=document.createElement('button');settingsButton.type='button';settingsButton.className='audio-settings-button';settingsButton.textContent='♫';
  function labels(){heading.textContent=tr('音の設定','Audio settings');close.textContent=tr('閉じる','Close');notice.textContent=tr('音楽と効果音を個別に調整できます。','Adjust music and effects separately.');settingsButton.setAttribute('aria-label',tr('音量設定','Volume settings'));rows.forEach(({channel,text,range,mute})=>{text.textContent=channel==='music'?tr('音楽','Music'):tr('効果音','Effects');range.setAttribute('aria-label',text.textContent);const muted=settings[channel==='music'?'musicMuted':'sfxMuted'];mute.textContent=muted?tr('ミュート解除','Unmute'):tr('ミュート','Mute');mute.setAttribute('aria-pressed',String(muted));});}
  let clearControls=()=>{}, previousInert=false;
  const blockedKeys=new Set<string>();
  function modalKey(e:KeyboardEvent){
    if(dialog.open){
      e.stopImmediatePropagation();
      if(e.type==='keydown'){
        blockedKeys.add(e.code);
        if(e.code==='Escape'){e.preventDefault();dialog.close();}
      }else blockedKeys.delete(e.code);
    }else if(blockedKeys.has(e.code)){
      // A key held in the dialog stays blocked until its physical release.
      e.preventDefault();e.stopImmediatePropagation();
      if(e.type==='keyup')blockedKeys.delete(e.code);
    }
  }
  function modalPointer(e:Event){if(dialog.open&&!dialog.contains(e.target as Node)){e.preventDefault();e.stopImmediatePropagation();}}
  dialog.addEventListener('close',()=>{root.inert=previousInert;clearControls();settingsButton.focus({preventScroll:true});});
  function mount(button:HTMLElement,pause:()=>void,clear:()=>void){clearControls=clear;button.after(settingsButton);settingsButton.onclick=()=>{pause();clearControls();active=false;silence();ensure();previousInert=root.inert;dialog.showModal();root.inert=true;};}
  const hidden=()=>{if(document.hidden){active=false;silence();void ctx?.suspend().catch(()=>{});}};
  const hide=(e:PageTransitionEvent)=>{active=false;silence();if(!e.persisted)dispose();};
  function dispose(){disposed=true;silence();void ctx?.close().catch(()=>{});document.removeEventListener('visibilitychange',hidden);window.removeEventListener('pagehide',hide);window.removeEventListener(LANGUAGE_EVENT,labels);window.removeEventListener('keydown',modalKey,true);window.removeEventListener('keyup',modalKey,true);for(const type of ['pointerdown','pointermove','pointerup'])window.removeEventListener(type,modalPointer,true);if(dialog.open)root.inert=previousInert;dialog.remove();}
  document.addEventListener('visibilitychange',hidden);window.addEventListener('pagehide',hide);window.addEventListener(LANGUAGE_EVENT,labels);window.addEventListener('keydown',modalKey,true);window.addEventListener('keyup',modalKey,true);for(const type of ['pointerdown','pointermove','pointerup'])window.addEventListener(type,modalPointer,true);labels();diagnostics();
  return{cue,setPlaying,toggle,mount,enabled,settingsOpen:()=>dialog.open,unlock:ensure,dispose,settings:()=>({...settings}),reset(){settings=parse(null,false);if(game==='orbit'||game==='amber'){try{const all=JSON.parse(localStorage.getItem(KEY)||'{}');all[game==='orbit'?'amber':'orbit']=parse(null,false);localStorage.setItem(KEY,JSON.stringify(all));}catch{/* Optional storage. */}}persist();silence();},status:()=>({context:ctx?.state??'off',sfxError,musicError,voices:voices.size,loops:loop?1:0})};
}
