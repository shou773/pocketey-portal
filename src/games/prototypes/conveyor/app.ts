import { LANGUAGE_EVENT, installLocale, tr } from '../../../lib/locale';
import { STAGE, SAVE_KEY, ports, reduce, parseSave, restore, type Action, type Outcome } from './model';
import { createMotion, sampleMotion, type Motion } from './motion';
import { createView } from './render';
import { createSound } from './sound';

export function boot() {
  installLocale();
  const root = document.getElementById('conveyor')!;
  const get = <T extends HTMLElement = HTMLElement>(name: string) => document.getElementById(`cv-${name}`) as T;
  let storageOK = true, save = parseSave(null);
  try { save = parseSave(localStorage.getItem(SAVE_KEY)); } catch { storageOK = false; }
  let state = restore(save), motion: Motion | null = null, elapsed = 0;
  let view: ReturnType<typeof createView> | null = null;
  try { view = createView(get<HTMLCanvasElement>('canvas')); } catch { /* Readable WebGL fallback below. */ }
  let dirty = true, previous = 0, lastDraw = 0, raf = 0, disposed = false;
  const audio = createSound(renderUI);
  const audioDialog = get<HTMLDialogElement>('audio');
  const tileButtons = STAGE.tiles.map((tile, index) => {
    const button = document.createElement('button'); button.type = 'button'; button.className = 'cv-tile'; button.dataset.tile = tile.id;
    const number = document.createElement('span'); number.textContent = String(index + 1); number.setAttribute('aria-hidden', 'true'); button.append(number);
    button.addEventListener('click', () => { if (dispatch({ type: 'rotate', id: tile.id })) audio.cue('select'); });
    get('tiles').append(button); return button;
  });
  function persist() {
    save.rotations = state.tiles.map(tile => tile.rotation); save.turns = state.turns;
    if (state.phase === 'success') save.best = Math.min(save.best ?? Infinity, state.turns);
    try { localStorage.setItem(SAVE_KEY, JSON.stringify(save)); } catch { storageOK = false; }
  }
  function dispatch(action: Action) {
    if (disposed || (audioDialog.open && action.type !== 'pause')) return false;
    if (!view && ['rotate', 'play', 'resume'].includes(action.type)) return false;
    if (document.hidden && ['play', 'resume'].includes(action.type)) return false;
    const next = reduce(state, action);
    if (next === state) return false;
    state = next;
    if (action.type === 'play') { motion = createMotion(state.route!); elapsed = 0; previous = 0; audio.cue('start'); }
    if (['rotate', 'reset', 'retry'].includes(action.type)) { motion = null; elapsed = 0; audio.stop(); }
    if (action.type === 'resume') previous = 0;
    if (action.type === 'pause') audio.stop();
    if (action.type === 'finish') audio.cue(state.phase === 'success' ? 'success' : 'fail');
    if (['rotate', 'reset', 'finish'].includes(action.type)) persist();
    renderUI();
    if (action.type === 'finish') get('play').focus({ preventScroll: true });
    return true;
  }
  const reasons: Record<Exclude<Outcome, 'success'>, [string, string]> = {
    'wrong-entry': ['ベルトの入口側が合っていません。白い矢印の根元を箱に向けよう。', 'The inlet does not line up. Face the tail of the white arrow toward the arriving parcel.'],
    'wrong-exit': ['出荷口は左側からだけ入れます。入口の向きを合わせよう。', 'The shipping machine only accepts parcels from its left side. Line up with its opening.'],
    empty: ['ベルトのない場所に進みました。隣のコンベアにつなげよう。', 'There is no belt ahead. Connect the route to the next conveyor.'],
    'out-of-bounds': ['盤面の外に進みました。矢印を盤面の内側へ向けよう。', 'The route leaves the board. Turn the arrows back toward the board.'],
    loop: ['同じ道をぐるぐる回っています。出荷口につながる向きへ直そう。', 'The route loops back on itself. Turn the belts toward the shipping machine.'],
  };
  function renderUI() {
    const phase = state.phase;
    root.dataset.phase = phase; root.dataset.rotations = state.tiles.map(tile => tile.rotation).join(',');
    root.dataset.result = phase === 'failed' || phase === 'success' ? state.route?.outcome ?? '' : '';
    root.dataset.selected = state.selected ?? ''; root.dataset.webgl = String(!!view);
    get('title').textContent = tr('コンベア便', 'Parcel Turn');
    get('eyebrow').textContent = tr('01 / 01 · 操作プロトタイプ', '01 / 01 · INTERACTION STUDY');
    get('intro').textContent = tr('タップで90°回転。白い矢印をつないで、箱を出荷口へ。', 'Tap to turn 90°. Connect the white arrows and send your parcel home.');
    get('art-note').textContent = tr('仮形状 · 見た目は調整前', 'PLACEHOLDER GEOMETRY');
    get('in').textContent = tr('入口', 'IN'); get('out').textContent = tr('出荷', 'OUT');
    get('board').setAttribute('aria-label', tr('コンベアのパズル盤面', 'Conveyor puzzle board'));
    get('tiles').setAttribute('aria-label', tr('タップでコンベアを時計回りに90度回転', 'Tap to rotate a conveyor 90 degrees clockwise'));
    get('sound').textContent = tr('音 ', 'Sound ') + (audio.enabled() ? 'ON' : 'OFF');
    get('sound').setAttribute('aria-pressed', String(audio.enabled()));
    get('settings').setAttribute('aria-label', tr('音量設定', 'Volume settings'));
    get('turns').textContent = tr(`回転 ${state.turns} 回`, `${state.turns} turns`);
    get('best').textContent = save.best === null ? tr('まだ出荷なし', 'No delivery yet') : tr(`最少 ${save.best} 回で出荷`, `Best: ${save.best} turns`);
    get('status').textContent = {
      editing: tr('道をつくろう', 'Make a little route'), running: tr('お届け中…', 'On its way…'), paused: tr('ひと休み', 'Delivery paused'),
      failed: tr('ここを直して、もう一度', 'A small turn can fix it'), success: tr('出荷できました！', 'Delivered!'),
    }[phase];
    get('detail').textContent = phase === 'failed' ? tr(...reasons[state.route!.outcome as Exclude<Outcome, 'success'>])
      : phase === 'running' ? tr('移動中は回転できません。リセットで最初に戻せます。', 'Belts are locked during delivery. Reset cancels the run.')
      : phase === 'paused' ? tr('箱は止まっています。「再開」で続きを運びます。', 'Your parcel stays here. Resume when you are ready.')
      : phase === 'success' ? tr('ひとつの箱が、無事に到着。もう一度なら配置を保って遊べます。', 'One parcel, safely home. Play again to keep experimenting with this layout.')
      : state.selected ? tr(`コンベア ${STAGE.tiles.findIndex(tile => tile.id === state.selected) + 1} を回転しました。`, `Conveyor ${STAGE.tiles.findIndex(tile => tile.id === state.selected) + 1} turned clockwise.`)
      : tr('白い短い線が入口。矢印の先が出口です。', 'The short white bar is the inlet. The arrowhead is the outlet.');
    get('reset').textContent = tr('リセット', 'Reset');
    get('play').textContent = phase === 'paused' ? tr('▶ 再開', '▶ Resume') : phase === 'running' ? tr('Ⅱ 一時停止', 'Ⅱ Pause') : phase === 'success' ? tr('もう一度', 'Play again') : phase === 'failed' ? tr('▶ リトライ', '▶ Retry') : tr('▶ 運ぶ', '▶ Play');
    get<HTMLButtonElement>('play').disabled = !view;
    tileButtons.forEach((button, index) => {
      const tile = state.tiles[index], connection = ports(tile);
      const directions = [tr('上', 'top'), tr('右', 'right'), tr('下', 'bottom'), tr('左', 'left')];
      button.setAttribute('aria-label', tr(`コンベア${index + 1}、${tile.kind === 'straight' ? '直線' : '曲がり'}、${directions[connection.input]}から${directions[connection.output]}。押すと時計回りに90度回転`, `Conveyor ${index + 1}, ${tile.kind}, ${directions[connection.input]} to ${directions[connection.output]}. Rotate 90 degrees clockwise`));
      button.setAttribute('aria-pressed', String(state.selected === tile.id));
      button.disabled = !view || !['editing', 'failed'].includes(phase);
    });
    get('rules-title').textContent = tr('遊び方・ルール', 'How it works');
    get('rules-copy').textContent = tr('① コンベアをタップすると時計回りに90度回転。\n② 白い短い線から入り、矢印の先へ進みます。曲がりベルトは右へ90度曲がります。\n③ 「運ぶ」で確認。出荷口の左側に到着すると成功です。\n入口違い・出荷口の向き違い・空白・盤外・循環は失敗。移動中と一時停止中は回転できません。\n失敗後はそのままタップして修正。リセットは箱を止め、初期配置に戻します。\nキーボード：Tabで選択、Enter / Spaceで回転。Escで一時停止。',
      '1. Tap a conveyor to turn it 90° clockwise.\n2. Enter at the short white bar and leave at the arrowhead. A bend turns right by 90°.\n3. Press Play. Reach the left opening of OUT to deliver.\nWrong inlets, wrong exit sides, gaps, board edges and loops stop the parcel. Running and paused belts cannot rotate.\nAfter a failed run, tap to fix the layout. Reset cancels delivery and restores the initial layout.\nKeyboard: Tab to select, Enter / Space to turn. Esc to pause.');
    get('save').textContent = storageOK ? tr('配置と最少回転数は、この端末に自動保存。', 'Layout and best turn count are saved on this device.') : tr('保存できません。このタブ内で引き続き遊べます。', 'Storage is unavailable. You can keep playing in this tab.');
    get('audio-title').textContent = tr('音の設定', 'Audio settings');
    get('volume-label').textContent = tr('効果音の音量', 'Effects volume');
    get<HTMLInputElement>('volume').value = String(Math.round(audio.volume() * 100));
    get('audio-note').textContent = tr('この試作は効果音のみ。音のON / OFFは上のボタンで切り替えます。', 'This prototype uses effects only. Toggle sound with the button above.');
    get('audio-close').textContent = tr('閉じる', 'Close');
    get('unavailable').hidden = !!view; get('tiles').hidden = !view;
    get('unavailable-copy').textContent = tr('3D表示を開始できません。WebGLが使えるブラウザで開き直してください。', '3D is unavailable. Reopen in a browser with WebGL enabled.');
    get('reload').textContent = tr('再読み込み', 'Reload');
    dirty = true; root.dataset.renderPending = 'true';
  }
  get('play').addEventListener('click', () => dispatch({ type: state.phase === 'running' ? 'pause' : state.phase === 'paused' ? 'resume' : state.phase === 'success' ? 'retry' : 'play' }));
  get('reset').addEventListener('click', () => dispatch({ type: 'reset' }));
  get('sound').addEventListener('click', () => audio.toggle());
  get('settings').addEventListener('click', () => { dispatch({ type: 'pause' }); audio.stop(); audioDialog.showModal(); });
  get('audio-close').addEventListener('click', () => audioDialog.close());
  audioDialog.addEventListener('close', () => get('settings').focus({ preventScroll: true }));
  get('volume').addEventListener('input', e => audio.setVolume(Number((e.target as HTMLInputElement).value) / 100));
  get('reload').addEventListener('click', () => location.reload());
  function pause() { dispatch({ type: 'pause' }); previous = 0; audio.stop(); }
  document.addEventListener('visibilitychange', () => { if (document.hidden) pause(); });
  window.addEventListener('blur', pause);
  window.addEventListener('keydown', event => { if (event.code === 'Escape' && !audioDialog.open) dispatch({ type: 'pause' }); });
  window.addEventListener(LANGUAGE_EVENT, renderUI);
  get('canvas').addEventListener('webglcontextlost', event => {
    event.preventDefault(); pause(); view?.dispose(); view = null; renderUI();
  });
  function layout() {
    if (!view) return;
    view.resize();
    tileButtons.forEach((button, index) => { const p = view!.project(STAGE.tiles[index]); button.style.left = `${p.x}px`; button.style.top = `${p.y}px`; });
    for (const [id, cell] of [['in', STAGE.source], ['out', STAGE.exit]] as const) {
      const p = view.project(cell, .51); get(id).style.left = `${p.x}px`; get(id).style.top = `${p.y}px`;
    }
    dirty = true; root.dataset.renderPending = 'true';
  }
  const resize = new ResizeObserver(layout); resize.observe(get('board'));
  function frame(now: number) {
    if (disposed) return;
    const delta = previous ? Math.min(.1, Math.max(0, (now - previous) / 1000)) : 0; previous = now;
    if (!document.hidden && !audioDialog.open && view) {
      if (state.phase === 'running' && motion) {
        elapsed = Math.min(motion.duration, elapsed + delta); dirty = true;
        if (elapsed >= motion.duration) dispatch({ type: 'finish' });
      }
      if (dirty && now - lastDraw >= 1000 / 30) {
        const started = performance.now();
        view.draw(state, motion ? sampleMotion(motion, elapsed) : STAGE.source);
        root.dataset.drawCalls = String(view.renderer.info.render.calls); root.dataset.triangles = String(view.renderer.info.render.triangles);
        root.dataset.frames = String(Number(root.dataset.frames ?? 0) + 1);
        root.dataset.renderMs = (performance.now() - started).toFixed(2); root.dataset.elapsed = elapsed.toFixed(3);
        dirty = false; root.dataset.renderPending = 'false';
        lastDraw = now - ((now - lastDraw) % (1000 / 30));
      }
    }
    raf = requestAnimationFrame(frame);
  }
  window.addEventListener('pagehide', event => {
    pause();
    if (!event.persisted) { disposed = true; cancelAnimationFrame(raf); resize.disconnect(); view?.dispose(); audio.dispose(); window.removeEventListener(LANGUAGE_EVENT, renderUI); }
  });
  renderUI(); layout(); raf = requestAnimationFrame(frame);
}
