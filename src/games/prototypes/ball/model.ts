export const STEP = 1 / 120;
export const RADIUS = 0.38;
export const SAVE_KEY = 'pocketey-tilttrail-v1';
export type Phase = 'ready' | 'playing' | 'paused' | 'falling' | 'failed' | 'clear';
export interface Knot { z: number; x: number; width: number }
export interface Stage { name: [string, string]; hint: [string, string]; knots: Knot[] }
export const STAGES: Stage[] = [
  { name: ['はじめの曲がり道', 'First bends'], hint: ['先を見て、曲がる前に減速。', 'Look ahead. Brake before each bend.'], knots: [
    { z: 0, x: 0, width: 5 }, { z: 10, x: 0, width: 5 }, { z: 25, x: -2, width: 4.6 },
    { z: 40, x: 2, width: 4.4 }, { z: 55, x: -1.5, width: 4.2 }, { z: 70, x: 0, width: 5 }, { z: 80, x: 0, width: 5 },
  ] },
  { name: ['波の回廊', 'Wave corridor'], hint: ['切り返しは早めに。逆方向で慣性を止めよう。', 'Counter-steer early to catch your momentum.'], knots: [
    { z: 0, x: 0, width: 4.6 }, { z: 8, x: 0, width: 4.6 }, { z: 23, x: 3.5, width: 3.6 },
    { z: 40, x: -3.5, width: 3.4 }, { z: 57, x: 3.5, width: 3.2 }, { z: 74, x: -3, width: 3.2 },
    { z: 91, x: 1.8, width: 3.6 }, { z: 104, x: 0, width: 4.8 }, { z: 112, x: 0, width: 4.8 },
  ] },
  { name: ['空の尾根', 'Sky ridge'], hint: ['細い尾根ではブレーキ。広い場所で速度を取り戻そう。', 'Brake on narrow ridges. Release on wide stretches.'], knots: [
    { z: 0, x: 0, width: 4.4 }, { z: 8, x: 0, width: 4.4 }, { z: 22, x: -3.8, width: 2.8 },
    { z: 36, x: 3.8, width: 2.6 }, { z: 51, x: -3.5, width: 2.5 }, { z: 66, x: 3.8, width: 2.5 },
    { z: 81, x: -3.5, width: 2.4 }, { z: 96, x: 3.2, width: 2.6 }, { z: 111, x: 0, width: 3.8 }, { z: 122, x: 0, width: 4.8 },
  ] },
  { name: ["息つぎのカーブ", "Breathing bends"], hint: ["曲がる前に減速。広い直線ではブレーキを離そう。", "Brake before bends. Release on wide straights."], knots: [
    { z: 0, x: 0, width: 4.8 },
    { z: 10, x: 0, width: 4.8 },
    { z: 22, x: 3, width: 3.4 },
    { z: 30, x: 3, width: 4.8 },
    { z: 42, x: -3, width: 3.2 },
    { z: 50, x: -3, width: 4.8 },
    { z: 62, x: 2.8, width: 3.1 },
    { z: 70, x: 2.8, width: 4.8 },
    { z: 84, x: 0, width: 4.8 },
    { z: 94, x: 0, width: 4.8 },
  ] },
  { name: ["ふたつの頂点", "Double apex"], hint: ["一度曲がっても油断しないで。短い切り返しのあと、もう一度。", "Hold your line through paired bends, then catch the next reversal."], knots: [
    { z: 0, x: 0, width: 4.4 },
    { z: 8, x: 0, width: 4.4 },
    { z: 19, x: -3.2, width: 2.9 },
    { z: 26, x: -1.7, width: 3.7 },
    { z: 34, x: -3.7, width: 2.6 },
    { z: 47, x: 3.6, width: 2.6 },
    { z: 55, x: 1.8, width: 3.6 },
    { z: 63, x: 3.8, width: 2.5 },
    { z: 76, x: -3.2, width: 2.6 },
    { z: 84, x: -1.5, width: 3.6 },
    { z: 92, x: -3.8, width: 2.5 },
    { z: 107, x: 0, width: 3.9 },
    { z: 116, x: 0, width: 4.8 },
  ] },
  // Begin course 6: wide turn, straight neck, recovery.
  { name: ["細道の入口", "Narrow passages"], hint: ["急カーブの前に減速。細道では向きを整えてからブレーキを離そう。", "Brake before the tight turn. Straighten up at the neck, then release."], knots: [
    { z: 0, x: 0, width: 4.8 },
    { z: 8, x: 0, width: 4.8 },
    { z: 20, x: 3.2, width: 4.8 },
    { z: 23, x: 3.2, width: 2.6 },
    { z: 31, x: 3.2, width: 2.6 },
    { z: 38, x: 3.2, width: 5 },
    { z: 46, x: -3.2, width: 2.4 },
    { z: 54, x: -3.2, width: 2.4 },
    { z: 61, x: -3.2, width: 5 },
    { z: 78, x: 0, width: 4.8 },
    { z: 94, x: 0, width: 5 },
  ] },
  // End course 6.
];
export function length(stage: number) { return STAGES[stage].knots.at(-1)!.z; }
export function track(stage: number, z: number) {
  const knots = STAGES[stage].knots;
  const index = knots.findIndex(k => k.z >= z);
  if (index <= 0) return index === -1 ? knots.at(-1)! : knots[0];
  const a = knots[index - 1], b = knots[index];
  const t = Math.max(0, Math.min(1, (z - a.z) / (b.z - a.z)));
  const smooth = t * t * (3 - 2 * t);
  return { z, x: a.x + (b.x - a.x) * smooth, width: a.width + (b.width - a.width) * smooth };
}
export interface State { stage: number; phase: Phase; x: number; z: number; y: number; vx: number; speed: number; vy: number; time: number; fallTime: number }
export interface Input { steer: number; brake: boolean }
export function createState(stage = 0): State {
  return { stage: Math.max(0, Math.min(STAGES.length - 1, Number.isFinite(stage) ? Math.floor(stage) : 0)), phase: 'ready', x: 0, z: 0, y: RADIUS, vx: 0, speed: 0, vy: 0, time: 0, fallTime: 0 };
}
export function supported(s: State) {
  const road = track(s.stage, s.z);
  return Math.abs(s.x - road.x) <= road.width / 2 - RADIUS * 0.35;
}
export function advance(s: State, input: Input, dt = STEP) {
  if (s.phase === 'falling') {
    s.fallTime += dt; s.vy -= 19 * dt; s.y += s.vy * dt;
    s.x += s.vx * dt; s.z += s.speed * dt;
    if (s.fallTime >= 0.7) s.phase = 'failed';
    return;
  }
  if (s.phase !== 'playing') return;
  s.time += dt;
  const target = input.brake ? 2.15 : 5.8;
  s.speed += (target - s.speed) * (1 - Math.exp(-3.5 * dt));
  const steer = Math.max(-1, Math.min(1, input.steer));
  // An exponential drag gives the same predictable inertia at every render rate.
  s.vx = s.vx * Math.exp(-2.8 * dt) + steer * 13 * (1 - Math.exp(-2.8 * dt)) / 2.8;
  s.x += s.vx * dt; s.z += s.speed * dt;
  // Check support before the finish so crossing the line off the road never clears.
  if (!supported(s)) { s.phase = 'falling'; return; }
  if (s.z >= length(s.stage)) { s.z = length(s.stage); s.phase = 'clear'; s.speed = 0; s.vx = 0; }
}
export interface Save { best: (number | null)[]; muted: boolean }
export function parseSave(raw: string | null): Save {
  const empty = { best: [null, null, null], muted: true };
  try {
    const parsed = JSON.parse(raw || 'null');
    if (!parsed || !Array.isArray(parsed.best)) return empty;
    return { best: [0, 1, 2].map(i => typeof parsed.best[i] === 'number' && Number.isFinite(parsed.best[i]) && parsed.best[i] > 0 ? parsed.best[i] : null), muted: parsed.muted !== false };
  } catch { return empty; }
}

