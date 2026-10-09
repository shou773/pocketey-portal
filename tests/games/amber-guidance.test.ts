import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { amberFailure, crossedFirstSpike, showAmberCoach } from '../../src/games/amber-guidance';
import { createState, stages, step, DT } from '../../src/games/model';
test('original stage geometry and hazards remain byte-for-byte serialized data',()=>{
  assert.equal(createHash('sha256').update(JSON.stringify(stages)).digest('hex'),'ef69e447ad37527d07305e5934a983233fc8075206ea64f10d6fc2165c358552');
});
test('every actual spike collision identifies the struck hazard without changing state',()=>{
  let edge=0,ordinary=0;
  for(const [index,level] of stages.amber.entries())for(const h of level.hazards){
    const s=createState('amber',index);s.x=h.x;s.y=h.y;step(s,{axis:0,jump:false});
    assert.equal(s.status,'dead');const before={...s},reason=amberFailure(s);
    const expected=index===2&&[19.4,40.4,63.4].includes(h.x)?'edge-spike':'spike';
    assert.equal(reason,expected);assert.deepEqual(s,before);if(reason==='edge-spike')edge++;else ordinary++;
  }
  assert.equal(edge,3);assert.equal(ordinary,16);
});
test('actual falls get neutral fall help; unobserved causes and Orbit return null',()=>{
  for(let index=0;index<3;index++){
    const s=createState('amber',index);s.x=stages.amber[index].platforms[0].b+1;s.y=-3.99;s.vy=-5;s.grounded=false;
    step(s,{axis:0,jump:false});assert.equal(s.status,'dead');assert.equal(amberFailure(s),'fall');
  }
  const unknown=createState('amber',0);unknown.status='dead';assert.equal(amberFailure(unknown),null);
  const orbit=createState('orbit',0);orbit.status='dead';orbit.y=-5;assert.equal(amberFailure(orbit),null);
});
test('first-spike lesson does not time out for a player who stops to plan',()=>{
  const s=createState('amber',0);for(let i=0;i<1200;i++)step(s,{axis:0,jump:false});
  assert.ok(s.time>9);assert.equal(s.x,0);assert.equal(showAmberCoach(s,false),true);assert.equal(crossedFirstSpike(s),false);
});
test('lesson crossing requires a real grounded landing beyond the spike',()=>{
  const s=createState('amber',0);let crossed=false;
  for(let i=0;i<400&&s.status==='running';i++) {
    step(s,{axis:1,jump:s.grounded&&s.x>=2.2&&s.x<3});
    if(s.x>4.65&&!s.grounded)assert.equal(crossedFirstSpike(s),false);
    if(crossedFirstSpike(s)){crossed=true;break;}
  }
  assert.ok(crossed);assert.equal(s.status,'running');assert.ok(s.x>4.65);assert.equal(s.grounded,true);
  assert.equal(showAmberCoach(s,true),false);
});
test('coach is excluded from other stages, Orbit and terminal states',()=>{
  for(const kind of ['amber','orbit'] as const)for(let index=0;index<3;index++){
    const s=createState(kind,index);assert.equal(showAmberCoach(s,false),kind==='amber'&&index===0);
    s.status='dead';assert.equal(showAmberCoach(s,false),false);assert.equal(crossedFirstSpike(s),false);
    s.status='clear';assert.equal(showAmberCoach(s,false),false);
  }
  assert.equal(DT,1/120);
});
