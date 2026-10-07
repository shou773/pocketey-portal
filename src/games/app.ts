import { cleanSave, createState, DT, SAVE_KEY, stages, step, type Kind } from './model';
import { createView } from './render';
export function boot() {
  const $ = <T extends HTMLElement = HTMLElement>(id: string) => document.getElementById(id) as T;
  const root = $('game'); const kind = root.dataset.kind as Kind;
  const title = kind === 'orbit' ? 'Orbit Ribbon' : 'Amber Step';
  let save = cleanSave(null), storageOkay = true;
  try { save = cleanSave(JSON.parse(localStorage.getItem(SAVE_KEY) || 'null')); } catch { storageOkay = false; }
  function persist(reset = false) {
    try {
      if (!reset) {
        let latest = cleanSave(null);
        try { latest = cleanSave(JSON.parse(localStorage.getItem(SAVE_KEY) || 'null')); } catch { /* Replace malformed saves. */ }
        for (const game of ['orbit', 'amber'] as const) {
          save[game].unlocked = Math.max(save[game].unlocked, latest[game].unlocked);
          save[game].best = save[game].best.map((n, i) => { const previous = latest[game].best[i]; return n === null ? previous : previous === null ? n : Math.min(n, previous); });
        }
      }
      localStorage.setItem(SAVE_KEY, JSON.stringify(save)); storageOkay = true;
    } catch { storageOkay = false; }
    note();
  }
  function note() { $('save-note').textContent = storageOkay ? '記録はこのブラウザに保存されます。' : '保存を利用できません。この画面では続けて遊べます。'; }
  let selected = 0, state = createState(kind, 0), mode: 'menu' | 'play' | 'pause' | 'result' | 'reset' = 'menu';
  let view: ReturnType<typeof createView>;
  try { view = createView($<HTMLCanvasElement>('scene'), kind); } catch { $('panel-title').textContent = '3D画面を起動できません'; $('panel-copy').textContent = 'WebGLに対応したブラウザで開き直してください。'; $('reset').hidden = true; return; }
  let audio: AudioContext | null = null;
  function tone(frequency: number, duration = .1) {
    if (!save.sound) return;
    try { audio ??= new AudioContext(); void audio.resume(); const osc = audio.createOscillator(), gain = audio.createGain(); osc.frequency.value = frequency; gain.gain.setValueAtTime(.045, audio.currentTime); gain.gain.exponentialRampToValueAtTime(.001, audio.currentTime + duration); osc.connect(gain).connect(audio.destination); osc.start(); osc.stop(audio.currentTime + duration); } catch { /* Audio failure never interrupts play. */ }
  }
  const keys = new Set<string>(), pointers = new Map<number, string>(); let jumpQueued = false;
  function clearInput() { keys.clear(); pointers.clear(); jumpQueued = false; document.querySelectorAll('.held').forEach(el => el.classList.remove('held')); }
  function axis() { const inputs = [...pointers.values()]; return Number(keys.has('ArrowRight') || keys.has('KeyD') || inputs.includes('right')) - Number(keys.has('ArrowLeft') || keys.has('KeyA') || inputs.includes('left')); }
  function soundLabel() { $('sound').textContent = save.sound ? '音 ON' : '音 OFF'; $('sound').setAttribute('aria-pressed', String(save.sound)); }
  $('sound').onclick = () => { save.sound = !save.sound; soundLabel(); persist(); tone(660); };
  function button(text: string, fn: () => void, primary = false) { const b = document.createElement('button'); b.textContent = text; if (primary) b.className = 'primary'; b.onclick = fn; $('actions').append(b); }
  function stageButtons() {
    $('stages').replaceChildren();
    stages[kind].forEach((stage, i) => { const b = document.createElement('button'); b.disabled = i >= save[kind].unlocked; b.setAttribute('aria-label', `ステージ ${i + 1} ${stage.name}`); b.setAttribute('aria-pressed', String(i === selected)); const n = document.createElement('b'); n.textContent = `0${i + 1}`; const label = document.createElement('small'); label.textContent = b.disabled ? 'LOCKED' : save[kind].best[i] ? `${save[kind].best[i]!.toFixed(2)}s` : 'READY'; b.append(n, label); b.onclick = () => { selected = i; state = createState(kind, i); view.load(i); menu(); }; $('stages').append(b); });
  }
  function panel(heading: string, copy: string) {
    clearInput(); $('overlay').hidden = false; $('panel-title').textContent = heading; $('panel-copy').textContent = copy; $('actions').replaceChildren(); $('stages').hidden = true; $('instructions').hidden = true; $('reset').hidden = true; $<HTMLButtonElement>('pause').disabled = mode !== 'pause'; $('hint').textContent = ''; note();
  }
  function menu() {
    mode = 'menu'; panel(title, stages[kind][selected].hint); stageButtons(); $('stages').hidden = false; $('instructions').hidden = false;
    $('instructions').textContent = kind === 'orbit' ? '自動で前進。← → で左右移動、JUMPで跳ぶ。PC: A / D・矢印・Space。' : '← → で移動、JUMPで跳ぶ。同時押しOK。PC: A / D・矢印・Space。';
    $('reset').hidden = false; button(`ステージ ${selected + 1} をはじめる`, start, true);
  }
  function start() { clearInput(); state = createState(kind, selected); view.load(selected); mode = 'play'; $('overlay').hidden = true; $<HTMLButtonElement>('pause').disabled = false; $('pause').textContent = '一時停止'; $('hint').textContent = stages[kind][selected].hint; accumulator = 0; last = performance.now(); tone(520); }
  function pause() { if (mode !== 'play') return; mode = 'pause'; panel('ひと休み', '準備ができたら、同じ場所から。'); button('つづける', resume, true); button('やり直す', start); button('ステージ選択', menu); }
  function resume() { if (mode !== 'pause') return; clearInput(); mode = 'play'; $('overlay').hidden = true; last = performance.now(); accumulator = 0; }
  $('pause').onclick = () => mode === 'pause' ? resume() : pause();
  function finish() {
    mode = 'result';
    if (state.status === 'clear') {
      const progress = save[kind]; progress.unlocked = Math.max(progress.unlocked, Math.min(3, selected + 2)); progress.best[selected] = Math.min(progress.best[selected] ?? Infinity, state.time); persist();
      panel(selected === 2 ? 'ALL CLEAR!' : 'STAGE CLEAR', `${stages[kind][selected].name} · ${state.time.toFixed(2)}秒 / BEST ${progress.best[selected]!.toFixed(2)}秒`);
      tone(880, .25); if (selected < 2) button('次のステージ', () => { selected++; start(); }, true); else button('もう一度', start, true);
    } else { panel('もう一度、いこう。', 'すき間の光るふちでジャンプ。左右の足場も確かめよう。'); tone(170, .2); button('すぐにリトライ', start, true); }
    if (state.status === 'clear' && selected < 2) button('もう一度', start);
    button('ステージ選択', menu);
  }
  $('reset').onclick = () => { mode = 'reset'; panel('記録をリセット？', 'Orbit Ribbon と Amber Step のステージ・自己ベスト・音設定だけを消去します。ほかのゲームの記録は残ります。'); button('キャンセル', menu, true); button('この2作品をリセット', () => { save = cleanSave(null); selected = 0; state = createState(kind, 0); view.load(0); persist(true); soundLabel(); menu(); }); };
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
  $('scene').addEventListener('webglcontextlost', e => { e.preventDefault(); pause(); $('panel-copy').textContent = '3D描画が中断されました。ページを再読み込みしてください。記録は保存されています。'; });
  let last = performance.now(), accumulator = 0;
  function frame(now: number) {
    const elapsed = Math.min((now - last) / 1000, .1); last = now;
    if (mode === 'play') {
      accumulator += elapsed;
      while (accumulator >= DT && mode === 'play') {
        const previousJumps = state.jumps; step(state, { axis: axis(), jump: jumpQueued }); jumpQueued = false; accumulator -= DT;
        if (state.jumps > previousJumps) tone(440);
        if (state.status !== 'running') finish();
      }
      if (state.time > 5) $('hint').textContent = '';
    }
    $('stage-label').textContent = `0${selected + 1} / 03`; $('stage-name').textContent = stages[kind][selected].name; $('timer').textContent = state.time.toFixed(2); $('progress-fill').style.width = `${Math.min(100, Math.max(0, state.x / stages[kind][selected].length * 100))}%`;
    // Read-only diagnostics for reproducible browser verification; no state setter or gameplay bypass.
    root.dataset.mode = mode; root.dataset.status = state.status; root.dataset.x = state.x.toFixed(3); root.dataset.y = state.y.toFixed(3); root.dataset.z = state.z.toFixed(3); root.dataset.grounded = String(state.grounded); root.dataset.jumps = String(state.jumps);
    view.draw(state); root.dataset.geometries = String(view.renderer.info.memory.geometries); requestAnimationFrame(frame);
  }
  view.load(0); soundLabel(); menu(); requestAnimationFrame(frame);
}
