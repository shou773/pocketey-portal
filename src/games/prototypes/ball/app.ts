import {createGameAudio} from '../../audio';
import { LANGUAGE_EVENT, installLocale, tr } from '../../../lib/locale';
import { advance, createState, length, parseSave, SAVE_KEY, STAGES, STEP, type Phase } from './model';
import { createView } from './render';

export function boot() {
  installLocale();
  const root = document.querySelector<HTMLElement>('#tilttrail')!;
  const get = <T extends HTMLElement = HTMLElement>(id: string) => document.getElementById(`tt-${id}`) as T;
  let state = createState(), selected = 0, save = parseSave(null), storageOK = true;
  try { save = parseSave(localStorage.getItem(SAVE_KEY)); } catch { storageOK = false; }
  let view: ReturnType<typeof createView> | null = null;
  try { view = createView(get<HTMLCanvasElement>('canvas')); } catch { /* A readable fallback replaces the playable menu. */ }
  const clearBurst = get('clear-burst'), reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  let burstTimer = 0;
  function stopBurst() { window.clearTimeout(burstTimer); burstTimer = 0; clearBurst.classList.remove('active'); }
  function celebrateClear() {
    stopBurst();
    if (reducedMotion.matches || document.hidden) return;
    clearBurst.classList.add('active'); burstTimer = window.setTimeout(stopBurst, 560);
  }
  reducedMotion.addEventListener('change', stopBurst);
  const pointers = new Map<number, string>(), keys = new Set<string>();
  let lastPhase: Phase = 'ready', accumulator = 0, previous = 0, raf = 0, lastHUD = 0, wasBraking = false;
  function persist() { try { localStorage.setItem(SAVE_KEY, JSON.stringify(save)); } catch { storageOK = false; } }
  const audio=createGameAudio('tilt',!save.muted,root,enabled=>{save.muted=!enabled;persist();renderUI();});audio.mount(get('sound'),pause,resetInput);
  const controlButtons = [...root.querySelectorAll<HTMLButtonElement>('[data-tt-input]')];
  function held(control: string) { return [...pointers.values()].includes(control) || (control === 'left' ? keys.has('ArrowLeft') || keys.has('KeyA') : control === 'right' ? keys.has('ArrowRight') || keys.has('KeyD') : keys.has('Space') || keys.has('ArrowDown') || keys.has('KeyS')); }
  function reflectControls() { controlButtons.forEach(b => { const on = held(b.dataset.ttInput!); b.classList.toggle('held', on); b.setAttribute('aria-pressed', String(on)); }); }
  function resetInput() { pointers.clear(); keys.clear(); wasBraking=false; reflectControls(); }
  function start(stage: number) {
    if (!view || document.hidden) return;
    stopBurst(); view.resetEffects(); selected = stage; state = createState(stage); state.phase = 'playing'; lastPhase = 'playing'; accumulator = 0; previous = performance.now(); resetInput(); audio.setPlaying(true,true);audio.cue('start'); renderUI();
    get<HTMLButtonElement>('pause').focus({ preventScroll: true });
  }
  function menu() { stopBurst(); view?.resetEffects(); audio.setPlaying(false);state = createState(selected); lastPhase = 'ready'; resetInput(); renderUI(); }
  function pause() { if (state.phase !== 'playing') return; stopBurst(); view?.resetEffects(); state.phase = 'paused';audio.setPlaying(false); resetInput(); accumulator = 0; renderUI(); }
  function resume() { if (!view || state.phase !== 'paused' || document.hidden) return; state.phase = 'playing'; resetInput(); previous = performance.now(); accumulator = 0; audio.setPlaying(true); renderUI(); get<HTMLButtonElement>('pause').focus({ preventScroll: true }); }
  function action(text: string, callback: () => void, primary = false) {
    const b = document.createElement('button'); b.textContent = text; b.type = 'button'; if (primary) b.className = 'primary'; b.addEventListener('click', callback); get('actions').append(b);
  }
  function renderUI() {
    const phase = state.phase, overlay = get('overlay'); overlay.hidden = phase === 'playing' || phase === 'falling';
    get('sound').textContent = tr('音 ', 'Sound ') + (audio.enabled() ? 'ON' : 'OFF'); get('sound').setAttribute('aria-pressed', String(audio.enabled()));
    get<HTMLButtonElement>('pause').disabled = !view || (phase !== 'playing' && phase !== 'paused'); get('pause').textContent = view && phase === 'paused' ? tr('再開', 'Resume') : tr('一時停止', 'Pause');
    get('back').textContent = tr('ゲーム一覧へ', 'All games'); get('control-note').textContent = tr('左右で転がす\n減速：長押し', 'STEER ← → / A D\nBRAKE: HOLD / SPACE');
    controlButtons.forEach(b => { const type = b.dataset.ttInput!; b.disabled = phase !== 'playing'; b.setAttribute('aria-label', type === 'left' ? tr('左に転がす', 'Steer left') : type === 'right' ? tr('右に転がす', 'Steer right') : tr('長押しで減速', 'Hold to brake')); if (type === 'brake') b.textContent = tr('ブレーキ', 'BRAKE'); });
    get('progress').setAttribute('aria-label', tr('ゴールまでの進行度', 'Progress to goal'));
    get('canvas').setAttribute('aria-label', tr('TiltTrail：空に浮かぶ道をボールで転がる3Dゲーム', 'TiltTrail: roll a ball along floating 3D trails'));
    get('instructions').textContent = tr('左右ボタン / ← → / A D：転がす\nブレーキ長押し / Space：減速 · Esc / P：一時停止', 'Left / right buttons or ← → / A D: steer\nHold BRAKE or Space: slow down · Esc / P: pause');
    get('save').textContent = storageOK ? tr('記録はこの端末に保存。3ステージはすべて選べます。', 'Records stay on this device. All 3 stages are available.') : tr('保存できません。記録はこのタブでのみ保持します。', 'Storage unavailable. Records last for this tab only.');
    get('stages').hidden = phase !== 'ready'; get('instructions').hidden = phase === 'clear';
    get('stages').replaceChildren();
    STAGES.forEach((stage, i) => {
      const button = document.createElement('button'); button.type = 'button'; button.dataset.stage = String(i); button.setAttribute('aria-pressed', String(i === selected));
      const num = document.createElement('strong'); num.textContent = `0${i + 1}`;
      const label = document.createElement('span'); label.textContent = tr(...stage.name);
      const best = document.createElement('small'); best.textContent = save.best[i] ? `${tr('最速', 'BEST')} ${save.best[i]!.toFixed(2)}s` : tr('未クリア', 'Not cleared');
      button.append(num, label, best); button.addEventListener('click', () => { selected = i; state = createState(i); renderUI();audio.cue('select'); get('stages').querySelector<HTMLButtonElement>(`[data-stage="${i}"]`)!.focus({ preventScroll: true }); }); get('stages').append(button);
    });
    get('title').textContent = phase === 'paused' ? tr('ひと休み', 'Take a breath') : phase === 'failed' ? tr('もう一度、転がそう', 'One more roll') : phase === 'clear' ? tr('ゴール！', 'Trail complete!') : 'TiltTrail';
    get('eyebrow').textContent = phase === 'ready' ? tr('ころがる、曲がる、見きわめる', 'ROLL · STEER · FIND YOUR LINE') : `STAGE 0${state.stage + 1} · ${tr(...STAGES[state.stage].name)}`;
    get('copy').textContent = phase === 'ready' ? tr('左右でボールの慣性を操り、空の道をゴールまで。曲がる前にブレーキで減速しよう。', 'Guide a rolling ball along a trail in the sky. Catch its momentum, brake before bends, and reach the glowing gate.') : phase === 'paused' ? tr('再開するまでボールは止まっています。', 'Your ball stays still until you resume.') : phase === 'failed' ? tr('オレンジの縁を越えると落下します。曲がる前に減速し、早めに切り返そう。', 'The orange edges mark the drop. Brake before bends and counter-steer early.') : `${state.time.toFixed(2)}s · ${tr('ベスト', 'BEST')} ${save.best[state.stage]?.toFixed(2)}s`;
    get('actions').replaceChildren();
    if (!view) { get('title').textContent = tr('3D表示を開始できません', '3D view unavailable'); get('copy').textContent = tr('WebGLが使えるブラウザで開き直してください。', 'Reopen in a browser with WebGL enabled.'); action(tr('再読み込み', 'Reload'), () => location.reload(), true); }
    else if (phase === 'ready') action(tr('このステージを遊ぶ', 'Play this stage'), () => start(selected), true);
    else if (phase === 'paused') { action(tr('再開', 'Resume'), resume, true); action(tr('やり直す', 'Retry'), () => start(state.stage)); action(tr('ステージ選択', 'Stages'), menu); }
    else if (phase === 'failed') { action(tr('すぐリトライ', 'Retry now'), () => start(state.stage), true); action(tr('ステージ選択', 'Stages'), menu); }
    else if (phase === 'clear') { if (state.stage < 2) action(tr('次のステージへ', 'Next stage'), () => start(state.stage + 1), true); else action(tr('ステージ選択', 'Stages'), menu, true); action(tr('もう一度', 'Roll again'), () => start(state.stage)); if (state.stage < 2) action(tr('ステージ選択', 'Stages'), menu); }
    if (!overlay.hidden && phase !== 'ready') get('actions').querySelector<HTMLButtonElement>('button')?.focus({ preventScroll: true });
    hud();
  }
  function hud() {
    root.dataset.phase = state.phase; root.dataset.stage = String(state.stage); root.dataset.x = state.x.toFixed(4); root.dataset.z = state.z.toFixed(4); root.dataset.vx = state.vx.toFixed(4); root.dataset.time = state.time.toFixed(4); root.dataset.speed = state.speed.toFixed(4);
    root.dataset.drawCalls = String(view?.renderer.info.render.calls ?? 0); root.dataset.triangles = String(view?.renderer.info.render.triangles ?? 0);
    root.dataset.trailPoints = String(view?.trailPoints ?? 0); root.dataset.trailLength = String(view?.trailLength ?? 0); root.dataset.brakeOpacity = String(view?.brakeOpacity ?? 0);
    root.dataset.audio = audio.status().context;
    get('stage').textContent = `0${state.stage + 1} / 03`; get('name').textContent = tr(...STAGES[state.stage].name); get('time').textContent = state.time.toFixed(2);
    get('speed').textContent = `${tr('速度', 'SPEED')} ${state.speed.toFixed(1)} m/s`;
    get<HTMLProgressElement>('progress').value = Math.min(1, state.z / length(state.stage));
    get('hint').hidden = state.phase !== 'playing' && state.phase !== 'falling';
    get('hint').textContent = state.phase === 'falling' ? tr('道の外へ！', 'Over the edge!') : held('brake') ? tr('減速中 · 左右で進路を合わせよう', 'BRAKING · Line up your next turn') : tr(...STAGES[state.stage].hint);
  }
  controlButtons.forEach(b => {
    b.addEventListener('pointerdown', e => { if (state.phase !== 'playing') return; e.preventDefault(); pointers.set(e.pointerId, b.dataset.ttInput!); b.setPointerCapture(e.pointerId); audio.unlock(); reflectControls(); });
    const release = (e: PointerEvent) => { pointers.delete(e.pointerId); reflectControls(); };
    b.addEventListener('pointerup', release); b.addEventListener('pointercancel', release); b.addEventListener('lostpointercapture', release); b.addEventListener('contextmenu', e => e.preventDefault());
  });
  function keydown(e: KeyboardEvent) {
    if (e.target instanceof HTMLButtonElement && (e.code === 'Space' || e.code === 'Enter')) return;
    if (['ArrowLeft','ArrowRight','ArrowDown','KeyA','KeyD','Space','KeyS'].includes(e.code) && state.phase === 'playing') { e.preventDefault(); keys.add(e.code); audio.unlock(); reflectControls(); }
    if (!e.repeat && (e.code === 'Escape' || e.code === 'KeyP')) { if (state.phase === 'paused') resume(); else pause(); }
  }
  // Space remains a brake while the pause button has focus after starting.
  get('pause').addEventListener('keydown', e => { if (e.code === 'Space' && state.phase === 'playing') { e.preventDefault(); e.stopPropagation(); keys.add('Space'); reflectControls(); } });
  function keyup(e: KeyboardEvent) { keys.delete(e.code); reflectControls(); }
  window.addEventListener('keydown', keydown); window.addEventListener('keyup', keyup);
  get('pause').addEventListener('click', () => state.phase === 'paused' ? resume() : pause());
  get('sound').addEventListener('click', () => audio.toggle());
  function visibility() { if (document.hidden) { stopBurst(); view?.resetEffects(); if (state.phase === 'playing') pause(); resetInput(); previous = 0; accumulator = 0; audio.setPlaying(false); } }
  function blur() { pause(); resetInput(); }
  document.addEventListener('visibilitychange', visibility); window.addEventListener('blur', blur); window.addEventListener(LANGUAGE_EVENT, renderUI);
  get('canvas').addEventListener('webglcontextlost', e => {
    e.preventDefault(); stopBurst();
    // Freeze both ordinary play and an in-flight fall before releasing WebGL.
    if (state.phase === 'playing' || state.phase === 'falling') state.phase = 'paused';
    resetInput(); accumulator = 0; lastPhase = state.phase;
    audio.setPlaying(false);view?.dispose(); view = null; renderUI();
  });
  function frame(now: number) {
    const elapsed = previous ? Math.max(0, Math.min(0.1, (now - previous) / 1000)) : 0; previous = now;
    if (!document.hidden && !audio.settingsOpen()) {
      if (state.phase === 'playing' || state.phase === 'falling') {
        const braking=state.phase==='playing'&&held('brake');if(braking&&!wasBraking)audio.cue('brake');wasBraking=braking;
        accumulator += elapsed;
        while (accumulator >= STEP) { advance(state, { steer: Number(held('right')) - Number(held('left')), brake: held('brake') }); accumulator -= STEP; }
      } else accumulator = 0;
      if (state.phase !== lastPhase) {
        if (state.phase === 'falling') { audio.setPlaying(false);resetInput(); audio.cue('death'); }
        if (state.phase === 'clear') { const best = save.best[state.stage]; if (best === null || state.time < best) save.best[state.stage] = state.time; persist(); audio.setPlaying(false);resetInput(); audio.cue('clear'); }
        lastPhase = state.phase; renderUI();
        if (state.phase === 'clear') celebrateClear();
      }
      if (now - lastHUD > 60) { hud(); lastHUD = now; }
      view?.draw(state, elapsed);
    }
    raf = requestAnimationFrame(frame);
  }
  renderUI(); raf = requestAnimationFrame(frame);
  window.addEventListener('pagehide', () => { stopBurst(); view?.resetEffects(); resetInput(); pause(); }, { once: false });
  // Normal page navigation releases WebGL and audio resources; bfcache can resume.
  window.addEventListener('pagehide', e => { if (!e.persisted) { cancelAnimationFrame(raf); reducedMotion.removeEventListener('change', stopBurst); view?.dispose(); audio.dispose(); } });
}
