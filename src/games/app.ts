import {createGameAudio} from './audio';
import { cleanSave, createState, DT, SAVE_KEY, stages, step, type Kind } from './model';
import { createView } from './render';
import { SIGNAL_SAVE_KEY, createSignalRun, collectSignals, signalCount, recordSignalClear, parseSignalProgress, serializeSignalProgress } from './signals';
import {installLocale,LANGUAGE_EVENT,tr} from '../lib/locale';
import {stageName as localizedStageName,stageHint} from './copy';
export function boot() {
  installLocale();
  const $ = <T extends HTMLElement = HTMLElement>(id: string) => document.getElementById(id) as T;
  const root = $('game'); const kind = root.dataset.kind as Kind;
  const title = kind === 'orbit' ? 'Orbit Ribbon' : 'Amber Step';
  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
  function icon(name: string, className = '') {
    const span = document.createElement('span'); span.className = `asset-icon ${className}`;
    span.setAttribute('aria-hidden', 'true'); span.style.setProperty('--icon', `url('/games/assets/lucide/${name}.svg')`); return span;
  }
  let save = cleanSave(null), storageOkay = true;
  let signalProgress = parseSignalProgress(null), signalStorageOkay = true, signalRun = createSignalRun(0);
  if (kind === 'orbit') { try { signalProgress = parseSignalProgress(localStorage.getItem(SIGNAL_SAVE_KEY)); signalStorageOkay = signalProgress.writable; } catch { signalStorageOkay = false; } }
  function persistSignals(reset = false) {
    if (!signalProgress.writable) { signalStorageOkay = false; return; }
    try {
      const latest = parseSignalProgress(localStorage.getItem(SIGNAL_SAVE_KEY));
      if (!latest.writable) { signalProgress.writable = false; signalStorageOkay = false; return; }
      if (!reset) signalProgress.best = signalProgress.best.map((n, i) => n === null ? latest.best[i] : Math.max(n, latest.best[i] ?? 0));
      localStorage.setItem(SIGNAL_SAVE_KEY, serializeSignalProgress(signalProgress)); signalStorageOkay = true;
    } catch { signalStorageOkay = false; }
  }
  try { save = cleanSave(JSON.parse(localStorage.getItem(SAVE_KEY) || 'null')); } catch { storageOkay = false; }
  function persist(reset = false) {
    try {
      if (!reset) {
        let latest = cleanSave(null);
        try { latest = cleanSave(JSON.parse(localStorage.getItem(SAVE_KEY) || 'null')); } catch { /* Replace malformed saves. */ }
        for (const game of ['orbit', 'amber'] as const) {
          save[game].unlocked = Math.max(save[game].unlocked, latest[game].unlocked);
          for (const key of ['best', 'challengeBest'] as const) {
            save[game][key] = save[game][key].map((n, i) => { const previous = latest[game][key][i]; return n === null ? previous : previous === null ? n : Math.min(n, previous); });
          }
        }
      }
      localStorage.setItem(SAVE_KEY, JSON.stringify(save)); storageOkay = true;
    } catch { storageOkay = false; }
    note();
  }
  function note() { $('save-note').textContent = storageOkay ? tr('記録はこのブラウザに保存されます。', 'Progress is saved in this browser.') : mode === 'recovery' ? tr('保存を利用できません。再読み込みすると未保存の記録は失われます。', 'Storage is unavailable. Reloading loses unsaved progress.') : tr('保存を利用できません。この画面では続けて遊べます。', 'Storage is unavailable. You can keep playing here.'); const oldBest=save[kind].best[selected]; if(storageOkay && oldBest) $('save-note').textContent += tr(` 旧コースBEST ${oldBest.toFixed(2)}秒は別保存。`, ` Previous course BEST ${oldBest.toFixed(2)}s is kept separately.`); if (kind === 'orbit' && !signalStorageOkay) $('save-note').textContent += tr(' 通信片の記録は保存できません。この画面では遊べます。', ' Signal records cannot be saved. You can still play here.'); }
  let selected = 0, state = createState(kind, 0), mode: 'menu' | 'play' | 'pause' | 'result' | 'reset' | 'recovery' = 'menu';
  let view: ReturnType<typeof createView>;
  try { view = createView($<HTMLCanvasElement>('scene'), kind); } catch { function unavailable(){ $('panel-title').textContent = tr('3D画面を起動できません', '3D could not start'); $('panel-copy').textContent = tr('WebGLに対応したブラウザで開き直してください。', 'Reopen this game in a browser that supports WebGL 2.'); $('reset').hidden = true; $<HTMLButtonElement>('sound').disabled = true;document.querySelectorAll<HTMLButtonElement>('[data-input]').forEach(b=>{b.disabled=true;}); }unavailable();window.addEventListener(LANGUAGE_EVENT,unavailable);return; }
  const audio=createGameAudio(kind,save.sound,root,enabled=>{save.sound=enabled;persist();soundLabel();});
  audio.mount($('sound'),pause,clearInput);
  const keys = new Set<string>(), pointers = new Map<number, string>(); let jumpQueued = false;
  function clearInput() { keys.clear(); pointers.clear(); jumpQueued = false; document.querySelectorAll('.held').forEach(el => el.classList.remove('held')); }
  function axis() { const inputs = [...pointers.values()]; return Number(keys.has('ArrowRight') || keys.has('KeyD') || inputs.includes('right')) - Number(keys.has('ArrowLeft') || keys.has('KeyA') || inputs.includes('left')); }
  function soundLabel() { $('sound').textContent = audio.enabled() ? tr('音 ON', 'Sound ON') : tr('音 OFF', 'Sound OFF'); $('sound').setAttribute('aria-pressed', String(audio.enabled())); }
  $('sound').onclick = () => audio.toggle();
  function button(text: string, fn: () => void, primary = false) { const b = document.createElement('button'); if (primary) { b.className = 'primary'; b.append(icon(mode === 'result' && state.status === 'dead' ? 'rotate-ccw' : 'play')); } b.append(document.createTextNode(text)); b.onclick = fn; $('actions').append(b); }
  function stageButtons() {
    $('stages').replaceChildren();
    stages[kind].forEach((stage, i) => { const b = document.createElement('button'); b.disabled = i >= save[kind].unlocked; b.setAttribute('aria-label', tr(`ステージ ${i + 1} ${stage.name}`,`Stage ${i + 1} ${localizedStageName(kind,i)}`)); b.setAttribute('aria-pressed', String(i === selected)); const n = document.createElement('b'); n.textContent = `0${i + 1}`; const label = document.createElement('small'); label.textContent = b.disabled ? tr('ロック','LOCKED') : kind === 'orbit' ? tr(`通信片 ${signalProgress.best[i] ?? '—'} / 3`, `SIGNALS ${signalProgress.best[i] ?? '—'} / 3`) : save[kind].challengeBest[i] ? `${save[kind].challengeBest[i]!.toFixed(2)}s` : tr('挑戦可能','READY'); if (kind === 'orbit') b.setAttribute('aria-label', `${b.getAttribute('aria-label')} · ${b.disabled ? label.textContent : signalProgress.best[i] === null ? tr('通信片の記録なし', 'No completed signal record') : label.textContent}`); const name = document.createElement('span'); name.className = 'stage-name'; name.textContent = localizedStageName(kind,i); b.append(icon(b.disabled ? 'lock-keyhole' : save[kind].challengeBest[i] ? 'check' : 'flag', 'stage-symbol'), n, name, label); b.onclick = () => { selected = i; state = createState(kind, i); signalRun = createSignalRun(i); view.load(i); menu();audio.cue('select'); }; $('stages').append(b); });
  }
  function panel(heading: string, copy: string) {
    clearInput(); $('overlay').dataset.screen = mode; $('overlay').dataset.result = state.status; $('panel-icon').style.setProperty('--icon', `url('/games/assets/lucide/${mode === 'result' ? state.status === 'clear' ? 'trophy' : 'rotate-ccw' : mode === 'pause' ? 'sparkles' : kind === 'orbit' ? 'orbit' : 'gem'}.svg')`); $('eyebrow').textContent = mode === 'result' && state.status === 'clear' ? `STAGE 0${selected + 1} COMPLETE` : kind === 'orbit' ? 'POCKETEY / COSMIC RUN' : 'POCKETEY / WARM ADVENTURE'; $('overlay').hidden = false; $('overlay').scrollTop = 0; $('panel-title').textContent = heading; $('panel-copy').textContent = copy; $('actions').replaceChildren(); $('stages').hidden = true; $('instructions').hidden = true; $('reset').hidden = true; $<HTMLButtonElement>('pause').disabled = mode !== 'pause'; $('hint').textContent = ''; note();
  }
  function menu() {
    if (mode === 'recovery') return;
    audio.setPlaying(false);mode = 'menu'; panel(title, stageHint(kind,selected)); stageButtons(); $('stages').hidden = false; $('instructions').hidden = false;
    $('instructions').replaceChildren(icon(kind === 'orbit' ? 'orbit' : 'footprints'), document.createTextNode(kind === 'orbit' ? tr('自動で前進。左右でよけて、JUMPで跳ぼう。金色の通信片は任意。ゴールすると集めた数が記録されます。', 'Auto-run. Steer and tap JUMP. Gold signals are optional. Reach the finish to keep your collection record.') : tr('左右で移動。JUMPは同時押しOK。', 'Move left or right. Hold movement + JUMP.'))); const keyboardHelp = document.createElement('small'); keyboardHelp.className = 'keyboard-help'; keyboardHelp.textContent = tr('PC: A / D・矢印・Space', 'Keyboard: A / D, arrows, Space'); $('instructions').append(keyboardHelp);
    $('reset').hidden = false; button(tr(`ステージ ${selected + 1} をはじめる`,`Start stage ${selected + 1}`), start, true);
  }
  function start() { if (mode === 'recovery') return; clearInput(); state = createState(kind, selected); signalRun = createSignalRun(selected); view.load(selected); mode = 'play'; $('overlay').hidden = true; $<HTMLButtonElement>('pause').disabled = false; $('pause').textContent = tr('一時停止', 'Pause'); $('hint').textContent = stageHint(kind,selected); accumulator = 0; last = performance.now(); audio.setPlaying(true,true);audio.cue('start'); }
  function pause() { if (mode !== 'play') return; mode = 'pause';audio.setPlaying(false); renderPause(); }
  function renderPause() { panel(tr('ひと休み', 'Take a break'), tr('準備ができたら、同じ場所から。', 'Pick up where you left off when you are ready.')); button(tr('つづける', 'Resume'), resume, true); button(tr('やり直す', 'Restart'), start); button(tr('ステージ選択', 'Choose a stage'), menu); }
  function resume() { if (mode !== 'pause') return; clearInput(); mode = 'play'; $('overlay').hidden = true; last = performance.now(); accumulator = 0; audio.setPlaying(true); }
  $('pause').onclick = () => mode === 'pause' ? resume() : pause();
  function finish(announce = true) {
    mode = 'result';audio.setPlaying(false);
    if (state.status === 'clear') {
      if (kind === 'orbit' && recordSignalClear(signalProgress, signalRun, state) && announce) persistSignals();
      const progress = save[kind]; progress.unlocked = Math.max(progress.unlocked, Math.min(3, selected + 2)); progress.challengeBest[selected] = Math.min(progress.challengeBest[selected] ?? Infinity, state.time); if (announce) persist();
      panel(selected === 2 ? tr('全ステージクリア！','ALL CLEAR!') : tr('クリア！','STAGE CLEAR'), tr(`${localizedStageName(kind,selected)} · ${state.time.toFixed(2)}秒 / BEST ${progress.challengeBest[selected]!.toFixed(2)}秒`,`${localizedStageName(kind,selected)} · ${state.time.toFixed(2)}s / BEST ${progress.challengeBest[selected]!.toFixed(2)}s`));
      if (kind === 'orbit') $('panel-copy').textContent = tr(`${localizedStageName(kind,selected)} · ${state.time.toFixed(2)}秒 · 通信片 ${signalCount(signalRun)} / 3（ベスト ${signalProgress.best[selected]} / 3）`, `${localizedStageName(kind,selected)} · ${state.time.toFixed(2)}s · SIGNALS ${signalCount(signalRun)} / 3 (BEST ${signalProgress.best[selected]} / 3)`);
      if (announce) audio.cue('clear'); if (selected < 2) button(tr('次のステージ', 'Next stage'), () => { selected++; start(); }, true); else button(tr('もう一度', 'Play again'), start, true);
    } else { panel(tr('もう一度、いこう。', 'One more try.'), tr('すき間の光るふちでジャンプ。左右の足場も確かめよう。', 'Jump near a glowing gap edge. Check the next platform, too.')); if (announce) audio.cue('death'); button(tr('すぐにリトライ', 'Retry now'), start, true); }
    if (kind === 'orbit' && state.status === 'dead' && signalCount(signalRun) > 0) $('panel-copy').textContent += tr(' 通信片の記録はゴールしたときだけ残ります。', ' Signal records only count when you reach the finish.');
    if (state.status === 'clear' && selected < 2) button(tr('もう一度', 'Play again'), start);
    button(tr('ステージ選択', 'Choose a stage'), menu);
  }
  function renderReset() { mode = 'reset'; panel(tr('記録をリセット？', 'Reset your records?'), tr('Orbit Ribbon と Amber Step のステージ・自己ベスト・通信片・音設定だけを消去します。ほかのゲームの記録は残ります。', 'This clears only the stages, personal bests, signal records and sound settings for Orbit Ribbon and Amber Step. Other games and your language preference are kept.')); button(tr('キャンセル', 'Cancel'), menu, true); button(tr('この2作品をリセット', 'Reset these two games'), () => { audio.reset(); save = cleanSave(null); signalProgress = parseSignalProgress(null); persistSignals(true); signalRun = createSignalRun(0); selected = 0; state = createState(kind, 0); view.load(0); persist(true); soundLabel(); menu(); }); }
  $('reset').onclick = renderReset;
  document.querySelectorAll<HTMLButtonElement>('[data-input]').forEach(b => {
    b.addEventListener('pointerdown', e => { e.preventDefault(); if (mode !== 'play') return; b.setPointerCapture(e.pointerId); pointers.set(e.pointerId, b.dataset.input!); b.classList.add('held'); if (b.dataset.input === 'jump') jumpQueued = true; });
    const release = (e: PointerEvent) => { pointers.delete(e.pointerId); if (![...pointers.values()].includes(b.dataset.input!)) b.classList.remove('held'); };
    b.addEventListener('pointerup', release); b.addEventListener('pointercancel', release); b.addEventListener('lostpointercapture', release);
  });
  window.addEventListener('keydown', e => {
    if (e.code === 'Escape' && !e.repeat) { mode === 'play' ? pause() : resume(); return; }
    if (e.code === 'KeyR' && !e.repeat && (mode === 'play' || mode === 'result' || mode === 'pause')) { start(); return; }
    if (mode !== 'play' || !['ArrowLeft', 'ArrowRight', 'KeyA', 'KeyD', 'Space', 'ArrowUp', 'KeyW'].includes(e.code)) return;
    e.preventDefault(); if (!e.repeat && ['Space', 'ArrowUp', 'KeyW'].includes(e.code)) jumpQueued = true; keys.add(e.code);
  });
  window.addEventListener('keyup', e => keys.delete(e.code));
  window.addEventListener('blur', () => { clearInput(); pause(); });
  document.addEventListener('visibilitychange', () => { if (document.hidden) { clearInput(); pause(); } });
  window.addEventListener('pagehide', clearInput);
  $('scene').addEventListener('webglcontextlost', e => { e.preventDefault(); renderRecovery(); });
  function renderRecovery() {
    // Recovery is deliberately latched until a full reload, even if WebGL restores itself.
    // Never advance an invisible run or mutate a save as a side effect of context loss.
    audio.setPlaying(false);mode = 'recovery'; accumulator = 0;
    panel(tr('画面を再読み込み', 'Reload the game'), tr('3D描画が中断されました。安全に再開するため、ページを再読み込みしてください。今回の途中経過は再開できません。保存済みの記録は変更しません。', '3D rendering stopped. Reload the page to play again. This interrupted run cannot resume. Saved records are unchanged.'));
    $<HTMLButtonElement>('sound').disabled = true;
    document.querySelectorAll<HTMLButtonElement>('[data-input]').forEach(b => { b.disabled = true; });
    button(tr('再読み込み', 'Reload'), () => window.location.reload(), true);
    $('panel-title').tabIndex = -1; $('panel-title').focus({ preventScroll: true });
  }
  const stageLabel = $('stage-label'), stageName = $('stage-name'), timer = $('timer'), progressFill = $('progress-fill'), hint = $('hint');
  function textIfChanged(element: HTMLElement, value: string) { if (element.textContent !== value) element.textContent = value; }
  let last = performance.now(), accumulator = 0;
  function frame(now: number) {
    const elapsed = Math.min((now - last) / 1000, .1); last = now;
    if (mode === 'play' && !audio.settingsOpen()) {
      accumulator += elapsed;
      while (accumulator >= DT && mode === 'play') {
        const previousJumps = state.jumps, wasGrounded = state.grounded; step(state, { axis: axis(), jump: jumpQueued }); jumpQueued = false; accumulator -= DT;
        if (kind === 'orbit' && collectSignals(signalRun, state)) audio.cue('select');
        if (state.jumps > previousJumps) audio.cue('jump');
        if (!wasGrounded && state.grounded && state.status === 'running') audio.cue('land');
        if (!wasGrounded && state.grounded && state.status === 'running' && !reducedMotion.matches) $('landing-cue').animate([{ opacity: .6, scale: '.6 1' }, { opacity: 0, scale: '1.3 1' }], { duration: 220 });
        if (state.status !== 'running') finish();
      }
      if (state.time > 5) textIfChanged(hint, '');
    }
    textIfChanged(stageLabel, `0${selected + 1} / 03`); textIfChanged(stageName, localizedStageName(kind,selected)); textIfChanged(timer, state.time.toFixed(2)); progressFill.style.transform = `scaleX(${Math.min(1, Math.max(0, state.x / stages[kind][selected].length))})`;
    if (kind === 'orbit') { textIfChanged($('signals'), tr(`通信片 ${signalCount(signalRun)} / 3 · 任意`, `SIGNALS ${signalCount(signalRun)} / 3 · OPTIONAL`)); root.dataset.signalMask = String(signalRun.mask); root.dataset.signals = String(signalCount(signalRun)); }
    // Read-only diagnostics for reproducible browser verification; no state setter or gameplay bypass.
    root.dataset.mode = mode; root.dataset.status = state.status; root.dataset.x = state.x.toFixed(3); root.dataset.y = state.y.toFixed(3); root.dataset.z = state.z.toFixed(3); root.dataset.grounded = String(state.grounded); root.dataset.jumps = String(state.jumps);
    if (mode !== 'recovery') view.draw(state, kind === 'orbit' ? signalRun.mask : 0); root.dataset.drawCalls = String(view.renderer.info.render.calls); root.dataset.triangles = String(view.renderer.info.render.triangles); root.dataset.geometries = String(view.renderer.info.memory.geometries); requestAnimationFrame(frame);
  }
  function staticLabels(){
    $('sound').setAttribute('aria-label',tr('音を切り替え','Toggle sound'));
    $('pause').textContent=tr('一時停止','Pause');$('reset').textContent=tr('この2作品の記録をリセット','Reset both games’ records');
    $('scene').setAttribute('aria-label',tr(`${title} の3Dゲーム画面`,`${title} 3D game`));
    for(const [input,ja,en] of [['left','左へ移動','Move left'],['right','右へ移動','Move right'],['jump','ジャンプ','Jump']])document.querySelector(`[data-input=${input}]`)!.setAttribute('aria-label',tr(ja,en));
    soundLabel();
  }
  window.addEventListener(LANGUAGE_EVENT,()=>{staticLabels();if(mode==='play')pause();else if(mode==='menu')menu();else if(mode==='pause')renderPause();else if(mode==='result')finish(false);else if(mode==='reset')renderReset();else renderRecovery();});
  view.load(0); staticLabels(); menu(); requestAnimationFrame(frame);
}

