import type { State } from './model';

/** Optional surface routes. Clear conditions, speed and collision geometry stay
 * in the original model; this module only observes a run. */
export const SIGNAL_COURSE_IDS = ['first-orbit', 'crossing-lights', 'starbound-path'] as const;
export const SIGNALS = [
  [{ x: 14, z: 2.9 }, { x: 44, z: -2.9 }, { x: 87, z: 2.9 }],
  [{ x: 14, z: 2.9 }, { x: 64, z: 2.9 }, { x: 117, z: -2.9 }],
  [{ x: 14, z: 2.9 }, { x: 65, z: -2.9 }, { x: 122, z: -2.9 }],
] as const;
export const SIGNAL_HEIGHT = .75;
export const SIGNAL_RADIUS = .6;
export const SIGNAL_SAVE_KEY = 'pocketey-orbit-signals-v1';
export interface SignalRun { stage: number; mask: number; completed: boolean }
export interface SignalProgress { best: (number | null)[]; writable: boolean }
export const createSignalRun = (stage: number): SignalRun => ({ stage, mask: 0, completed: false });
export const signalCount = (run: SignalRun) => Number(!!(run.mask & 1)) + Number(!!(run.mask & 2)) + Number(!!(run.mask & 4));
export function collectSignals(run: SignalRun, state: State) {
  if (run.completed || state.kind !== 'orbit' || state.status !== 'running' || state.stage !== run.stage) return 0;
  const before = signalCount(run);
  SIGNALS[run.stage]?.forEach((signal, i) => {
    const dx = signal.x - state.x, dz = signal.z - state.z;
    if (dx * dx + dz * dz <= SIGNAL_RADIUS * SIGNAL_RADIUS && Math.abs(state.y + .35 - SIGNAL_HEIGHT) <= .7) run.mask |= 1 << i;
  });
  return signalCount(run) - before;
}
export function recordSignalClear(progress: SignalProgress, run: SignalRun, state: State) {
  if (run.completed || state.kind !== 'orbit' || state.status !== 'clear' || state.stage !== run.stage || !SIGNALS[run.stage]) return false;
  run.completed = true;
  progress.best[run.stage] = Math.max(progress.best[run.stage] ?? 0, signalCount(run));
  return true;
}
export function parseSignalProgress(raw: string | null): SignalProgress {
  const result: SignalProgress = { best: SIGNALS.map(() => null), writable: true };
  try {
    const value = JSON.parse(raw ?? 'null');
    if (!value || typeof value !== 'object' || Array.isArray(value)) return result;
    if (Number.isSafeInteger(value.version) && value.version > 1) { result.writable = false; return result; }
    if (value.version !== 1 || !value.records || typeof value.records !== 'object' || Array.isArray(value.records)) return result;
    result.best = SIGNAL_COURSE_IDS.map(id => {
      const n = value.records[id]; return Number.isInteger(n) && n >= 0 && n <= 3 ? n : null;
    });
  } catch { /* Damaged optional records never affect the original game save. */ }
  return result;
}
export function serializeSignalProgress(progress: SignalProgress) {
  return JSON.stringify({ version: 1, records: Object.fromEntries(SIGNAL_COURSE_IDS.map((id, i) => [id, progress.best[i] ?? null])) });
}
