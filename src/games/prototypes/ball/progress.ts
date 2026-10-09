import { STAGES, parseSave } from './model';
/** Stable identities keep saved records independent of menu positions. The first
 * three IDs correspond exactly to the unchanged legacy course data. */
export const STAGE_IDS = ['first-bends', 'wave-corridor', 'sky-ridge', 'breathing-bends', 'double-apex'] as const;
export const ORIGINAL_COURSE_COUNT = 3;
export const PROGRESS_KEY = 'pocketey-tilttrail-campaign-v2';
export interface Progress { best: (number | null)[]; muted: boolean; writable: boolean }
const validTime = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value) && value > 0;
export function parseProgress(raw: string | null, legacyRaw: string | null = null): Progress {
  const progress: Progress = { best: STAGES.map(() => null), muted: true, writable: true };
  try {
    const legacy = JSON.parse(legacyRaw ?? 'null');
    if (legacy && (legacy.version === undefined || legacy.version === 1)) {
      const saved = parseSave(legacyRaw); progress.best.splice(0, ORIGINAL_COURSE_COUNT, ...saved.best); progress.muted = saved.muted;
    }
  } catch { /* Invalid old data is never written back. */ }
  try {
    const value = JSON.parse(raw ?? 'null');
    if (!value || typeof value !== 'object' || Array.isArray(value)) return progress;
    if (Number.isSafeInteger(value.version) && value.version > 2) { progress.writable = false; return progress; }
    if (value.version !== 2 || !value.records || typeof value.records !== 'object' || Array.isArray(value.records)) return progress;
    progress.best = STAGE_IDS.map((id, i) => {
      const valueAtId = value.records[id], legacyBest = progress.best[i];
      // No reset operation exists for these records. Keep the valid old-course
      // backup if one v2 entry is missing/corrupt, and never lose a faster best.
      return validTime(valueAtId) ? Math.min(legacyBest ?? Infinity, valueAtId) : legacyBest;
    });
    progress.muted = value.muted !== false;
  } catch { /* Invalid new data can recover from the untouched old backup. */ }
  return progress;
}
export function serializeProgress(progress: Progress) {
  return JSON.stringify({ version: 2, records: Object.fromEntries(STAGE_IDS.map((id, i) => [id, validTime(progress.best[i]) ? progress.best[i] : null])), muted: progress.muted });
}
export function stageUnlocked(progress: Progress, stage: number) {
  return Number.isInteger(stage) && stage >= 0 && stage < STAGES.length && (stage < ORIGINAL_COURSE_COUNT || progress.best[stage - 1] != null);
}
