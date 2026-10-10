import test from 'node:test';
import assert from 'node:assert/strict';
import { advance, BLOCKS, CAR_HALF, collision, createState, FINISH, GATES, parseSave, queueTurn, roadX, STEP, windowOpen, type State } from '../../../src/games/prototypes/alpine/model';
import { flick } from '../../../src/games/prototypes/alpine/input';

function playing() { const s=createState();s.phase='playing';return s; }
function drive(s: State, dt=STEP) {
  for(let i=0;i<6000&&s.phase==='playing';i++) {
    if(windowOpen(s))queueTurn(s,GATES[s.gate].direction);
    advance(s,dt);
  }
  return s;
}
test('one authored route clears with all four ordinary turn commands',()=>{
  const s=drive(playing());assert.equal(s.phase,'clear');assert.equal(s.gate,4);
  assert.equal(s.z,FINISH);assert.ok(Math.abs(s.x)<1e-8);assert.ok(Math.abs(s.time-12.5)<STEP);
});
test('all early and all last-moment valid commands also clear',()=>{
  for(const threshold of [4.99,.04]) {
    const s=playing();
    for(let i=0;i<6000&&s.phase==='playing';i++) {
      if(GATES[s.gate]&&GATES[s.gate].z-s.z<=threshold)queueTurn(s,GATES[s.gate].direction);
      advance(s);
    }
    assert.equal(s.phase,'clear');
  }
});
test('missed turn hits a block; a wrong turn hits the road edge',()=>{
  const missed=playing();while(missed.phase==='playing')advance(missed);
  assert.equal(missed.reason,'block');assert.ok(missed.z<13);
  const wrong=playing();wrong.z=6;assert.ok(queueTurn(wrong,1));
  while(wrong.phase==='playing')advance(wrong);
  assert.equal(wrong.reason,'edge');
});
test('window boundaries, replacement, no stacking and exact commit line',()=>{
  const s=playing();s.z=4.999;assert.equal(queueTurn(s,-1),false);
  s.z=5;assert.ok(queueTurn(s,1));assert.ok(queueTurn(s,-1));assert.equal(s.heading,0);
  s.z=10-4*STEP;advance(s);assert.equal(s.heading,-1);assert.equal(s.gate,1);assert.equal(s.queued,null);
  assert.equal(queueTurn(s,1),false);
});
test('a held/repeated direction cannot turn beyond the three headings',()=>{
  const s=playing();s.z=17.99;s.x=-7.99;s.heading=-1;s.gate=1;queueTurn(s,-1);advance(s);
  assert.equal(s.heading,-1);
});
test('collision footprints agree at contact boundaries and before the goal',()=>{
  const b=BLOCKS[0];assert.equal(collision(b.x,b.z),'block');
  assert.equal(collision(b.x-b.halfX-CAR_HALF+.001,b.z),'block');
  assert.equal(collision(b.x-b.halfX-CAR_HALF-.001,b.z),null);
  const s=playing();s.z=49.99;s.x=9;advance(s);assert.equal(s.phase,'failed');assert.equal(s.reason,'edge');
});
test('intended path has clearance for the full footprint at every sample',()=>{
  for(let z=0;z<=FINISH;z+=.02)assert.equal(collision(roadX(z),z),null,`z=${z}`);
});
test('state is frozen outside play, retry reconstructs a clean state',()=>{
  for(const phase of ['ready','paused','failed','clear'] as const) {
    const s=createState();s.phase=phase;const before={...s};advance(s);assert.deepEqual(s,before);assert.equal(queueTurn(s,-1),false);
  }
  const failed=playing();failed.phase='failed';failed.x=99;failed.queued=1;
  assert.deepEqual(createState(),{phase:'ready',x:0,z:0,heading:0,gate:0,queued:null,time:0,reason:null,course:0,firstInput:null,precise:0,recorded:false});
});
test('10/30/60/120 Hz simulation advances all pass without tunnelling',()=>{
  for(const dt of [.1,1/30,1/60,STEP])assert.equal(drive(playing(),dt).phase,'clear');
  const s=playing();s.z=11.7;s.gate=1;advance(s,.1);assert.equal(s.reason,'block');
});
test('invalid elapsed time cannot change state; large jumps are bounded',()=>{
  const s=playing();for(const dt of [NaN,Infinity,-1,0])advance(s,dt);assert.equal(s.z,0);
  advance(s,100);assert.ok(s.z<=.401);
});
test('flick rejects taps, vertical scroll, long drags; accepts both directions',()=>{
  assert.equal(flick(-60,4,120),-1);assert.equal(flick(60,4,120),1);
  for(const [dx,dy,ms] of [[27,0,100],[60,80,100],[60,0,601],[0,0,0]])assert.equal(flick(dx,dy,ms),null);
});
test('malformed saves are optional and counts are sanitized',()=>{
  for(const raw of [null,'{','null','[]','{"clears":-5}','{"clears":1.5}'])assert.deepEqual(parseSave(raw),{clears:0,muted:true});
  assert.deepEqual(parseSave('{"clears":2,"muted":false}'),{clears:2,muted:false});
});
