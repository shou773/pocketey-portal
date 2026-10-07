export type Kind = 'orbit' | 'amber';
export type Platform = { a: number; b: number; y: number; z: number; w: number };
export type Hazard = { x: number; z: number; w: number; d: number; y: number; h: number };
export type Stage = { name: string; hint: string; length: number; platforms: Platform[]; hazards: Hazard[] };
const p = (a: number, b: number, y = 0, z = 0, w = 7): Platform => ({ a, b, y, z, w });
const h = (x: number, z = 0, w = 2, d = 1, y = 0, height = 2.8): Hazard => ({ x, z, w, d, y, h: height });
export const stages: Record<Kind, Stage[]> = {
  orbit: [
    { name: 'はじめの軌道', hint: '光るふちがジャンプの合図。すき間を飛び越えよう。', length: 91, platforms: [p(-5, 19), p(21, 40), p(42.2, 63), p(65.4, 98)], hazards: [] },
    { name: 'すれ違う光', hint: '高い柱は左右によける。すき間はジャンプ。', length: 106, platforms: [p(-5, 26), p(28.2, 56), p(58.5, 82), p(84.8, 114)], hazards: [h(15, 0), h(42, -1.7, 3), h(70, 1.7, 3), h(96, 0)] },
    { name: '星をつなぐ道', hint: '柱をよけたら、道の中央へ。最後までリズムよく。', length: 119, platforms: [p(-5, 22), p(24.5, 45), p(47.7, 70), p(72.6, 94), p(96.8, 127)], hazards: [h(13, 0), h(35, 1.6, 3.2), h(59, -1.6, 3.2), h(83, 0), h(108, 1.6, 3.2)] }
  ],
  amber: [
    { name: '小さな一歩', hint: '右へ進んで、すき間の手前でジャンプ。', length: 39, platforms: [p(-5, 8), p(10, 18), p(20.2, 29), p(31.3, 44)], hazards: [] },
    { name: '空中の階段', hint: '少し高い足場へ。着地してから、次のジャンプ。', length: 43, platforms: [p(-5, 7), p(8.7, 15, .6), p(17, 24, 1.2), p(26, 33, .6), p(35.2, 49)], hazards: [] },
    { name: '琥珀の庭', hint: '赤いトゲはジャンプ。あせらず足場を確かめよう。', length: 49, platforms: [p(-5, 9), p(11, 20, .5), p(22.2, 31, 1), p(33.1, 40, .4), p(42.3, 55)], hazards: [h(5, 0, 4, .75, 0, .65), h(16, 0, 4, .75, .5, .65), h(27, 0, 4, .75, 1, .65), h(46.5, 0, 4, .75, 0, .65)] }
  ]
};
export type State = { kind: Kind; stage: number; x: number; z: number; y: number; vy: number; time: number; grounded: boolean; coyote: number; buffer: number; status: 'running' | 'dead' | 'clear'; jumps: number };
export type Input = { axis: number; jump: boolean };
export const DT = 1 / 120;
export function createState(kind: Kind, stage: number): State {
  return { kind, stage, x: 0, z: 0, y: 0, vy: 0, time: 0, grounded: true, coyote: .1, buffer: 0, status: 'running', jumps: 0 };
}
export function step(s: State, input: Input, dt = DT) {
  if (s.status !== 'running') return;
  const level = stages[s.kind][s.stage];
  s.time += dt;
  s.buffer = input.jump ? .13 : Math.max(0, s.buffer - dt);
  s.coyote = s.grounded ? .1 : Math.max(0, s.coyote - dt);
  if (s.buffer > 0 && s.coyote > 0) { s.vy = 8.8; s.grounded = false; s.coyote = 0; s.buffer = 0; s.jumps++; }
  const oldY = s.y;
  const axis = Math.max(-1, Math.min(1, input.axis));
  s.x += (s.kind === 'orbit' ? 7 : axis * 5) * dt;
  if (s.kind === 'orbit') s.z += axis * 5 * dt;
  s.x = Math.max(-3, s.x);
  s.vy -= 22 * dt; s.y += s.vy * dt; s.grounded = false;
  for (const tile of level.platforms) {
    if (s.x + .22 > tile.a && s.x - .22 < tile.b && Math.abs(s.z - tile.z) < tile.w / 2 + .18) {
      if (s.vy <= 0 && oldY >= tile.y - .01 && s.y <= tile.y) { s.y = tile.y; s.vy = 0; s.grounded = true; }
      // Solid risers prevent walking through the side of raised platforms.
      if (s.y + .64 > tile.y - .65 && s.y < tile.y - .02 && s.x < tile.a + .3 && axis > 0 && s.kind === 'amber') s.x = tile.a - .23;
    }
  }
  for (const hazard of level.hazards) {
    if (Math.abs(s.x - hazard.x) < hazard.d / 2 + .2 && Math.abs(s.z - hazard.z) < hazard.w / 2 + .2 && s.y < hazard.y + hazard.h - .07 && s.y + .65 > hazard.y + .08) s.status = 'dead';
  }
  if (s.y < -4) s.status = 'dead';
  if (s.status === 'running' && s.x >= level.length && s.grounded) s.status = 'clear';
}
export type Save = { version: 1; sound: boolean; orbit: { unlocked: number; best: (number | null)[] }; amber: { unlocked: number; best: (number | null)[] } };
export const SAVE_KEY = 'pocketey-orbit-amber-v1';
export function cleanSave(raw: unknown): Save {
  const out: Save = { version: 1, sound: false, orbit: { unlocked: 1, best: [null, null, null] }, amber: { unlocked: 1, best: [null, null, null] } };
  if (!raw || typeof raw !== 'object') return out;
  const obj = raw as Partial<Save>;
  out.sound = obj.sound === true;
  for (const kind of ['orbit', 'amber'] as const) {
    const data = obj[kind];
    if (!data || typeof data !== 'object') continue;
    out[kind].unlocked = Number.isInteger(data.unlocked) ? Math.max(1, Math.min(3, data.unlocked)) : 1;
    out[kind].best = [0, 1, 2].map(i => { const n = data.best?.[i]; return typeof n === 'number' && Number.isFinite(n) && n > 0 && n < 3600 ? n : null; });
  }
  return out;
}
