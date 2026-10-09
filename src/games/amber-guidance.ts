import { stages, type State } from './model';

export type AmberFailure = 'spike' | 'edge-spike' | 'fall';
/** Describe the observed terminal state; never alter movement or collision rules. */
export function amberFailure(state: State): AmberFailure | null {
  if (state.kind !== 'amber' || state.status !== 'dead') return null;
  if (state.y < -4) return 'fall';
  const level = stages.amber[state.stage];
  const spike = level.hazards.find(h => Math.abs(state.x - h.x) < h.d / 2 + .2 &&
    Math.abs(state.z - h.z) < h.w / 2 + .2 && state.y < h.y + h.h - .07 && state.y + .65 > h.y + .08);
  if (!spike) return null;
  const platform = level.platforms.find(p => p.a <= spike.x && p.b >= spike.x && p.y === spike.y);
  const next = platform && level.platforms[level.platforms.indexOf(platform) + 1];
  return platform && platform.b - spike.x <= 1.2 && next && next.a > platform.b ? 'edge-spike' : 'spike';
}
export function crossedFirstSpike(state: State) {
  const spike = stages.amber[0].hazards[0];
  return state.kind === 'amber' && state.stage === 0 && state.status === 'running' && state.grounded && state.x > spike.x + spike.d / 2 + .2;
}
export function showAmberCoach(state: State, dismissed: boolean) {
  return state.kind === 'amber' && state.stage === 0 && state.status === 'running' && !dismissed;
}
