import {readFileSync} from 'node:fs';import {createHash} from 'node:crypto';
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
  assert.equal(save.active, MISSIONS[0].id); assert.deepEqual(MISSIONS.map((_,i) => isUnlocked(save,i)), [true,false,false,false]);
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
  assert.deepEqual(MISSIONS.map((_,i) => isUnlocked(save,i)),[true,true,true,false]);
  const unsolved = parseCampaign(null,JSON.stringify({version:1,rotations:STAGE.tiles.map(t=>t.rotation),turns:3,best:null}));
  assert.deepEqual(MISSIONS.map((_,i) => isUnlocked(unsolved,i)),[true,true,false,false]);
});
test('current records round trip independently; reset/replay preserve earned best', () => {
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
test('route-choice board has exactly two delivered paths with optional 3/5 turn minima',()=>{
 const mission=MISSIONS[3], routes=new Map<string,{count:number;minimum:number}>();
 for(let code=0;code<4**mission.tiles.length;code++){
  const tiles=mission.tiles.map((tile,i)=>({...tile,rotation:(Math.floor(code/4**i)%4) as Direction})),route=trace(mission,tiles);
  if(route.outcome!=='success')continue;
  const key=route.visits.filter(v=>v.tileId).map(v=>v.tileId).join(','),cost=tiles.reduce((n,t,i)=>n+(t.rotation-mission.tiles[i].rotation+4)%4,0),entry=routes.get(key)??{count:0,minimum:Infinity};entry.count++;entry.minimum=Math.min(entry.minimum,cost);routes.set(key,entry);
 }
 assert.deepEqual(Object.fromEntries(routes),{'a,d,e,f':{count:16,minimum:3},'a,b,c,f':{count:16,minimum:5}});
 assert.equal(trace(mission,mission.tiles).outcome,'wrong-entry');assert.deepEqual(solveMission(mission)?.visited,['a','d','e','f']);
 for(const rotations of [[0,3,0,2,1,3],[1,3,0,1,0,2]]){
  let state=createState(mission);for(let i=0;i<rotations.length;i++)while(state.tiles[i].rotation!==rotations[i])state=reduce(state,{type:'rotate',id:state.tiles[i].id},mission);
  state=reduce(reduce(state,{type:'play'},mission),{type:'finish'},mission);assert.equal(state.phase,'success');assert.equal(state.turns,rotations[0]===0?3:5);
 }
});
test('v2 imports every original layout, turn count, best and active ID while mission4 starts unearned',()=>{
 const prior={version:2,active:'read-the-inlet',legacyImported:false,records:Object.fromEntries(MISSIONS.slice(0,3).map((m,i)=>[m.id,{rotations:m.tiles.map(t=>t.rotation),turns:11+i,best:m.target}]))};
 const raw=JSON.stringify(prior),save=parseCampaign(null,null,raw);assert.equal(save.version,3);assert.equal(save.active,prior.active);
 for(const m of MISSIONS.slice(0,3))assert.deepEqual(save.records[m.id],prior.records[m.id]);
 assert.equal(save.records['choose-a-route'].best,null);assert.equal(save.records['choose-a-route'].turns,0);assert.equal(isUnlocked(save,3),true);assert.equal(JSON.stringify(prior),raw);
 prior.records['read-the-inlet'].best=null as any;assert.equal(isUnlocked(parseCampaign(null,null,JSON.stringify(prior)),3),false);
});
test('damaged v3 fields recover valid v2 progress without replacing better v3 records',()=>{
 const previous=parseCampaign(null);previous.records['factory-loop']={rotations:[0,0,0,1,1,2,2,3],turns:11,best:11};previous.legacyImported=true;previous.active='factory-loop';const old=JSON.stringify({...previous,version:2});
 const parsed=parseCampaign(JSON.stringify({version:3,records:{'factory-loop':{rotations:[99],turns:-1,best:null}}}),null,old);assert.deepEqual(parsed.records['factory-loop'],previous.records['factory-loop']);assert.equal(parsed.active,'factory-loop');
 const better=parseCampaign(JSON.stringify({version:3,records:{'factory-loop':{rotations:[0,0,0,1,1,2,2,3],turns:7,best:7}}}),null,old);assert.equal(better.records['factory-loop'].best,7);
});
test('two-way routes record real entry/exit ports for forward and reverse parcel motion',()=>{
 const mission=MISSIONS[3];
 for(const rotations of [[0,3,0,2,1,3],[1,3,0,1,0,2]]){
  const route=trace(mission,mission.tiles.map((tile,i)=>({...tile,rotation:rotations[i] as Direction})));assert.equal(route.outcome,'success');
  const visits=route.visits.filter(v=>v.tileId);assert.equal(visits[0].input,3);assert.equal(visits[0].output,rotations[0]===0?2:0);assert.equal(visits.at(-1)?.input,rotations[0]===0?2:0);assert.equal(visits.at(-1)?.output,1);
 }
});

test('courier palette changes only two paints and the existing bay strip assignment',()=>{
 let source=readFileSync('src/games/prototypes/conveyor/render.ts','utf8');
 assert.equal(source.split("paper: material(0xe1b46a), tape: material(0x286458)").length,2);source=source.replace("paper: material(0xe1b46a), tape: material(0x286458)","paper: material(0xcc9a5e), tape: material(0xf5dfb3)");
 assert.equal(source.split("box(group,materials.tape,side*.035,.695,0,.055,.055,.27,.017);").length,2);source=source.replace("box(group,materials.tape,side*.035,.695,0,.055,.055,.27,.017);","box(group,materials.brass,side*.035,.695,0,.055,.055,.27,.017);");
 assert.equal(createHash('sha256').update(source).digest('hex'),'f26523848444e630146d01589b08df343ebf2e259c74fc7c76c28444a1724576');
});
