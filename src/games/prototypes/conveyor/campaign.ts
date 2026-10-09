import { STAGE, STEP, opposite, ports, exitFor, parseSave, createState, type Stage, type State, type Direction } from './model';

export type Mission = Stage & { id: string; name: readonly [string, string]; lesson: readonly [string, string]; target: number };
/** Authored boards keep the same cell size and the original prototype intact. */
export const MISSIONS: readonly Mission[] = [
  {
    id: 'first-dispatch', name: ['はじめての便', 'First dispatch'],
    lesson: ['タップで90°回転。直線と曲がりをつないで、下の出荷口へ。', 'Tap to turn 90°. Connect a straight and a corner to the shipping bay below.'],
    target: 2, width: 4, height: 3,
    source: { x: 0, z: 1, output: 1 }, exit: { x: 2, z: 2, input: 0 },
    tiles: [
      { id: 'a', x: 1, z: 1, kind: 'straight', rotation: 3 },
      { id: 'b', x: 2, z: 1, kind: 'bend', rotation: 3 },
    ],
  },
  {
    ...STAGE, id: 'factory-loop', name: ['工場をひとまわり', 'Around the factory'],
    lesson: ['4つの曲がりをつないで、中央の出荷口へ。', 'Link four corners to reach the shipping bay in the middle.'], target: 7,
  },
  {
    id: 'read-the-inlet', name: ['入口を見きわめて', 'Read the inlet'],
    lesson: ['今回は上から出発。全部のベルトを使う必要はありません。', 'This parcel starts from above. You do not need every belt.'],
    target: 6, width: 4, height: 3,
    source: { x: 2, z: 0, output: 2 }, exit: { x: 1, z: 1, input: 0 },
    tiles: [
      { id: 'a', x: 2, z: 1, kind: 'straight', rotation: 0 },
      { id: 'b', x: 2, z: 2, kind: 'bend', rotation: 0 },
      { id: 'c', x: 1, z: 2, kind: 'straight', rotation: 1 },
      { id: 'd', x: 0, z: 2, kind: 'bend', rotation: 1 },
      { id: 'e', x: 0, z: 1, kind: 'straight', rotation: 3 },
      { id: 'f', x: 0, z: 0, kind: 'bend', rotation: 3 },
      { id: 'g', x: 1, z: 0, kind: 'bend', rotation: 2 },
      { id: 'h', x: 3, z: 0, kind: 'straight', rotation: 1 },
    ],
  },
  {
    id: 'choose-a-route', name: ['どちらの道？', 'Pick a route'],
    lesson: ['水色の曲がりは、どちらの口からも入れます。上か下をつないで出荷。3回の★はおまけの挑戦です。', 'Blue corners work both ways. Deliver by the upper or lower route. The 3-turn star is optional.'],
    target: 3, width: 4, height: 3,
    source: { x: 0, z: 1, output: 1 }, exit: { x: 3, z: 1, input: 3 },
    tiles: [
      { id: 'a', x: 1, z: 1, kind: 'two-way', rotation: 3 },
      { id: 'b', x: 1, z: 0, kind: 'bend', rotation: 3 },
      { id: 'c', x: 2, z: 0, kind: 'bend', rotation: 0 },
      { id: 'd', x: 1, z: 2, kind: 'two-way', rotation: 1 },
      { id: 'e', x: 2, z: 2, kind: 'two-way', rotation: 0 },
      { id: 'f', x: 2, z: 1, kind: 'two-way', rotation: 3 },
    ],
  },
];
export const PREVIOUS_CAMPAIGN_KEY = 'pocketey-conveyor-campaign-v2';
export const CAMPAIGN_VERSION = 3;
export const CAMPAIGN_KEY = 'pocketey-conveyor-campaign-v3';
export type Record = { rotations: Direction[]; turns: number; best: number | null };
export type Campaign = { version: 3; active: string; records: { [id: string]: Record }; legacyImported: boolean };
const emptyRecord = (stage: Stage): Record => ({ rotations: stage.tiles.map(t => t.rotation), turns: 0, best: null });
const validNumber = (n: unknown): n is number => Number.isSafeInteger(n) && Number(n) >= 0;
export function parseCampaign(raw: string | null, legacyRaw: string | null = null, previousRaw: string | null = null): Campaign {
  const save: Campaign = { version: 3, active: MISSIONS[0].id, records: {}, legacyImported: false };
  for (const mission of MISSIONS) save.records[mission.id] = emptyRecord(mission);
  const read = (text: string | null) => { try { return JSON.parse(text ?? 'null'); } catch { return null; } };
  const previous = read(previousRaw);
  function apply(value: any, count: number) {
    for (const mission of MISSIONS.slice(0, count)) {
      const record = value.records[mission.id], target = save.records[mission.id];
      if (!record || typeof record !== 'object') continue;
      if (Array.isArray(record.rotations) && record.rotations.length === mission.tiles.length
        && record.rotations.every((n: unknown) => validNumber(n) && n < 4) && validNumber(record.turns)) {
        target.rotations = [...record.rotations]; target.turns = record.turns;
      }
      // Reset never erases an earned best; damaged/missing v3 fields may retain a valid v2 backup.
      if (validNumber(record.best)) target.best = Math.min(target.best ?? Infinity, record.best);
    }
    save.legacyImported ||= value.legacyImported === true;
    if (value.active !== undefined) {
      const index = MISSIONS.findIndex(m => m.id === value.active);
      save.active = index >= 0 && index < count && isUnlocked(save, index) ? value.active : MISSIONS[0].id;
    }
  }
  if (previous?.version === 2 && previous.records && typeof previous.records === 'object') apply(previous, 3);
  else {
    const old = read(legacyRaw);
    if (old?.version === 1) {
      const parsed = parseSave(legacyRaw);
      save.records['factory-loop'] = { rotations: [...parsed.rotations], turns: parsed.turns, best: parsed.best };
      save.legacyImported = true; save.active = 'factory-loop';
    }
  }
  const value = read(raw);
  if ((value?.version === 3 || value?.version === 2) && value.records && typeof value.records === 'object') apply(value, value.version === 2 ? 3 : MISSIONS.length);
  return save;
}
export function isUnlocked(save: Campaign, index: number) {
  return index >= 0 && index < MISSIONS.length && (index === 0 || (index === 1 && save.legacyImported) || save.records[MISSIONS[index - 1].id]?.best != null);
}
export function restoreMission(save: Campaign, mission: Mission): State {
  const state = createState(mission), record = save.records[mission.id];
  state.tiles.forEach((tile, i) => tile.rotation = record.rotations[i]); state.turns = record.turns; return state;
}
export function recordState(save: Campaign, mission: Mission, state: State) {
  const previous = save.records[mission.id];
  save.records[mission.id] = { rotations: state.tiles.map(t => t.rotation), turns: state.turns,
    best: state.phase === 'success' ? Math.min(previous.best ?? Infinity, state.turns) : previous.best };
}
/** A directed tile's incoming side determines its only valid orientation. Trace
 * that unique route and count clockwise taps from the authored starting layout.
 * Null means the authored topology has no solution. This is not a play shortcut. */
