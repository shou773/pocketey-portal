import { createGameAudio } from '../../audio';
import { LANGUAGE_EVENT, installLocale, tr } from '../../../lib/locale';
import { advance, courseAt, COURSES, createState, FINISH, PRECISION_FAR, PRECISION_NEAR, queueTurn, SAVE_KEY, STEP, WINDOW, windowOpen, type Direction } from './model';
import { bindFlick } from './input';
import { CAMPAIGN_KEY, mergeRecords, parseProgress, precision, recordClear, serializeProgress, unlocked } from './progress';
import { createView } from './render';

export function boot() {
  installLocale();
  const root = document.querySelector<HTMLElement>('#alpine')!;
  const get = <T extends HTMLElement = HTMLElement>(id: string) => document.getElementById(`ad-${id}`) as T;
  const canvas = get<HTMLCanvasElement>('canvas');
  let state=createState(), {save,writable}=parseProgress(null,null), storageOK=true;
  try { ({save,writable}=parseProgress(localStorage.getItem(CAMPAIGN_KEY),localStorage.getItem(SAVE_KEY))); } catch { storageOK=false; }
  let view: ReturnType<typeof createView> | null=null;
  try { view=createView(canvas); } catch { /* Show a usable error and reload action. */ }
  let previous=0, accumulator=0, raf=0, lastHUD=0, feedbackUntil=0;
  let feedback: 'early' | 'queued' | null=null;
  const input=bindFlick(canvas, turn);
  function persist() {
    if(!writable)return;
    try {
      const latest=parseProgress(localStorage.getItem(CAMPAIGN_KEY),null);
      if(!latest.writable){writable=false;return;}
      mergeRecords(save,latest.save);localStorage.setItem(CAMPAIGN_KEY,serializeProgress(save));
    } catch { storageOK=false; }
  }
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
    state=createState(state.course);state.phase='playing';resetInput();accumulator=0;previous=performance.now();
    audio.setPlaying(true,true);audio.cue('start');renderUI();canvas.focus({preventScroll:true});
  }
  function selectCourse(index: number) {
    if(!unlocked(save,index))return;
    resetInput();state=createState(index);accumulator=0;audio.setPlaying(false);renderUI();
    get('courses').querySelector<HTMLButtonElement>(`[data-course="${index}"]`)?.focus({preventScroll:true});
    get('overlay').scrollTop=0;
  }
  function menu() { selectCourse(state.course); }
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
    const p=state.phase, course=courseAt(state.course), record=save.records[state.course];
    get('overlay').hidden=p==='playing';
    get('sound').textContent=tr('音 ','Sound ')+(audio.enabled()?'ON':'OFF');
    get('sound').setAttribute('aria-pressed',String(audio.enabled()));
    get<HTMLButtonElement>('pause').disabled=!view||(p!=='playing'&&p!=='paused');
    get('pause').textContent=p==='paused'?tr('再開','Resume'):tr('停止','Pause');
    get('title').textContent=p==='clear'?tr('ゴール！','Finish!'):p==='failed'?tr('もう一度、走ろう','Try that turn again'):p==='paused'?tr('一時停止','Paused'):'Alpine Drive';
    get('copy').textContent=p==='clear'?tr(`${course.gates.length}旋回を完走！ 精度 ${precision(state)}%（${state.precise}/${course.gates.length}）。`, `All ${course.gates.length} turns complete! Precision ${precision(state)}% (${state.precise}/${course.gates.length}).`):
      p==='failed'?state.reason==='block'?tr('しま模様のバリケードに接触。黄色い区間で矢印の方向へ。','You hit a striped barrier. Follow the arrow in each yellow zone.'):
      tr('道の端に接触しました。旋回の線までに方向を予約しよう。','You reached the road edge. Queue your turn before the line.'):
      p==='paused'?tr('予約は解除されました。区間内なら再入力できます。最初の入力タイミングは保持されます。','Queued steering is cleared. Flick again inside the zone. Your first-input timing stays locked.'):
      tr(`${tr(...course.name)} · ${course.gates.length}旋回でゴールへ。`, `${tr(...course.name)} · ${course.gates.length} turns to the finish.`);
    get('instructions').textContent=tr('黄色い区間で矢印の方向へフリック。終端の線で45°旋回。方向は線まで変更可。\n任意の精度チャレンジ：マーカーが緑の帯に入ったら入力。各区間の最初の入力で判定、記録は完走時のみ。',
      'Flick as the arrow shows inside each yellow zone. Turn 45° at the end line; change direction until then.\nOptional precision: flick when the marker enters the green band. Only your first input counts; records save on a finish.');
    get('instructions').hidden=p!=='ready';
    get('save').textContent=!writable?tr('新しい形式の記録を保護中。このタブのみで記録します。','Newer save protected. Records last for this tab.'):
      !storageOK?tr('保存不可：記録はこのタブのみ。','Storage unavailable: records last for this tab.'):
      tr(`このコースの完走：${record.clears} · 最高精度 ${record.best===null?'—':record.best+'%'}`,`Course finishes: ${record.clears} · Best precision ${record.best===null?'—':record.best+'%'}`);
    get('art').textContent=tr(`オリジナル山岳ドライブ · ${COURSES.length}コース`, `Original mountain drive · ${COURSES.length} courses`);
    get('courses').hidden=p!=='ready';get('courses').replaceChildren();
    get('courses').setAttribute('aria-label',tr('コース選択','Choose a course'));
    if(p==='ready')COURSES.forEach((entry,index)=>{
      const button=document.createElement('button'),available=unlocked(save,index),r=save.records[index];
      button.type='button';button.dataset.course=String(index);button.disabled=!available;
      button.setAttribute('aria-pressed',String(index===state.course));
      const title=document.createElement('strong');title.textContent=`0${index+1} ${tr(...entry.name)}`;
      const detail=document.createElement('span');detail.textContent=available?
        `${tr(...entry.rhythm)} · ${tr('最高','BEST')} ${r.best===null?'—':r.best+'%'}`:
        tr(`コース${index}を完走で開放`,`Finish course ${index} to unlock`);
      button.append(title,detail);button.onclick=()=>selectCourse(index);get('courses').append(button);
    });
    get('controls-note').textContent=tr('画面を左右フリック\nボタン / ← → / A D も可','FLICK LEFT / RIGHT\nButtons / ← → / A D');
    get('label').textContent=tr(...course.name);
    get('course-count').textContent=`0${state.course+1} / 0${COURSES.length}`;
    get('progress').setAttribute('aria-label',tr('ゴールまでの進行度','Progress to finish'));
    canvas.setAttribute('aria-label',tr('自動前進。黄色い区間で左右フリックして旋回。','Auto-driving car. Flick left or right inside yellow turn zones.'));
    for(const [id,dir] of [['left',-1],['right',1]] as const) {
      get<HTMLButtonElement>(id).disabled=p!=='playing';
      get(id).setAttribute('aria-label',tr(`${side(dir)}旋回を予約`,`Queue ${side(dir).toLowerCase()} turn`));
    }
    get('actions').replaceChildren();
    if(!view) {get('title').textContent=tr('3D表示を開始できません','3D view unavailable');get('copy').textContent=tr('WebGL対応ブラウザで再読み込みしてください。','Reload in a browser with WebGL enabled.');action(tr('再読み込み','Reload'),()=>location.reload(),true);}
    else if(p==='ready')action(tr('ドライブ開始','Start driving'),start,true);
    else if(p==='paused') {action(tr('再開','Resume'),resume,true);action(tr('最初から','Restart'),start);action(tr('コース選択','Courses'),menu);}
    else if(p==='failed'||p==='clear') {
      if(p==='clear'&&state.course+1<COURSES.length&&unlocked(save,state.course+1))action(tr('次のコース','Next course'),()=>selectCourse(state.course+1),true);
      action(tr('すぐリトライ','Retry now'),start,p==='failed'||state.course===COURSES.length-1);action(tr('コース選択','Courses'),menu);
    }
    if(p!=='playing'&&p!=='ready')get('actions').querySelector<HTMLButtonElement>('button')?.focus({preventScroll:true});
    hud();
  }
  function hud() {
    const course=courseAt(state.course);
    root.dataset.course=String(state.course);root.dataset.precise=String(state.precise);root.dataset.firstInput=String(state.firstInput);
    root.dataset.phase=state.phase;root.dataset.z=state.z.toFixed(3);root.dataset.x=state.x.toFixed(3);
    root.dataset.gate=String(state.gate);root.dataset.queued=String(state.queued);root.dataset.heading=String(state.heading);
    root.dataset.reason=state.reason??'';root.dataset.window=String(windowOpen(state));
    root.dataset.drawCalls=String(view?.renderer.info.render.calls??0);root.dataset.triangles=String(view?.renderer.info.render.triangles??0);
    get<HTMLProgressElement>('progress').value=state.z;
    get('count').textContent=`${Math.min(course.gates.length,state.gate)} / ${course.gates.length} ${tr('旋回','TURNS')}`;
    get('precision').textContent=tr(`精度 ${state.precise}/${course.gates.length} · 任意`, `PRECISION ${state.precise}/${course.gates.length} · OPTIONAL`);
    const gate=course.gates[state.gate],open=windowOpen(state);
    get('cue').hidden=state.phase!=='playing';get('cue').dataset.open=String(open);
    get('direction').textContent=gate?`${gate.direction===-1?'←':'→'} ${side(gate.direction)}`:tr('まっすぐゴールへ','STRAIGHT TO FINISH');
    get('timing').textContent=state.queued!==null?tr(`${side(state.queued)}を予約 · 線で曲がる`,`${side(state.queued)} QUEUED · Turn at the line`):
      gate?open?tr('いまフリック · 線で曲がる','FLICK NOW · Turn at the line'):tr(`あと${Math.ceil(Math.max(0,gate.z-5-state.z))}mで入力区間`,`Turn zone in ${Math.ceil(Math.max(0,gate.z-5-state.z))}m`):`${Math.ceil(FINISH-state.z)}m`;
    const distance=state.firstInput??(gate?gate.z-state.z:WINDOW);
    get('target').hidden=!open;get('target-note').hidden=!open;
    get('needle').style.left=`${Math.max(0,Math.min(100,100*(1-distance/WINDOW)))}%`;
    get('target').dataset.locked=String(state.firstInput!==null);
    get('target-note').textContent=state.firstInput!==null?
      distance>=PRECISION_NEAR&&distance<=PRECISION_FAR?tr('✓ 帯の中 · タイミング確定','✓ IN BAND · TIMING LOCKED'):tr('帯の外 · タイミング確定','OUTSIDE BAND · TIMING LOCKED'):
      tr('任意：緑の帯でタイミング精度アップ','OPTIONAL: aim for the green band');
    get('target').dataset.precise=String(distance>=PRECISION_NEAR&&distance<=PRECISION_FAR);
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
          if(recordClear(save,state))persist();
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
