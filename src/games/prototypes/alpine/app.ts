import { createGameAudio } from '../../audio';
import { LANGUAGE_EVENT, installLocale, tr } from '../../../lib/locale';
import { advance, createState, FINISH, GATES, parseSave, queueTurn, SAVE_KEY, STEP, windowOpen, type Direction } from './model';
import { bindFlick } from './input';
import { createView } from './render';

export function boot() {
  installLocale();
  const root = document.querySelector<HTMLElement>('#alpine')!;
  const get = <T extends HTMLElement = HTMLElement>(id: string) => document.getElementById(`ad-${id}`) as T;
  const canvas = get<HTMLCanvasElement>('canvas');
  let state=createState(), save=parseSave(null), storageOK=true;
  try { save=parseSave(localStorage.getItem(SAVE_KEY)); } catch { storageOK=false; }
  let view: ReturnType<typeof createView> | null=null;
  try { view=createView(canvas); } catch { /* Show a usable error and reload action. */ }
  let previous=0, accumulator=0, raf=0, lastHUD=0, feedbackUntil=0;
  let feedback: 'early' | 'queued' | null=null;
  const input=bindFlick(canvas, turn);
  function persist() { try { localStorage.setItem(SAVE_KEY,JSON.stringify(save)); } catch { storageOK=false; } }
  function resetInput() { input.clear(); state.queued=null; feedback=null; }
  const audio=createGameAudio('alpine',!save.muted,root,enabled=>{save.muted=!enabled;persist();renderUI();});
  audio.mount(get('sound'),pause,resetInput);
  const side=(direction: Direction)=>direction===-1?tr('左','LEFT'):tr('右','RIGHT');
  function turn(direction: Direction) {
    if(state.phase!=='playing'||audio.settingsOpen())return;
    feedback=queueTurn(state,direction)?'queued':'early'; feedbackUntil=performance.now()+1100;
    if(feedback==='queued')audio.cue('select'); hud();
  }
  function start() {
    if(!view||document.hidden)return;
    state=createState();state.phase='playing';resetInput();accumulator=0;previous=performance.now();
    audio.setPlaying(true,true);audio.cue('start');renderUI();canvas.focus({preventScroll:true});
  }
  function pause() {
    if(state.phase!=='playing')return;
    state.phase='paused';resetInput();accumulator=0;audio.setPlaying(false);renderUI();
  }
  function resume() {
    if(!view||state.phase!=='paused'||document.hidden||audio.settingsOpen())return;
    state.phase='playing';resetInput();accumulator=0;previous=performance.now();audio.setPlaying(true);renderUI();canvas.focus({preventScroll:true});
  }
  function action(text: string, callback: () => void, primary=false) {
    const button=document.createElement('button');button.type='button';button.textContent=text;
    if(primary)button.className='primary';button.onclick=callback;get('actions').append(button);
  }
  function renderUI() {
    const p=state.phase;
    get('overlay').hidden=p==='playing';
    get('sound').textContent=tr('音 ','Sound ')+(audio.enabled()?'ON':'OFF');
    get('sound').setAttribute('aria-pressed',String(audio.enabled()));
    get<HTMLButtonElement>('pause').disabled=!view||(p!=='playing'&&p!=='paused');
    get('pause').textContent=p==='paused'?tr('再開','Resume'):tr('停止','Pause');
    get('title').textContent=p==='clear'?tr('ゴール！','Finish!'):p==='failed'?tr('もう一度、走ろう','Try that turn again'):p==='paused'?tr('一時停止','Paused'):'Alpine Drive';
    get('copy').textContent=p==='clear'?tr('4つの曲がり角を抜けました。','You made it through all four turns.'):
      p==='failed'?state.reason==='block'?tr('赤い障害物に接触しました。黄色い区間で矢印の方向へ。','You hit a red block. Follow the arrow in each yellow zone.'):
      tr('道の端に接触しました。旋回の線までに方向を予約しよう。','You reached the road edge. Queue your turn before the line.'):
      p==='paused'?tr('車は停止中。予約は解除されました。再開後、黄色い区間なら入力し直せます。','The car is stopped. Queued input is cleared; flick again if you resume inside a yellow zone.'):
      tr('自動で進む車を、4回のフリックでゴールへ。','Guide an auto-driving car to the finish with four flicks.');
    get('instructions').textContent=tr('① 黄色い区間に入る\n② 矢印の方向へ左右フリック\n③ 区間終端の線で45°旋回\n予約は線まで変更できます。赤い箱と道の端を避けよう。',
      '1. Enter a yellow zone\n2. Flick left or right as the arrow shows\n3. Turn 45° at the end line\nChange your queued turn until the line. Avoid red blocks and road edges.');
    get('instructions').hidden=p==='clear';
    get('save').textContent=storageOK?tr(`この端末のクリア回数：${save.clears}`,`Clears on this device: ${save.clears}`):tr('保存不可：記録はこのタブのみ。','Storage unavailable: records last for this tab.');
    get('art').textContent=tr('操作試作・1面のみ。画面の仕上げは未着手。','One-stage input prototype. Visual art pass not started.');
    get('controls-note').textContent=tr('画面を左右フリック\nボタン / ← → / A D も可','FLICK LEFT / RIGHT\nButtons / ← → / A D');
    get('label').textContent=tr('操作試作','INPUT PROTOTYPE');
    get('progress').setAttribute('aria-label',tr('ゴールまでの進行度','Progress to finish'));
    canvas.setAttribute('aria-label',tr('自動前進。黄色い区間で左右フリックして旋回。','Auto-driving car. Flick left or right inside yellow turn zones.'));
    for(const [id,dir] of [['left',-1],['right',1]] as const) {
      get<HTMLButtonElement>(id).disabled=p!=='playing';
      get(id).setAttribute('aria-label',tr(`${side(dir)}旋回を予約`,`Queue ${side(dir).toLowerCase()} turn`));
    }
    get('actions').replaceChildren();
    if(!view) {get('title').textContent=tr('3D表示を開始できません','3D view unavailable');get('copy').textContent=tr('WebGL対応ブラウザで再読み込みしてください。','Reload in a browser with WebGL enabled.');action(tr('再読み込み','Reload'),()=>location.reload(),true);}
    else if(p==='ready')action(tr('ドライブ開始','Start driving'),start,true);
    else if(p==='paused') {action(tr('再開','Resume'),resume,true);action(tr('最初から','Restart'),start);}
    else if(p==='failed'||p==='clear')action(tr('すぐリトライ','Retry now'),start,true);
    if(p!=='playing'&&p!=='ready')get('actions').querySelector<HTMLButtonElement>('button')?.focus({preventScroll:true});
    hud();
  }
  function hud() {
    root.dataset.phase=state.phase;root.dataset.z=state.z.toFixed(3);root.dataset.x=state.x.toFixed(3);
    root.dataset.gate=String(state.gate);root.dataset.queued=String(state.queued);root.dataset.heading=String(state.heading);
    root.dataset.reason=state.reason??'';root.dataset.window=String(windowOpen(state));
    root.dataset.drawCalls=String(view?.renderer.info.render.calls??0);root.dataset.triangles=String(view?.renderer.info.render.triangles??0);
    get<HTMLProgressElement>('progress').value=state.z;
    get('count').textContent=`${Math.min(4,state.gate)} / 4 ${tr('旋回','TURNS')}`;
    const gate=GATES[state.gate],open=windowOpen(state);
    get('cue').hidden=state.phase!=='playing';get('cue').dataset.open=String(open);
    get('direction').textContent=gate?`${gate.direction===-1?'←':'→'} ${side(gate.direction)}`:tr('まっすぐゴールへ','STRAIGHT TO FINISH');
    get('timing').textContent=state.queued!==null?tr(`${side(state.queued)}を予約 · 線で曲がる`,`${side(state.queued)} QUEUED · Turn at the line`):
      gate?open?tr('いまフリック · 線で曲がる','FLICK NOW · Turn at the line'):tr(`あと${Math.ceil(Math.max(0,gate.z-5-state.z))}mで入力区間`,`Turn zone in ${Math.ceil(Math.max(0,gate.z-5-state.z))}m`):`${Math.ceil(FINISH-state.z)}m`;
    get('feedback').textContent=state.phase==='playing'&&performance.now()<feedbackUntil&&feedback==='early'?tr('黄色い区間まで待とう','Wait for the yellow zone'):'';
  }
  get('left').onclick=()=>turn(-1);get('right').onclick=()=>turn(1);
  get('sound').onclick=()=>audio.toggle();get('pause').onclick=()=>state.phase==='paused'?resume():pause();
  const key=(e: KeyboardEvent)=>{
    if(e.repeat||audio.settingsOpen())return;
    if(['ArrowLeft','KeyA','ArrowRight','KeyD'].includes(e.code)&&state.phase==='playing') {
      e.preventDefault();turn(e.code==='ArrowLeft'||e.code==='KeyA'?-1:1);
    }
    if(e.code==='Escape'||e.code==='KeyP'){e.preventDefault();state.phase==='paused'?resume():pause();}
  };
  const hidden=()=>{if(document.hidden){pause();resetInput();previous=0;}};
  const blur=()=>{pause();resetInput();};
  window.addEventListener('keydown',key);window.addEventListener('blur',blur);
  document.addEventListener('visibilitychange',hidden);window.addEventListener(LANGUAGE_EVENT,renderUI);
  canvas.addEventListener('webglcontextlost',e=>{e.preventDefault();pause();view?.dispose();view=null;resetInput();renderUI();});
  function frame(now: number) {
    const elapsed=previous?Math.max(0,Math.min(.1,(now-previous)/1000)):0;previous=now;
    if(!document.hidden&&!audio.settingsOpen()) {
      const wasPlaying=state.phase==='playing';
      if(state.phase==='playing') {
        accumulator+=elapsed;
        while(accumulator>=STEP&&state.phase==='playing'){advance(state);accumulator-=STEP;}
      } else accumulator=0;
      if(wasPlaying&&(state.phase==='clear'||state.phase==='failed')) {
          if(state.phase==='clear'){save.clears=Math.min(999999,save.clears+1);persist();}
          resetInput();audio.setPlaying(false);audio.cue(state.phase==='clear'?'clear':'death');renderUI();
      }
      if(now-lastHUD>50){hud();lastHUD=now;}
      view?.draw(state);
    }
    raf=requestAnimationFrame(frame);
  }
  renderUI();raf=requestAnimationFrame(frame);
  window.addEventListener('pagehide',e=>{
    pause();resetInput();
    if(!e.persisted){cancelAnimationFrame(raf);input.dispose();view?.dispose();audio.dispose();
      window.removeEventListener('keydown',key);window.removeEventListener('blur',blur);
      document.removeEventListener('visibilitychange',hidden);window.removeEventListener(LANGUAGE_EVENT,renderUI);}
  });
}
