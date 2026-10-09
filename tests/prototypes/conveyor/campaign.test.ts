import test from 'node:test';
import assert from 'node:assert/strict';
import { STAGE, createState, reduce, trace, type Direction } from '../../../src/games/prototypes/conveyor/model';
import { MISSIONS, parseCampaign, restoreMission, recordState, isUnlocked, solveMission } from '../../../src/games/prototypes/conveyor/campaign';

for (const mission of MISSIONS) {
  test(`${mission.id}: valid board, exhaustive minimum and ordinary-tap completion`, () => {
    const cells = new Set<string>(), ids = new Set<string>();
    for (const cell of [mission.source, mission.exit, ...mission.tiles]) {
      assert.ok(Number.isInteger(cell.x) && Number.isInteger(cell.z));
      assert.ok(cell.x >= 0 && cell.x < mission.width && cell.z >= 0 && cell.z < mission.height);
      const key = `${cell.x},${cell.z}`; assert.ok(!cells.has(key), `duplicate ${key}`); cells.add(key);
    }
    for (const tile of mission.tiles) { assert.ok(!ids.has(tile.id)); ids.add(tile.id); }
    assert.ok(mission.tiles.length <= 8, 'Preserve the established mobile/render budget');
    let minimum = Infinity, solutions = 0;
    // Exhaustive enumeration is independent of solveMission's route derivation.
    for (let code = 0; code < 4 ** mission.tiles.length; code++) {
      const tiles = mission.tiles.map((tile, i) => ({ ...tile, rotation: (Math.floor(code / 4 ** i) % 4) as Direction }));
      if (trace(mission, tiles).outcome !== 'success') continue;
      solutions++;
      minimum = Math.min(minimum, tiles.reduce((sum, tile, i) => sum + (tile.rotation - mission.tiles[i].rotation + 4) % 4, 0));
    }
    assert.ok(solutions > 0); assert.equal(mission.target, minimum);
    const solution = solveMission(mission)!; assert.equal(solution.turns, minimum);
    let state = createState(mission);
    for (let i = 0; i < state.tiles.length; i++) {
      for (let n = 0; n < 4 && state.tiles[i].rotation !== solution.rotations[i]; n++) state = reduce(state, { type: 'rotate', id: state.tiles[i].id }, mission);
    }
    assert.equal(state.turns, minimum);
    state = reduce(reduce(state, { type: 'play' }, mission), { type: 'finish' }, mission);
    assert.equal(state.phase, 'success');
    if (mission.id === 'read-the-inlet') { assert.equal(solutions, 4); assert.equal(solution.visited.length, 7); assert.ok(!solution.visited.includes('h')); }
  });
}
test('original board is preserved byte-for-byte as mission two data', () => {
  const { id, name, lesson, target, ...board } = MISSIONS[1]; assert.deepEqual(board, STAGE);
});
test('fresh campaign locks later boards and completion unlocks exactly the next', () => {
  const save = parseCampaign(null);
  assert.equal(save.active, MISSIONS[0].id); assert.deepEqual(MISSIONS.map((_,i) => isUnlocked(save,i)), [true,false,false]);
  assert.equal(isUnlocked(save,-1),false); assert.equal(isUnlocked(save,99),false);
  for (let index = 0; index < MISSIONS.length; index++) {
    const mission = MISSIONS[index], solution = solveMission(mission)!;
    const state = { ...createState(mission), turns: solution.turns, phase: 'success' as const,
      tiles: mission.tiles.map((t,i) => ({ ...t, rotation: solution.rotations[i] })) };
    recordState(save,mission,state);
    assert.equal(save.records[mission.id].best,mission.target);
    if (index + 1 < MISSIONS.length) assert.equal(isUnlocked(save,index+1),true);
  }
});
test('v1 layout, turns and best migrate to the exact original board; unrelated boards earn no fake clear', () => {
  const old = JSON.stringify({version:1,rotations:[0,0,0,1,1,2,2,3],turns:7,best:7});
  const save = parseCampaign(null,old);
  assert.equal(save.active,'factory-loop'); assert.equal(save.legacyImported,true);
  assert.equal(save.records['factory-loop'].best,7); assert.equal(save.records['first-dispatch'].best,null);
  assert.equal(restoreMission(save,MISSIONS[1]).turns,7); assert.equal(trace(MISSIONS[1],restoreMission(save,MISSIONS[1]).tiles).outcome,'success');
  assert.deepEqual(MISSIONS.map((_,i) => isUnlocked(save,i)),[true,true,true]);
  const unsolved = parseCampaign(null,JSON.stringify({version:1,rotations:STAGE.tiles.map(t=>t.rotation),turns:3,best:null}));
  assert.deepEqual(MISSIONS.map((_,i) => isUnlocked(unsolved,i)),[true,true,false]);
});
test('v2 records round trip independently; reset/replay preserve earned best', () => {
  const save = parseCampaign(null); save.records['first-dispatch'].best=4; save.active='factory-loop';
  let state = reduce(createState(MISSIONS[1]),{type:'rotate',id:'a'},MISSIONS[1]); recordState(save,MISSIONS[1],state);
  const roundtrip = parseCampaign(JSON.stringify(save)); assert.deepEqual(roundtrip,save);
  assert.equal(restoreMission(roundtrip,MISSIONS[1]).turns,1);
  recordState(save,MISSIONS[0],reduce(createState(MISSIONS[0]),{type:'reset'},MISSIONS[0]));
  assert.equal(save.records['first-dispatch'].best,4); assert.equal(save.records['factory-loop'].turns,1);
});
test('corrupt individual layouts do not erase valid records or unlock a locked active stage', () => {
  for (const raw of [null,'{','null','[]','{"version":9}']) assert.equal(parseCampaign(raw).active,'first-dispatch');
  const save = parseCampaign(null); save.active='read-the-inlet';
  const broken: any = save; broken.records['factory-loop']={rotations:[8],turns:-1,best:-2};
  broken.records['first-dispatch'].best=4;
  const parsed=parseCampaign(JSON.stringify(broken)); assert.equal(parsed.active,'first-dispatch');
  assert.deepEqual(restoreMission(parsed,MISSIONS[1]),createState(MISSIONS[1])); assert.equal(parsed.records['first-dispatch'].best,4);
  for (const invalid of [-1,4,1.5,null,'1']) {
    const fresh:any=parseCampaign(null);fresh.records['first-dispatch'].rotations[0]=invalid;
    assert.deepEqual(restoreMission(parseCampaign(JSON.stringify(fresh)),MISSIONS[0]),createState(MISSIONS[0]));
  }
});
