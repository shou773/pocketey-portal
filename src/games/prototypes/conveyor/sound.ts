import { MASTER_GAIN, effectsLevel } from '../../audio-mix';

// Reuse Pocketey's sample assets, gain limits and storage envelope. This prototype
// owns only the new `conveyor` entry and never writes another game's preferences.
const AUDIO_KEY = 'pocketey-audio-v1';
export function createSound(onChange: () => void) {
  let muted = true, volume = .8;
  try {
    const saved = JSON.parse(localStorage.getItem(AUDIO_KEY) ?? '{}').conveyor;
    if (typeof saved?.sfxMuted === 'boolean') muted = saved.sfxMuted;
    if (typeof saved?.sfx === 'number' && Number.isFinite(saved.sfx)) volume = Math.max(0, Math.min(1, saved.sfx));
  } catch { /* Optional storage. */ }
  const samples = new Map<string, HTMLAudioElement>();
  function stop() { samples.forEach(sample => { sample.pause(); sample.currentTime = 0; }); }
  function persist() {
    try {
      let all = JSON.parse(localStorage.getItem(AUDIO_KEY) ?? '{}');
      if (!all || typeof all !== 'object' || Array.isArray(all)) all = {};
      all.conveyor = { sfx: volume, sfxMuted: muted };
      localStorage.setItem(AUDIO_KEY, JSON.stringify(all));
    } catch { /* Audio remains usable without persistence. */ }
    onChange();
  }
  function cue(kind: 'select' | 'start' | 'fail' | 'success') {
    if (muted || document.hidden) return;
    const name = kind === 'success' ? 'clear' : kind === 'fail' ? 'warning' : 'click';
    let sample = samples.get(name);
    if (!sample) { sample = new Audio(`/games/audio/${name}.wav`); sample.preload = 'none'; samples.set(name, sample); }
    stop();
    sample.volume = Math.min(1, MASTER_GAIN * effectsLevel('orbit', volume, muted, 1));
    void sample.play().catch(() => { /* Device policies or unavailable sound never interrupt the puzzle. */ });
  }
  return {
    cue, stop, enabled: () => !muted, volume: () => volume,
    toggle() { muted = !muted; stop(); persist(); if (!muted) cue('select'); },
    setVolume(value: number) { volume = Math.max(0, Math.min(1, value)); persist(); },
    dispose() { stop(); samples.forEach(sample => { sample.removeAttribute('src'); sample.load(); }); samples.clear(); },
  };
}
