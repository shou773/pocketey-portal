import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { STAGES, STEP, advance, createState, track, length } from '../../../src/games/prototypes/ball/model';
import { STAGE_IDS, ORIGINAL_COURSE_COUNT, parseProgress, serializeProgress, stageUnlocked } from '../../../src/games/prototypes/ball/progress';

test('the three existing course definitions are unchanged and the appended rhythms fit the existing length budget',()=>{
  assert.equal(createHash('sha256').update(JSON.stringify(STAGES.slice(0,ORIGINAL_COURSE_COUNT))).digest('hex'),'a4a0570c6898288160c6ea88d23fb97ed9be088eee24b6564f9d22587181de00');
  assert.equal(STAGES.length,STAGE_IDS.length);assert.equal(new Set(STAGE_IDS).size,STAGES.length);
  for(const [index,stage] of STAGES.entries()){
    assert.ok(length(index)<=122);assert.equal(stage.knots[0].z,0);
    stage.knots.forEach((k,i)=>{assert.ok(Number.isFinite(k.x)&&Number.isFinite(k.z)&&k.width>=2.4);if(i)assert.ok(k.z>stage.knots[i-1].z);});
  }
  // Course 4 has three genuine, eight-unit constant-x recovery straights.
  assert.deepEqual([[22,30],[42,50],[62,70]].map(([a,b])=>[track(3,a).x,track(3,b).x]),[[3,3],[-3,-3],[2.8,2.8]]);
  // Course 5 partially unwinds then returns to a second apex on the same side.
  [19,26,34,47,55,63].forEach((z,i)=>assert.ok(Math.abs(track(4,z).x-[-3.2,-1.7,-3.7,3.6,1.8,3.8][i])<1e-12));
});
test('stage selection clamps to the derived count and rejects non-finite input',()=>{
  assert.equal(createState(4).stage,4);assert.equal(createState(999).stage,STAGES.length-1);
  for(const value of [-1,NaN,Infinity,-Infinity])assert.equal(createState(value).stage,0);
});
for(const interval of [.065,.1,.15])for(const stage of [3,4])test(`course${stage+1} remains feasible with ${interval}s discrete observations`,()=>{
  const s=createState(stage);s.phase='playing';let nextObservation=0,input={steer:0,brake:false};
  for(let step=0;step<15000&&s.phase==='playing';step++){
    if(s.time>=nextObservation){
      const road=track(stage,s.z),future=track(stage,s.z+.7),diff=(future.x-road.x)/.7*s.speed+(road.x-s.x)*3-s.vx;
      input={steer:diff>.3?1:diff<-.3?-1:0,brake:road.width<4};nextObservation=s.time+interval;
    }
    advance(s,input,STEP);
  }
  assert.equal(s.phase,'clear');
});
test('legacy bests import unchanged; legacy stage3 clear unlocks only course4',()=>{
  const old=JSON.stringify({best:[10,20,30],muted:false});const save=parseProgress(null,old);
  assert.deepEqual(save.best,[10,20,30,null,null]);assert.equal(save.muted,false);
  assert.deepEqual(STAGES.map((_,i)=>stageUnlocked(save,i)),[true,true,true,true,false]);
  const encoded=JSON.parse(serializeProgress(save));assert.equal(encoded.version,2);assert.deepEqual(encoded.records,{'first-bends':10,'wave-corridor':20,'sky-ridge':30,'breathing-bends':null,'double-apex':null});
  assert.deepEqual(parseProgress(JSON.stringify(encoded)),save);
});
test('fresh/original access and progressive unlock use actual prior course records',()=>{
  const save=parseProgress(null);assert.deepEqual(STAGES.map((_,i)=>stageUnlocked(save,i)),[true,true,true,false,false]);
  save.best[0]=12;save.best[1]=22;assert.equal(stageUnlocked(save,3),false);
  save.best[2]=40;assert.equal(stageUnlocked(save,3),true);assert.equal(stageUnlocked(save,4),false);
  save.best[3]=25;assert.equal(stageUnlocked(save,4),true);
  for(const stage of [-1,5,NaN,1.5])assert.equal(stageUnlocked(save,stage),false);
});
test('stable IDs parse independently of object order and reject invalid per-course times',()=>{
  const save=parseProgress(JSON.stringify({version:2,records:{'double-apex':45,'sky-ridge':30,'wave-corridor':20,'first-bends':10,'breathing-bends':25},muted:false}));
  assert.deepEqual(save.best,[10,20,30,25,45]);
  for(const value of [-1,0,null,'10',Infinity]){
    const parsed=parseProgress(JSON.stringify({version:2,records:{'first-bends':value,'sky-ridge':30}}));
    assert.deepEqual(parsed.best,[null,null,30,null,null]);
  }
});
test('corrupt campaign falls back to untouched legacy records; future versions become read-only',()=>{
  const old='{"best":[10,20,30],"muted":false}';
  for(const raw of ['{','[]','null','{"version":2,"records":[]}'])assert.deepEqual(parseProgress(raw,old).best,[10,20,30,null,null]);
  const future=parseProgress('{"version":3,"records":{"private-future-course":123}}',old);
  assert.equal(future.writable,false);assert.deepEqual(future.best,[10,20,30,null,null]);
  assert.deepEqual(parseProgress(null,'{"version":9,"best":[10,20,30]}').best,[null,null,null,null,null]);
});

test('partial v2 damage retains valid first-three legacy bests and their unlock',()=>{
  const old='{"best":[14.2,27.8,41.2],"muted":false}';
  const saved=parseProgress('{"version":2,"records":{"first-bends":12,"wave-corridor":"broken","sky-ridge":null}}',old);
  assert.deepEqual(saved.best,[12,27.8,41.2,null,null]);assert.equal(stageUnlocked(saved,3),true);assert.equal(stageUnlocked(saved,4),false);
  assert.equal(parseProgress('{"version":2,"records":{"first-bends":99}}',old).best[0],14.2);
});
