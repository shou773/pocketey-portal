export type Kind = 'orbit' | 'amber';
export type Platform = { a: number; b: number; y: number; z: number; w: number };
export type Hazard = { x: number; z: number; w: number; d: number; y: number; h: number };
export type Stage = { name: string; hint: string; length: number; platforms: Platform[]; hazards: Hazard[] };
const p = (a: number, b: number, y = 0, z = 0, w = 7): Platform => ({ a, b, y, z, w });
const h = (x: number, z = 0, w = 2, d = 1, y = 0, height = 2.8): Hazard => ({ x, z, w, d, y, h: height });
export const stages: Record<Kind, Stage[]> = {
  orbit: [
    { name: 'はじめの軌道', hint: '柱は左右へ。光るふちではジャンプ。次の危険を見よう。', length: 104, platforms: [p(-5,24),p(26.8,49),p(52,76),p(79.2,111)], hazards: [h(16,0),h(35,-1.6,3.8),h(44,0),h(62,1.6,3.8),h(70,0),h(87,-1.6,3.8),h(97,0)] },
    { name: 'すれ違う光', hint: '左右の柱を続けて回避。着地したら次のジャンプに備えよう。', length: 125, platforms: [p(-5,25),p(28.2,50),p(53.6,77),p(80.8,104),p(107.9,133)], hazards: [h(16,0,2.6),h(36,-1.6,3.8),h(45,1.6,3.8),h(64,-1.6,3.8),h(73,1.6,3.8),h(91,-1.6,3.8),h(100,1.6,3.8),h(117,0,2.6)] },
    { name: '星をつなぐ道', hint: '左右の切り返しと長いすき間。先を見て、ふちの近くでジャンプ。', length: 150, platforms: [p(-5,26),p(30,53),p(57.1,80),p(84.2,109),p(113.2,137),p(141.3,158)], hazards: [h(14,0,2.6),h(22,-1.6,3.8),h(39,1.6,3.8),h(47,-1.6,3.8),h(65,1.6,3.8),h(73,-1.6,3.8),h(94,1.6,3.8),h(102,-1.6,3.8),h(122,1.6,3.8),h(130,-1.6,3.8),h(147,1.6,3.8)] }
  ],
  amber: [
    { name: '小さな一歩', hint: 'トゲとすき間はジャンプ。着地してから次へ。止まって考えてもOK。', length: 52, platforms: [p(-5,10),p(12.2,21),p(23.4,32,.45),p(34.6,43,.45),p(45.2,58)], hazards: [h(4,0,4,.9,0,.65),h(16.5,0,4,.9,0,.65),h(27.7,0,4,.9,.45,.65),h(39,0,4,.9,.45,.65),h(50,0,4,.9,0,.65)] },
    { name: '空中の階段', hint: '高低差とトゲを続けて越えよう。着地先を見て、飛ぶ場所を選ぼう。', length: 62, platforms: [p(-5,8),p(10.1,18,.6),p(20.4,29,1.2),p(31.4,40,.5),p(42.2,51,1.1),p(53.4,69,.2)], hazards: [h(4,0,4,.9,0,.65),h(14.5,0,4,.9,.6,.65),h(24.2,0,4,.9,1.2,.65),h(35.8,0,4,.9,.5,.65),h(46.8,0,4,.9,1.1,.65),h(60,0,4,.9,.2,.65)] },
    { name: '琥珀の庭', hint: 'ふちのトゲは、次の足場までまとめてジャンプ。上りと下りで間合いを変えよう。', length: 85, platforms: [p(-5,10),p(12.3,20,.7),p(22.1,30),p(32.4,41,.7),p(43.2,52,.1),p(54.6,64,.8),p(66.2,76,.2),p(78.4,92,.8)], hazards: [h(5,0,4,.85,0,.65),h(19.4,0,4,.85,.7,.65),h(26.2,0,4,.85,0,.65),h(40.4,0,4,.85,.7,.65),h(48,0,4,.85,.1,.65),h(63.4,0,4,.85,.8,.65),h(71.5,0,4,.85,.2,.65),h(84,0,4,.85,.8,.65)] }
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
export type Save = { version: 1; sound: boolean; orbit: { unlocked: number; best: (number | null)[]; challengeBest: (number | null)[] }; amber: { unlocked: number; best: (number | null)[]; challengeBest: (number | null)[] } };
export const SAVE_KEY = 'pocketey-orbit-amber-v1';
export function cleanSave(raw: unknown): Save {
  const out: Save = { version: 1, sound: false, orbit: { unlocked: 1, best: [null, null, null], challengeBest: [null, null, null] }, amber: { unlocked: 1, best: [null, null, null], challengeBest: [null, null, null] } };
  if (!raw || typeof raw !== 'object') return out;
  const obj = raw as Partial<Save>;
  out.sound = obj.sound === true;
  for (const kind of ['orbit', 'amber'] as const) {
    const data = obj[kind];
    if (!data || typeof data !== 'object') continue;
    out[kind].unlocked = Number.isInteger(data.unlocked) ? Math.max(1, Math.min(3, data.unlocked)) : 1;
    out[kind].best = [0, 1, 2].map(i => { const n = data.best?.[i]; return typeof n === 'number' && Number.isFinite(n) && n > 0 && n < 3600 ? n : null; });
    out[kind].challengeBest = [0, 1, 2].map(i => { const n = data.challengeBest?.[i]; return typeof n === 'number' && Number.isFinite(n) && n > 0 && n < 3600 ? n : null; });
  }
  return out;
}
