import { stages, type State } from './model';
export type OrbitFailure = 'pillar' | 'fall';
/** Observe the unchanged terminal coordinates; do not infer jump timing. */
export function orbitFailure(state: State): OrbitFailure | null {
  if (state.kind !== 'orbit' || state.status !== 'dead') return null;
  if (state.y < -4) return 'fall';
  return stages.orbit[state.stage].hazards.some(h => Math.abs(state.x - h.x) < h.d / 2 + .2 &&
    Math.abs(state.z - h.z) < h.w / 2 + .2 && state.y < h.y + h.h - .07 && state.y + .65 > h.y + .08) ? 'pillar' : null;
}
