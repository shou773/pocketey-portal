// A single authored course. Coordinates are metres, +z is forward.
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
export interface State {
  phase: Phase; x: number; z: number; heading: Heading; gate: number;
  queued: Direction | null; time: number; reason: 'block' | 'edge' | null;
}
export function createState(): State {
  return { phase: 'ready', x: 0, z: 0, heading: 0, gate: 0, queued: null, time: 0, reason: null };
}
export function roadX(z: number) {
  const i = KNOTS.findIndex(k => k.z >= z);
  if (i <= 0) return i === -1 ? KNOTS.at(-1)!.x : KNOTS[0].x;
  const a = KNOTS[i - 1], b = KNOTS[i];
  return a.x + (b.x - a.x) * (z - a.z) / (b.z - a.z);
}
export function windowOpen(s: State) {
  const gate = GATES[s.gate];
  return s.phase === 'playing' && !!gate && s.z >= gate.z - WINDOW && s.z < gate.z;
}
export function queueTurn(s: State, direction: Direction) {
  if (!windowOpen(s)) return false;
  s.queued = direction; // Last deliberate flick wins; no repeat/stacked turns.
  return true;
}
export function collision(x: number, z: number): State['reason'] {
  if (BLOCKS.some(b => Math.abs(x - b.x) <= CAR_HALF + b.halfX && Math.abs(z - b.z) <= CAR_HALF + b.halfZ)) return 'block';
  // Check the entire square footprint, including its front/back at bends.
  if ([z - CAR_HALF, z, z + CAR_HALF].some(p => Math.abs(x - roadX(p)) + CAR_HALF > ROAD_HALF)) return 'edge';
  return null;
}
export function advance(s: State, dt = STEP) {
  if (s.phase !== 'playing' || !Number.isFinite(dt) || dt <= 0) return;
  // Bound catch-up; subdivide to prevent tunnelling on a delayed frame.
  let remaining = Math.min(dt, 0.1);
  while (remaining > 1e-9 && s.phase === 'playing') {
    const step = Math.min(STEP, remaining), gate = GATES[s.gate];
    let distance = SPEED * step;
    if (gate && s.z + distance >= gate.z - 1e-9) {
      const before = Math.max(0, gate.z - s.z);
      s.x += s.heading * before; s.z = gate.z; distance -= before;
      if (s.queued !== null) s.heading = Math.max(-1, Math.min(1, s.heading + s.queued)) as Heading;
      s.queued = null; s.gate++;
    }
    s.x += s.heading * distance; s.z += distance; s.time += step;
    s.reason = collision(s.x, s.z);
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
