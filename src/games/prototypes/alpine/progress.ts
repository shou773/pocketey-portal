import { COURSES, courseAt, parseSave, type State } from './model';

export const CAMPAIGN_KEY = 'pocketey-alpine-campaign-v2';
export interface Record { clears: number; best: number | null }
export interface Progress { version: 2; records: Record[]; muted: boolean }
const count = (value: unknown) => Number.isSafeInteger(value) && Number(value) >= 0 ? Math.min(Number(value), 999999) : null;
const score = (value: unknown) => Number.isInteger(value) && Number(value) >= 0 && Number(value) <= 100 ? Number(value) : null;
export function parseProgress(raw: string | null, legacy: string | null) {
  const old = parseSave(legacy);
  const save: Progress = { version: 2, muted: old.muted,
    records: COURSES.map((_, i) => ({ clears: i === 0 ? old.clears : 0, best: null })) };
  let writable = true;
  try {
    const value = JSON.parse(raw || 'null');
    if (Number.isFinite(value?.version) && value.version > 2) writable = false;
    if (value?.version !== 2 || !value.records || typeof value.records !== 'object' || Array.isArray(value.records)) return { save, writable };
    if (typeof value.muted === 'boolean') save.muted = value.muted;
    COURSES.forEach((course, i) => {
      const record = value.records[course.id];
      if (!record || typeof record !== 'object') return;
      save.records[i] = { clears: Math.max(save.records[i].clears, count(record.clears) ?? 0), best: score(record.best) };
      if (save.records[i].clears === 0) save.records[i].best = null;
    });
  } catch { /* Keep the untouched legacy backup on malformed storage. */ }
  return { save, writable };
}
export function serializeProgress(save: Progress) {
  return JSON.stringify({ version: 2, muted: save.muted,
    records: Object.fromEntries(COURSES.map((course, i) => [course.id, save.records[i]])) });
}
/** Preserve better records from another tab; the caller owns the current mute choice. */
export function mergeRecords(save: Progress, stored: Progress) {
  save.records.forEach((record, i) => {
    record.clears = Math.max(record.clears, stored.records[i].clears);
    const best = stored.records[i].best;
    if (best !== null) record.best = Math.max(record.best ?? 0, best);
  });
}
export function unlocked(save: Progress, index: number) {
  return Number.isInteger(index) && index >= 0 && index < COURSES.length && (index === 0 || save.records[index - 1].clears > 0 || save.records[index].clears > 0);
}
export function precision(s: State) { return Math.round(100 * s.precise / courseAt(s.course).gates.length); }
export function recordClear(save: Progress, state: State) {
  if (state.phase !== 'clear' || state.recorded) return false;
  state.recorded = true;
  const record = save.records[state.course];
  record.clears = Math.min(999999, record.clears + 1);
  record.best = Math.max(record.best ?? 0, precision(state));
  return true;
}