export function solveMission(stage: Stage): { rotations: Direction[]; turns: number; visited: string[] } | null {
  if (stage.tiles.some(tile => tile.kind === 'two-way')) return solveBranches(stage);
  const rotations = stage.tiles.map(t => t.rotation), visited: string[] = [];
  let cell = stage.source, heading = stage.source.output, turns = 0;
  for (let guard = 0; guard <= stage.tiles.length; guard++) {
    const step = STEP[heading], next = { x: cell.x + step.x, z: cell.z + step.z }, input = opposite(heading);
    if (next.x === stage.exit.x && next.z === stage.exit.z) return input === stage.exit.input ? { rotations, turns, visited } : null;
    const index = stage.tiles.findIndex(t => t.x === next.x && t.z === next.z), tile = stage.tiles[index];
    if (!tile || visited.includes(tile.id)) return null;
    const rotation = ((input + 1) % 4) as Direction;
    turns += (rotation - tile.rotation + 4) % 4; rotations[index] = rotation; visited.push(tile.id);
    heading = ports({ ...tile, rotation }).output; cell = { ...next, output: heading };
  }
  return null;
}

/** Explore only orientations that accept the actual arriving side. Unused belts keep their initial rotation. */
function solveBranches(stage: Stage): { rotations: Direction[]; turns: number; visited: string[] } | null {
  let best: { rotations: Direction[]; turns: number; visited: string[] } | null = null;
  function visit(cell: {x:number;z:number}, heading: Direction, rotations: Direction[], turns: number, visited: string[]) {
    if (best && turns >= best.turns) return;
    const delta = STEP[heading], next = {x:cell.x+delta.x,z:cell.z+delta.z}, input = opposite(heading);
    if (next.x === stage.exit.x && next.z === stage.exit.z) {
      if (input === stage.exit.input) best = {rotations,turns,visited};
      return;
    }
    const index = stage.tiles.findIndex(tile => tile.x === next.x && tile.z === next.z), tile = stage.tiles[index];
    if (!tile || visited.includes(tile.id)) return;
    for (let value=0;value<4;value++) {
      const rotation=value as Direction, output=exitFor({...tile,rotation},input);
      if (output === null) continue;
      const nextRotations=[...rotations];nextRotations[index]=rotation;
      visit(tile,output,nextRotations,turns+(rotation-tile.rotation+4)%4,[...visited,tile.id]);
    }
  }
  visit(stage.source,stage.source.output,stage.tiles.map(tile=>tile.rotation),0,[]);
  return best;
}
