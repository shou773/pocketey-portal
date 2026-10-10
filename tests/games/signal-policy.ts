import type { Hazard } from '../../src/games/model';

/** Test controller only: do not cross a centered pillar after an optional pickup. */
export function signalHazardTarget(hazard: Hazard | undefined, x: number, z: number) {
  if (!hazard || hazard.x - x >= 12) return 0;
  if (hazard.z === 0) return z > 0 ? Math.max(z, 1.85) : Math.min(z, -1.85);
  return hazard.z > 0 ? -1.85 : 1.85;
}
