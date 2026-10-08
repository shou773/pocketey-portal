import test from 'node:test';
import assert from 'node:assert/strict';
import { STAGE, createState, reduce, trace, parseSave, restore, ports, type Stage, type Tile, type Direction } from '../../../src/games/prototypes/conveyor/model';
import { createMotion, sampleMotion } from '../../../src/games/prototypes/conveyor/motion';

const solution: Direction[] = [0, 0, 0, 1, 1, 2, 2, 3];
const solved = () => STAGE.tiles.map((tile, i) => ({ ...tile, rotation: solution[i] }));
const tile = (x: number, z: number, kind: Tile['kind'], rotation: Direction, id = `${x},${z}`): Tile => ({ x, z, kind, rotation, id });
function fixture(tiles: Tile[], overrides: Partial<Stage> = {}): Stage {
  return { width: 4, height: 3, source: { x: 0, z: 0, output: 1 }, exit: { x: 3, z: 2, input: 3 }, tiles, ...overrides };
}
test('the shipped stage has a complete valid route through all eight tiles', () => {
  const route = trace(STAGE, solved());
  assert.equal(route.outcome, 'success');
  assert.deepEqual(route.visits.filter(v => v.tileId).map(v => v.tileId), ['a','b','c','d','e','f','g','h']);
  assert.deepEqual(route.problem, { x: 2, z: 1 });
  assert.equal(trace(STAGE, STAGE.tiles).outcome, 'wrong-entry');
});
test('solution is reachable using ordinary clockwise taps (7 taps)', () => {
  let state = createState();
  for (const [index, target] of solution.entries()) {
    for (let i = 0; i < 4 && state.tiles[index].rotation !== target; i++) state = reduce(state, { type: 'rotate', id: state.tiles[index].id });
  }
  assert.equal(state.turns, 7);
  state = reduce(state, { type: 'play' });
  assert.equal(state.phase, 'running'); assert.equal(state.route?.outcome, 'success');
  assert.equal(reduce(state, { type: 'finish' }).phase, 'success');
});
test('four turns restore each shape and rotate both directed ports', () => {
  for (const kind of ['straight','bend'] as const) {
    const base = tile(0, 0, kind, 0), p = ports(base);
    for (let r = 0; r < 4; r++) assert.deepEqual(ports({ ...base, rotation: r as Direction }), { input: (p.input + r) % 4, output: (p.output + r) % 4 });
  }
  let state = createState(); const before = state.tiles[0];
  for (let i = 0; i < 4; i++) state = reduce(state, { type: 'rotate', id: before.id });
  assert.deepEqual(state.tiles[0], before); assert.equal(state.turns, 4);
});
test('a sideways or reversed inlet fails at the connection, before tile center', () => {
  for (const rotation of [1,2,3] as Direction[]) {
    const stage = fixture([tile(1, 0, 'straight', rotation)]);
    const result = trace(stage, stage.tiles);
    assert.equal(result.outcome, 'wrong-entry');
    assert.equal(result.tileId, '1,0');
    assert.deepEqual(result.visits.at(-1), { x: .52, z: 0, input: 3, output: null });
  }
});
test('shipping machine accepts only its explicit inlet, not any adjacent side', () => {
  const stage = fixture([tile(1, 0, 'straight', 0)], { exit: { x: 2, z: 0, input: 0 } });
  assert.equal(trace(stage, stage.tiles).outcome, 'wrong-exit');
  assert.equal(trace({ ...stage, exit: { x: 2, z: 0, input: 3 } }, stage.tiles).outcome, 'success');
});
test('empty cells and all four board boundaries have distinct deterministic failures', () => {
  assert.equal(trace(fixture([]), []).outcome, 'empty');
  const boundaries = [{ x: 1, z: 0, output: 0 }, { x: 3, z: 1, output: 1 }, { x: 1, z: 2, output: 2 }, { x: 0, z: 1, output: 3 }];
  for (const source of boundaries) {
    const stage = fixture([], { source: source as Stage['source'] });
    assert.equal(trace(stage, []).outcome, 'out-of-bounds');
  }
});
test('a synthetic directed cycle terminates at the repeated cell + incoming direction', () => {
  // The one shipped stage cannot enter a cycle without a port mismatch. A source
  // overlapping the last fixture tile exercises the general safety guard anyway.
  const stage = fixture([tile(1,0,'bend',0),tile(1,1,'bend',1),tile(0,1,'bend',2),tile(0,0,'bend',3)]);
  const route = trace(stage, stage.tiles);
  assert.equal(route.outcome, 'loop'); assert.equal(route.tileId, '1,0');
  assert.equal(route.visits.length, 6);
});
test('route computation is repeatable, does not mutate inputs, and snapshots a run', () => {
  const tiles = solved(), before = structuredClone(tiles);
  assert.deepEqual(trace(STAGE, tiles), trace(STAGE, tiles)); assert.deepEqual(tiles, before);
  const state = { ...createState(), tiles };
  const running = reduce(state, { type: 'play' });
  state.tiles[0].rotation = 2;
  assert.equal(running.route?.outcome, 'success');
});
test('running and paused inputs cannot rotate, replay, retry or finish early', () => {
  const running = reduce(createState(), { type: 'play' });
  for (const action of [{ type:'rotate',id:'a' },{ type:'play' },{ type:'retry' }] as const) assert.equal(reduce(running, action), running);
  const paused = reduce(running, { type:'pause' }); assert.equal(paused.phase,'paused');
  for (const action of [{ type:'rotate',id:'a' },{ type:'play' },{ type:'finish' },{ type:'retry' }] as const) assert.equal(reduce(paused, action), paused);
  assert.equal(reduce(paused, { type:'resume' }).phase,'running');
});
test('failed run can be edited in place; retry preserves rotation and turn count', () => {
  const failed = reduce(reduce(createState(), { type:'play' }), { type:'finish' }); assert.equal(failed.phase,'failed');
  const retry = reduce(failed, { type:'retry' }); assert.equal(retry.phase,'editing'); assert.deepEqual(retry.tiles, failed.tiles);
  const edited = reduce(failed, { type:'rotate',id:'a' }); assert.equal(edited.phase,'editing'); assert.equal(edited.route,null); assert.equal(edited.turns,1);
});
test('reset cancels every phase and late completion cannot resurrect a canceled run', () => {
  let state = reduce(createState(), { type:'rotate',id:'a' });
  state = reduce(state, { type:'play' });
  for (const phase of ['editing','running','paused','failed','success'] as const) {
    const reset = reduce({ ...state, phase }, { type:'reset' });
    assert.deepEqual(reset, createState()); assert.equal(reduce(reset,{type:'finish'}),reset);
  }
});
test('save validation rejects malformed/future/invalid layouts and retains a valid record', () => {
  for (const raw of [null, '{', 'null', '[]', '{"version":2}', '{"version":1,"rotations":[0],"turns":0}']) assert.deepEqual(restore(parseSave(raw)), createState());
  for (const bad of [-1,4,1.5,null,'0']) {
    const rotations: unknown[] = [...solution]; rotations[0]=bad;
    assert.deepEqual(restore(parseSave(JSON.stringify({version:1,rotations,turns:7}))),createState());
  }
  const save = parseSave(JSON.stringify({version:1,rotations:solution,turns:7,best:7}));
  assert.deepEqual(restore(save).tiles,solved()); assert.equal(save.best,7);
  assert.equal(parseSave('{"version":1,"best":-1}').best,null);
});
test('animation samples a resolved path without changing its result; pause/resume can use the same elapsed time', () => {
  const route = trace(STAGE, solved()), snapshot = structuredClone(route), motion = createMotion(route);
  assert.deepEqual(sampleMotion(motion,0),{x:0,z:0});
  assert.deepEqual(sampleMotion(motion,motion.duration+100),{x:2,z:1});
  const a = sampleMotion(motion,1); assert.deepEqual(a,sampleMotion(motion,1));
  for (let i=0;i<=120;i++) { const p=sampleMotion(motion,motion.duration*i/120); assert.ok(Number.isFinite(p.x)&&Number.isFinite(p.z)); }
  assert.deepEqual(route,snapshot);
  const fail = createMotion(trace(STAGE,STAGE.tiles)); assert.ok(fail.duration < motion.duration);
});
