import { STAGES, parseSave } from './model';
/** Stable identities preserve the five accepted courses and their read-only backups. */
export const STAGE_IDS = ['first-bends', 'wave-corridor', 'sky-ridge', 'breathing-bends', 'double-apex', 'neck-corridors'] as const;
export const ORIGINAL_COURSE_COUNT = 3;
export const PREVIOUS_COURSE_COUNT = 5;
export const PREVIOUS_PROGRESS_KEY = 'pocketey-tilttrail-campaign-v2';
export const PROGRESS_KEY = 'pocketey-tilttrail-campaign-v3';
export const PROGRESS_VERSION = 3;
export interface Progress { best: (number | null)[]; muted: boolean; writable: boolean }
const validTime = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value) && value > 0;
export function parseProgress(raw: string | null, legacyRaw: string | null = null, previousRaw: string | null = null): Progress {
  const progress: Progress = { best: STAGES.map(() => null), muted: true, writable: true };
  const read = (text: string | null) => { try { return JSON.parse(text ?? 'null'); } catch { return null; } };
  const legacy = read(legacyRaw);
  if (legacy && (legacy.version === undefined || legacy.version === 1)) {
    const saved = parseSave(legacyRaw); progress.best.splice(0, ORIGINAL_COURSE_COUNT, ...saved.best); progress.muted = saved.muted;
  }
  function apply(value: any, count: number) {
    if (!value?.records || typeof value.records !== 'object' || Array.isArray(value.records)) return;
    for (let i = 0; i < count; i++) {
      const n = value.records[STAGE_IDS[i]];
      // No reset exists: retain a faster valid record from either untouched backup.
      if (validTime(n)) progress.best[i] = Math.min(progress.best[i] ?? Infinity, n);
    }
    if (typeof value.muted === 'boolean') progress.muted = value.muted;
  }
  const previous = read(previousRaw);
  if (previous?.version === 2) apply(previous, PREVIOUS_COURSE_COUNT);
  const value = read(raw);
  if (!value || typeof value !== 'object' || Array.isArray(value)) return progress;
  if (Number.isSafeInteger(value.version) && value.version > PROGRESS_VERSION) { progress.writable = false; return progress; }
  if (value.version === 2) apply(value, PREVIOUS_COURSE_COUNT);
  else if (value.version === PROGRESS_VERSION) apply(value, STAGE_IDS.length);
  return progress;
}
export function serializeProgress(progress: Progress) {
  return JSON.stringify({ version: PROGRESS_VERSION, records: Object.fromEntries(STAGE_IDS.map((id, i) => [id, validTime(progress.best[i]) ? progress.best[i] : null])), muted: progress.muted });
}
/** Caller rereads storage immediately before writing; local mute choice remains intentional. */
export function mergeProgress(progress: Progress, stored: Progress) {
  if (!stored.writable) { progress.writable = false; return; }
  progress.best.forEach((best, i) => { if (validTime(stored.best[i])) progress.best[i] = Math.min(best ?? Infinity, stored.best[i]!); });
}
export function stageUnlocked(progress: Progress, stage: number) {
  return Number.isInteger(stage) && stage >= 0 && stage < STAGES.length && (stage < ORIGINAL_COURSE_COUNT || progress.best[stage - 1] != null);
}
