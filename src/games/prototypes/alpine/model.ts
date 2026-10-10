// Authored courses. Coordinates are metres, +z is forward. Course 1 data is unchanged.
export const STEP = 1 / 120;
export const SPEED = 4;
export const FINISH = 50;
export const ROAD_HALF = 3.5;
export const CAR_HALF = 0.48; // The visible square bumper is the collision footprint.
export const WINDOW = 5;
export const SAVE_KEY = 'pocketey-alpine-prototype-v1';
export type Direction = -1 | 1;
export type Heading = -1 | 0 | 1;
export type Phase = 'ready' | 'playing' | 'paused' | 'failed' | 'clear';
export const GATES: readonly { z: number; direction: Direction }[] = [
  { z: 10, direction: -1 }, { z: 18, direction: 1 },
  { z: 30, direction: 1 }, { z: 38, direction: -1 },
];
export const KNOTS = [{ z: -8, x: 0 }, { z: 10, x: 0 }, { z: 18, x: -8 },
  { z: 30, x: -8 }, { z: 38, x: 0 }, { z: 58, x: 0 }];
// Blocks cover the missed-turn line; the intended path has > 1 m clearance.
export const BLOCKS = [
  { x: 0, z: 13, halfX: 0.9, halfZ: 0.7 },
  { x: -11, z: 21, halfX: 0.9, halfZ: 0.7 },
  { x: -8, z: 33, halfX: 0.9, halfZ: 0.7 },
  { x: 3, z: 41, halfX: 0.9, halfZ: 0.7 },
];
export interface Course {
  id: string; name: readonly [string, string]; rhythm: readonly [string, string];
  gates: typeof GATES; knots: typeof KNOTS; blocks: typeof BLOCKS;
}
export const COURSES: readonly Course[] = [
  { id: 'mountain-pass', name: ['山の入口', 'Mountain pass'], rhythm: ['4旋回 · ゆったりしたS字', '4 turns · open S bends'], gates: GATES, knots: KNOTS, blocks: BLOCKS },
  { id: 'long-return', name: ['長い折り返し', 'Long return'], rhythm: ['6旋回 · 短く、長く、短く', '6 turns · short, long, short'],
    gates: [{z:7,direction:1},{z:13,direction:-1},{z:19,direction:-1},{z:31,direction:1},{z:37,direction:1},{z:43,direction:-1}],
    knots: [{z:-8,x:0},{z:7,x:0},{z:13,x:6},{z:19,x:6},{z:31,x:-6},{z:37,x:-6},{z:43,x:0},{z:58,x:0}],
    blocks: [{x:0,z:10,halfX:.9,halfZ:.7},{x:9,z:16,halfX:.9,halfZ:.7},{x:6,z:22,halfX:.9,halfZ:.7},
      {x:-9,z:34,halfX:.9,halfZ:.7},{x:-6,z:40,halfX:.9,halfZ:.7},{x:3,z:46,halfX:.9,halfZ:.7}] },
  { id: 'switchback-rhythm', name: ['連続つづら折り', 'Switchback rhythm'], rhythm: ['8旋回 · 一定のリズムで', '8 turns · a steady cadence'],
    gates: [{z:6,direction:-1},{z:11.5,direction:1},{z:17,direction:1},{z:22.5,direction:-1},
      {z:28,direction:-1},{z:33.5,direction:1},{z:39,direction:1},{z:44.5,direction:-1}],
    knots: [{z:-8,x:0},{z:6,x:0},{z:11.5,x:-5.5},{z:17,x:-5.5},{z:22.5,x:0},{z:28,x:0},
      {z:33.5,x:-5.5},{z:39,x:-5.5},{z:44.5,x:0},{z:58,x:0}],
    blocks: [{x:0,z:9,halfX:.9,halfZ:.7},{x:-8.5,z:14.5,halfX:.9,halfZ:.7},{x:-5.5,z:20,halfX:.9,halfZ:.7},
      {x:3,z:25.5,halfX:.9,halfZ:.7},{x:0,z:31,halfX:.9,halfZ:.7},{x:-8.5,z:36.5,halfX:.9,halfZ:.7},
      {x:-5.5,z:42,halfX:.9,halfZ:.7},{x:3,z:47.5,halfX:.9,halfZ:.7}] },
];
export const PRECISION_NEAR = 1.2, PRECISION_FAR = 2.8;
const PRECISION_ROUNDOFF = 1e-9; // Metres: accumulated float noise, not an extra input frame.
export function courseAt(index = 0) { return COURSES[Math.max(0, Math.min(COURSES.length - 1, Number.isFinite(index) ? Math.floor(index) : 0))]; }
export interface State {
  phase: Phase; x: number; z: number; heading: Heading; gate: number;
  queued: Direction | null; time: number; reason: 'block' | 'edge' | null;
  course: number; firstInput: number | null; precise: number; recorded: boolean;
}
export function createState(course = 0): State {
  return { phase: 'ready', x: 0, z: 0, heading: 0, gate: 0, queued: null, time: 0, reason: null,
    course: COURSES.indexOf(courseAt(course)), firstInput: null, precise: 0, recorded: false };
}
export function roadX(z: number, course = 0) {
  const KNOTS = courseAt(course).knots;
  const i = KNOTS.findIndex(k => k.z >= z);
  if (i <= 0) return i === -1 ? KNOTS.at(-1)!.x : KNOTS[0].x;
  const a = KNOTS[i - 1], b = KNOTS[i];
  return a.x + (b.x - a.x) * (z - a.z) / (b.z - a.z);
}
export function windowOpen(s: State) {
  const gate = courseAt(s.course).gates[s.gate];
  return s.phase === 'playing' && !!gate && s.z >= gate.z - WINDOW && s.z < gate.z;
}
export function queueTurn(s: State, direction: Direction) {
  if (!windowOpen(s)) return false;
  if (s.firstInput === null) s.firstInput = courseAt(s.course).gates[s.gate].z - s.z;
  s.queued = direction; // Last deliberate flick wins; no repeat/stacked turns.
  return true;
}
export function collision(x: number, z: number, course = 0): State['reason'] {
  const BLOCKS = courseAt(course).blocks;
  if (BLOCKS.some(b => Math.abs(x - b.x) <= CAR_HALF + b.halfX && Math.abs(z - b.z) <= CAR_HALF + b.halfZ)) return 'block';
  // Check the entire square footprint, including its front/back at bends.
  if ([z - CAR_HALF, z, z + CAR_HALF].some(p => Math.abs(x - roadX(p, course)) + CAR_HALF > ROAD_HALF)) return 'edge';
  return null;
}
export function advance(s: State, dt = STEP) {
  if (s.phase !== 'playing' || !Number.isFinite(dt) || dt <= 0) return;
  // Bound catch-up; subdivide to prevent tunnelling on a delayed frame.
  let remaining = Math.min(dt, 0.1);
  while (remaining > 1e-9 && s.phase === 'playing') {
    const step = Math.min(STEP, remaining), gate = courseAt(s.course).gates[s.gate];
    let distance = SPEED * step;
    if (gate && s.z + distance >= gate.z - 1e-9) {
      const before = Math.max(0, gate.z - s.z);
      s.x += s.heading * before; s.z = gate.z; distance -= before;
      if (s.queued === gate.direction && s.firstInput !== null && s.firstInput + PRECISION_ROUNDOFF >= PRECISION_NEAR && s.firstInput - PRECISION_ROUNDOFF <= PRECISION_FAR) s.precise++;
      s.firstInput = null;
      if (s.queued !== null) s.heading = Math.max(-1, Math.min(1, s.heading + s.queued)) as Heading;
      s.queued = null; s.gate++;
    }
    s.x += s.heading * distance; s.z += distance; s.time += step;
    s.reason = collision(s.x, s.z, s.course);
    if (s.reason) s.phase = 'failed';
    else if (s.z >= FINISH - 1e-9) { s.z = FINISH; s.phase = 'clear'; }
    remaining -= step;
  }
}
export interface Save { clears: number; muted: boolean }
export function parseSave(raw: string | null): Save {
  try {
    const v = JSON.parse(raw || 'null');
    return { clears: Number.isSafeInteger(v?.clears) && v.clears >= 0 ? Math.min(v.clears, 999999) : 0, muted: v?.muted !== false };
  } catch { return { clears: 0, muted: true }; }
}
