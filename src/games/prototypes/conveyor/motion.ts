import { STEP, type Cell, type Route } from './model';

export type Motion = { points: Cell[]; distances: number[]; length: number; duration: number };
/** Convert the resolved route to a polyline. This never reads or changes game rules. */
export function createMotion(route: Route): Motion {
  const points: Cell[] = [];
  for (const visit of route.visits) {
    if (visit.input === null || visit.output === null) { points.push({ x: visit.x, z: visit.z }); continue; }
    const a = STEP[visit.input], b = STEP[visit.output];
    const start = { x: visit.x + a.x * .5, z: visit.z + a.z * .5 };
    const end = { x: visit.x + b.x * .5, z: visit.z + b.z * .5 };
    points.push(start);
    for (let i = 1; i <= 12; i++) {
      const t = i / 12, u = 1 - t;
      points.push({ x: u * u * start.x + 2 * u * t * visit.x + t * t * end.x,
        z: u * u * start.z + 2 * u * t * visit.z + t * t * end.z });
    }
  }
  const distances = [0];
  for (let i = 1; i < points.length; i++) distances.push(distances[i - 1] + Math.hypot(points[i].x - points[i - 1].x, points[i].z - points[i - 1].z));
  const length = distances.at(-1) ?? 0;
  return { points, distances, length, duration: Math.max(.5, length / 1.65) };
}
export function sampleMotion(motion: Motion, elapsed: number): Cell {
  const distance = Math.max(0, Math.min(1, elapsed / motion.duration)) * motion.length;
  const index = motion.distances.findIndex(d => d > distance);
  if (index < 1) return { ...motion.points.at(-1)! };
  const a = motion.points[index - 1], b = motion.points[index];
  const t = (distance - motion.distances[index - 1]) / (motion.distances[index] - motion.distances[index - 1]);
  return { x: a.x + (b.x - a.x) * t, z: a.z + (b.z - a.z) * t };
}
