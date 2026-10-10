import { cleanSave } from './model';
/** Separate key prevents older three-stage tabs from dropping the new record. */
export const AMBER_CAMPAIGN_KEY = 'pocketey-amber-campaign-v1';
export const AMBER_IDS = ['small-step', 'sky-steps', 'amber-garden', 'landing-beats'] as const;
export interface AmberCampaign { unlocked: number; best: (number | null)[]; challengeBest: (number | null)[]; sound: boolean; writable: boolean }
const time = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value) && value > 0 && value < 3600;
const read = (raw: string | null) => { try { return JSON.parse(raw ?? 'null'); } catch { return null; } };
function deriveUnlock(progress: AmberCampaign) {
  // Old unlocked=3 means access to3, not completion. Historical layouts never unlock4.
  let unlocked = Math.max(1, Math.min(3, progress.unlocked));
  progress.challengeBest.forEach((n, i) => { if (time(n)) unlocked = Math.max(unlocked, Math.min(AMBER_IDS.length, i + 2)); });
  progress.unlocked = unlocked;
}
export function parseAmberCampaign(raw: string | null, legacyRaw: string | null = null): AmberCampaign {
  const result: AmberCampaign = { unlocked: 1, best: AMBER_IDS.map(() => null), challengeBest: AMBER_IDS.map(() => null), sound: false, writable: true };
  const legacy = read(legacyRaw);
  if (legacy && (legacy.version === undefined || legacy.version === 1)) {
    const old = cleanSave(legacy); result.unlocked = old.amber.unlocked; result.sound = old.sound;
    result.best.splice(0, 3, ...old.amber.best); result.challengeBest.splice(0, 3, ...old.amber.challengeBest);
  }
  const value = read(raw);
  if (value && Number.isSafeInteger(value.version) && value.version > 1) result.writable = false;
  else if (value?.version === 1 && value.records && typeof value.records === 'object' && !Array.isArray(value.records)) {
    for (const [i, id] of AMBER_IDS.entries()) {
      const record = value.records[id];
      for (const field of ['best', 'challengeBest'] as const) if (time(record?.[field])) result[field][i] = Math.min(result[field][i] ?? Infinity, record[field]);
    }
    if (Number.isInteger(value.unlocked)) result.unlocked = Math.max(result.unlocked, Math.max(1, Math.min(3, value.unlocked)));
    if (typeof value.sound === 'boolean') result.sound = value.sound;
  }
  deriveUnlock(result); return result;
}
export function mergeAmberCampaign(current: AmberCampaign, latest: AmberCampaign) {
  if (!latest.writable) { current.writable = false; return; }
  for (const field of ['best', 'challengeBest'] as const) AMBER_IDS.forEach((_, i) => {
    if (time(latest[field][i])) current[field][i] = Math.min(current[field][i] ?? Infinity, latest[field][i]!);
  });
  current.unlocked = Math.max(current.unlocked, latest.unlocked); deriveUnlock(current);
}
export function serializeAmberCampaign(progress: AmberCampaign) {
  return JSON.stringify({ version: 1, unlocked: progress.unlocked, sound: progress.sound,
    records: Object.fromEntries(AMBER_IDS.map((id, i) => [id, { best: time(progress.best[i]) ? progress.best[i] : null, challengeBest: time(progress.challengeBest[i]) ? progress.challengeBest[i] : null }])) });
}
