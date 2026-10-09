import test from 'node:test';
import assert from 'node:assert/strict';
import { advance, BLOCKS, COURSES, createState, GATES, KNOTS, queueTurn, roadX, collision, STEP, type State } from '../../../src/games/prototypes/alpine/model';
import { mergeRecords, parseProgress, precision, recordClear, serializeProgress, unlocked } from '../../../src/games/prototypes/alpine/progress';

function drive(course: number, trigger = 2, dt = STEP) {
  const s=createState(course);s.phase='playing';let sent=-1;
  for(let i=0;i<5000&&s.phase==='playing';i++) {
    const gate=COURSES[course].gates[s.gate];
    if(gate&&gate.z-s.z<=trigger&&sent!==s.gate){assert.ok(queueTurn(s,gate.direction));sent=s.gate;}
    advance(s,dt);
  }
  return s;
}
test('first course references the original authored data and keeps the same50m run',()=>{
  assert.equal(COURSES[0].gates,GATES);assert.equal(COURSES[0].knots,KNOTS);assert.equal(COURSES[0].blocks,BLOCKS);
  assert.deepEqual(GATES,[{z:10,direction:-1},{z:18,direction:1},{z:30,direction:1},{z:38,direction:-1}]);
  assert.deepEqual(KNOTS,[{z:-8,x:0},{z:10,x:0},{z:18,x:-8},{z:30,x:-8},{z:38,x:0},{z:58,x:0}]);
  assert.deepEqual(BLOCKS,[{x:0,z:13,halfX:.9,halfZ:.7},{x:-11,z:21,halfX:.9,halfZ:.7},{x:-8,z:33,halfX:.9,halfZ:.7},{x:3,z:41,halfX:.9,halfZ:.7}]);
  assert.ok(Math.abs(drive(0).time-12.5)<STEP);
});
test('all three courses clear at early, target and late inputs across10–120Hz',()=>{
  for(let course=0;course<COURSES.length;course++)for(const dt of [.1,.075,.05,1/60,STEP])for(const trigger of [4.8,2,.45]) {
    const s=drive(course,trigger,dt);assert.equal(s.phase,'clear');assert.equal(s.z,50);assert.ok(Math.abs(s.x)<1e-8);
    assert.equal(precision(s),trigger===2?100:0);
  }
});
test('every authored centerline has full footprint clearance and separated cue windows',()=>{
  for(const [course,data] of COURSES.entries()) {
    for(let z=0;z<=50;z+=.02)assert.equal(collision(roadX(z,course),z,course),null,`${course}/${z}`);
    for(let i=1;i<data.gates.length;i++)assert.ok(data.gates[i].z-data.gates[i-1].z>=5);
    assert.equal(roadX(50,course),0);
  }
});
test('repeated inputs and pause cannot improve the first-input timing latch',()=>{
  const s=createState();s.phase='playing';s.z=5.2;queueTurn(s,1);const first=s.firstInput;
  s.phase='paused';s.queued=null;advance(s,.1);assert.equal(s.firstInput,first);
  s.phase='playing';s.z=8;for(let i=0;i<20;i++)queueTurn(s,-1);assert.equal(s.firstInput,first);
  s.z=10-4*STEP;advance(s);assert.equal(s.precise,0);assert.equal(s.firstInput,null);assert.equal(s.heading,-1);
});
test('late direction correction retains target timing, wrong execution never awards it',()=>{
  for(const correct of [false,true]) {
    const s=createState();s.phase='playing';s.z=8;queueTurn(s,1);if(correct)queueTurn(s,-1);
    s.z=10-4*STEP;advance(s);assert.equal(s.precise,correct?1:0);advance(s);assert.equal(s.precise,correct?1:0);
  }
});
test('records require a completed run and are awarded only once with nondecreasing precision',()=>{
  const {save}=parseProgress(null,null),s=drive(0);assert.equal(recordClear(save,s),true);assert.equal(recordClear(save,s),false);
  const slower=drive(0,4.8);assert.equal(recordClear(save,slower),true);assert.deepEqual(save.records[0],{clears:2,best:100});
  for(const phase of ['ready','playing','paused','failed'] as State['phase'][]) {
    const fail=createState();fail.phase=phase;fail.precise=4;assert.equal(recordClear(save,fail),false);
  }
  assert.deepEqual(save.records[0],{clears:2,best:100});assert.equal(createState().precise,0);
});
test('legacy clears unlock onlycourse2 and do not invent historical precision',()=>{
  const legacy='{"clears":7,"muted":false}',{save,writable}=parseProgress(null,legacy);
  assert.ok(writable);assert.deepEqual(save.records,[{clears:7,best:null},{clears:0,best:null},{clears:0,best:null}]);assert.equal(save.muted,false);
  assert.ok(unlocked(save,0));assert.ok(unlocked(save,1));assert.equal(unlocked(save,2),false);assert.equal(unlocked(save,3),false);
  recordClear(save,drive(1));assert.ok(unlocked(save,2));assert.equal(legacy,'{"clears":7,"muted":false}');
});
test('stable-ID serialization roundtrips; partial and malformed records preserve legacy clears',()=>{
  const {save}=parseProgress(null,'{"clears":3}');recordClear(save,drive(1));
  assert.deepEqual(parseProgress(serializeProgress(save),null).save,save);
  for(const raw of [null,'{','[]','{"version":2,"records":{"long-return":{"clears":2,"best":50}}}']) {
    assert.equal(parseProgress(raw,'{"clears":3}').save.records[0].clears,3);
  }
  const bad=parseProgress('{"version":2,"records":{"mountain-pass":{"clears":-1,"best":101},"long-return":{"clears":0,"best":100}}}',null).save;
  assert.deepEqual(bad.records,[{clears:0,best:null},{clears:0,best:null},{clears:0,best:null}]);
});
test('newer saves are read-only and conservative merge never lowers another tab records',()=>{
  assert.equal(parseProgress('{"version":3,"records":{}}',null).writable,false);
  const a=parseProgress(null,'{"clears":1}').save,b=parseProgress(null,'{"clears":5}').save;
  recordClear(b,drive(1));mergeRecords(a,b);assert.equal(a.records[0].clears,5);assert.equal(a.records[1].best,100);
  mergeRecords(a,parseProgress(null,null).save);assert.equal(a.records[1].best,100);
});
test('invalid course indices clamp safely',()=>{
  assert.equal(createState(-1).course,0);assert.equal(createState(Infinity).course,0);assert.equal(createState(999).course,2);
});
