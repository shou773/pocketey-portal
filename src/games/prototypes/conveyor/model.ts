/** Grid coordinates: x grows right, z grows down. No rendering or wall clock here. */
export type Direction = 0 | 1 | 2 | 3; // north, east, south, west
export type Cell = { x: number; z: number };
export type Tile = Cell & { id: string; kind: 'straight' | 'bend'; rotation: Direction };
export type Stage = {
  width: number; height: number; tiles: readonly Tile[];
  source: Cell & { output: Direction }; exit: Cell & { input: Direction };
};
export const STEP = [{ x: 0, z: -1 }, { x: 1, z: 0 }, { x: 0, z: 1 }, { x: -1, z: 0 }] as const;
export const turn = (direction: number): Direction => ((direction % 4 + 4) % 4) as Direction;
export const opposite = (direction: Direction) => turn(direction + 2);
export function ports(tile: Tile) {
  // Both base shapes enter from west; a bend turns right (west -> south).
  return { input: turn(3 + tile.rotation), output: turn((tile.kind === 'straight' ? 1 : 2) + tile.rotation) };
}
export const STAGE: Stage = {
  width: 4, height: 3,
  source: { x: 0, z: 0, output: 1 }, exit: { x: 2, z: 1, input: 3 },
  tiles: [
    { id: 'a', x: 1, z: 0, kind: 'straight', rotation: 1 },
    { id: 'b', x: 2, z: 0, kind: 'straight', rotation: 0 },
    { id: 'c', x: 3, z: 0, kind: 'bend', rotation: 3 },
    { id: 'd', x: 3, z: 1, kind: 'straight', rotation: 0 },
    { id: 'e', x: 3, z: 2, kind: 'bend', rotation: 0 },
    { id: 'f', x: 2, z: 2, kind: 'straight', rotation: 2 },
    { id: 'g', x: 1, z: 2, kind: 'bend', rotation: 1 },
    { id: 'h', x: 1, z: 1, kind: 'bend', rotation: 3 },
  ],
};
export type Outcome = 'success' | 'wrong-entry' | 'wrong-exit' | 'empty' | 'out-of-bounds' | 'loop';
export type Visit = Cell & { input: Direction | null; output: Direction | null; tileId?: string };
export type Route = { visits: Visit[]; outcome: Outcome; problem: Cell; tileId?: string };
const same = (a: Cell, b: Cell) => a.x === b.x && a.z === b.z;

/** Resolve the complete route once, before animation. Directed ports prohibit sideways entry. */
export function trace(stage: Stage, tiles: readonly Tile[]): Route {
  const visits: Visit[] = [{ ...stage.source, input: null, output: stage.source.output }];
  const visited = new Set<string>();
  const grid = new Map(tiles.map(tile => [`${tile.x},${tile.z}`, tile]));
  let cell: Cell = stage.source, heading = stage.source.output;
  for (;;) {
    const delta = STEP[heading];
    const next = { x: cell.x + delta.x, z: cell.z + delta.z };
    const input = opposite(heading);
    const finish = (outcome: Outcome, tileId?: string): Route => {
      // The box stops at a bad connection, rather than entering the incorrect belt.
      const problem = outcome === 'success' ? next : { x: cell.x + delta.x * .52, z: cell.z + delta.z * .52 };
      visits.push({ ...problem, input, output: null });
      return { visits, outcome, problem: next, tileId };
    };
    if (next.x < 0 || next.x >= stage.width || next.z < 0 || next.z >= stage.height) return finish('out-of-bounds');
    if (same(next, stage.exit)) return finish(input === stage.exit.input ? 'success' : 'wrong-exit');
    const tile = grid.get(`${next.x},${next.z}`);
    if (!tile) return finish('empty');
    const connection = ports(tile);
    if (connection.input !== input) return finish('wrong-entry', tile.id);
    const key = `${tile.x},${tile.z},${input}`;
    if (visited.has(key)) return finish('loop', tile.id);
    visited.add(key);
    visits.push({ x: tile.x, z: tile.z, input, output: connection.output, tileId: tile.id });
    cell = tile; heading = connection.output;
  }
}

export type Phase = 'editing' | 'running' | 'paused' | 'failed' | 'success';
export type State = { tiles: Tile[]; phase: Phase; selected: string | null; turns: number; route: Route | null };
export function createState(stage: Stage = STAGE): State {
  return { tiles: stage.tiles.map(tile => ({ ...tile })), phase: 'editing', selected: null, turns: 0, route: null };
}
export type Action = { type: 'rotate'; id: string } | { type: 'play' | 'finish' | 'pause' | 'resume' | 'retry' | 'reset' };
/** Every input, including keyboard and programmatic events, shares these phase guards. */
export function reduce(state: State, action: Action, stage = STAGE): State {
  switch (action.type) {
    case 'reset': return createState(stage); // Deliberately cancels even an in-flight delivery.
    case 'rotate': {
      if (!['editing', 'failed'].includes(state.phase) || !state.tiles.some(tile => tile.id === action.id)) return state;
      return { ...state, phase: 'editing', route: null, selected: action.id, turns: state.turns + 1,
        tiles: state.tiles.map(tile => tile.id === action.id ? { ...tile, rotation: turn(tile.rotation + 1) } : tile) };
    }
    case 'play': return ['editing', 'failed'].includes(state.phase)
      ? { ...state, phase: 'running', selected: null, route: trace(stage, state.tiles) } : state;
    case 'finish': return state.phase === 'running' && state.route
      ? { ...state, phase: state.route.outcome === 'success' ? 'success' : 'failed', selected: state.route.tileId ?? null } : state;
    case 'pause': return state.phase === 'running' ? { ...state, phase: 'paused' } : state;
    case 'resume': return state.phase === 'paused' ? { ...state, phase: 'running' } : state;
    case 'retry': return ['failed', 'success'].includes(state.phase) ? { ...state, phase: 'editing', route: null } : state;
  }
}

export const SAVE_KEY = 'pocketey-conveyor-v1';
export type Save = { version: 1; rotations: Direction[]; turns: number; best: number | null };
export function parseSave(raw: string | null): Save {
  const fallback: Save = { version: 1, rotations: STAGE.tiles.map(tile => tile.rotation), turns: 0, best: null };
  try {
    const value = JSON.parse(raw ?? 'null');
    if (!value || value.version !== 1) return fallback;
    if (Array.isArray(value.rotations) && value.rotations.length === STAGE.tiles.length
      && value.rotations.every((n: unknown) => Number.isInteger(n) && Number(n) >= 0 && Number(n) < 4)
      && Number.isSafeInteger(value.turns) && value.turns >= 0) {
      fallback.rotations = [...value.rotations]; fallback.turns = value.turns;
    }
    if (Number.isSafeInteger(value.best) && value.best >= 0) fallback.best = value.best;
  } catch { /* Local storage is optional; malformed content never changes the stage. */ }
  return fallback;
}
export function restore(save: Save): State {
  const state = createState();
  state.tiles.forEach((tile, index) => tile.rotation = save.rotations[index]);
  state.turns = save.turns;
  return state;
}
