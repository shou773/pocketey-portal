import test from 'node:test';
import assert from 'node:assert/strict';
import {MODES,createRun,step,action,partPositions,cyclePart,lighten,growthStats,circleRect,segmentDistance,finish,emptyProgress,sanitizeProgress,bankRun,upgrade} from '../dist/lab/sim.mjs';

const hostile=(x,y)=>({x,y,vx:0,vy:0,r:7,owner:'enemy',damage:0,life:5});
test('guard reflects a nearby bullet, rewards timing and protects life',()=>{
  const s=createRun('reflect');action(s);s.bullets.push(hostile(s.player.x,s.player.y-25));step(s,{},.016);
  assert.equal(s.bullets[0].owner,'player');assert.equal(s.reflections,1);assert.equal(s.perfects,1);assert.equal(s.player.hp,7);assert.equal(s.bullets[0].damage,30);
  const later=createRun('reflect');action(later);later.guard=.1;later.bullets.push(hostile(later.player.x,later.player.y-25));step(later,{},.016);assert.equal(later.perfects,0);assert.equal(later.bullets[0].damage,20);
});
test('unguarded hits cost life once during invulnerability; cooldown rejects spam',()=>{
  const s=createRun('reflect');s.player.invulnerable=0;s.bullets.push(hostile(s.player.x,s.player.y),hostile(s.player.x,s.player.y));step(s,{},.016);assert.equal(s.player.hp,6);assert.equal(s.damageTaken,1);
  assert.equal(action(s),true);assert.equal(action(s),false);
});
test('the two slime forms change the timing window and return damage',()=>{
  const a=createRun('reflect',0),b=createRun('reflect',1);action(a);action(b);assert.ok(a.guard>b.guard);
  b.bullets.push(hostile(b.player.x,b.player.y-10));step(b,{},.016);assert.equal(b.bullets[0].damage,54);
});
test('returning yoyo follows the current player and hits harder than outward flight',()=>{
  const setup=phase=>{const s=createRun('yoyo');s.player.x=700;s.player.y=162;s.weapon={x:425,y:162,vx:400,vy:0,r:15,phase,age:.3,hitClock:0,angle:0};return s;};
  const back=setup('return'),out=setup('out');step(back,{},.016);step(out,{},.016);assert.ok(back.score>out.score);assert.equal(back.returnHits,1);assert.equal(out.returnHits,0);
  const s=createRun('yoyo');action(s);s.weapon.phase='return';s.weapon.x=300;s.weapon.y=300;s.player.x=700;s.player.y=400;const before={x:s.weapon.x,y:s.weapon.y};step(s,{},.016);assert.ok(s.weapon.x>before.x);assert.ok(s.weapon.y>before.y);
});
test('yoyo can be recalled and ring bounces from a wall',()=>{
  const s=createRun('yoyo',1);action(s);s.weapon.age=.3;assert.equal(action(s),true);assert.equal(s.weapon.phase,'return');
  s.weapon.phase='out';s.weapon.x=899;s.weapon.vx=400;step(s,{},.016);assert.ok(s.weapon.vx<0);assert.ok(s.weapon.x<=880);
});
test('scrap parts follow body orientation, cycle and block locally',()=>{
  const s=createRun('scrap');const first=partPositions(s);s.player.angle+=Math.PI/2;const turned=partPositions(s);assert.notDeepEqual(first[0],turned[0]);
  cyclePart(s,0);assert.equal(s.parts[0],'shield');cyclePart(s,0);assert.equal(s.parts[0],'spike');cyclePart(s,0);assert.equal(s.parts[0],'cannon');
  const shield=partPositions(s)[2];s.bullets.push(hostile(shield.x,shield.y));s.partClock=0;step(s,{},.016);assert.equal(s.bullets.length,2);assert.ok(s.bullets.every(b=>b.owner==='player'));assert.equal(s.player.hp,7);
});
test('growth trades speed and clearance for damage; slimming preserves persistent upgrades',()=>{
  const small=growthStats(0,0),large=growthStats(0,10),slender=growthStats(1,10);assert.ok(large.speed<small.speed);assert.ok(large.damage>small.damage);assert.ok(large.radius>slender.radius);assert.ok(slender.speed>large.speed);
  const gate={x:0,y:0,w:300,h:42};assert.equal(circleRect({x:340,y:21},small.radius,gate),false);assert.equal(circleRect({x:340,y:21},large.radius,gate),true);
  const s=createRun('grow',0,2);s.growth=8;lighten(s);assert.equal(s.growth,6);assert.equal(s.level,2);
});
test('eating grows the body, attack can hit boss, walls prevent crossing',()=>{
  const s=createRun('grow');s.food=[{x:s.player.x+5,y:s.player.y,r:7}];action(s);assert.equal(s.growth,1);assert.equal(s.food.length,0);
  s.cooldown=0;s.player.x=s.boss.x;s.player.y=s.boss.y+65;action(s);assert.ok(s.boss.hp<s.boss.maxHp);
  const blocked=createRun('grow');blocked.player.x=450;blocked.player.y=350;step(blocked,{y:-1},.05);assert.equal(blocked.player.y,350);
});
test('fast bullets hit along their path rather than tunneling between frames',()=>{
  assert.equal(segmentDistance({x:20,y:10},{x:0,y:10},{x:40,y:10}),0);
  const s=createRun('reflect');s.player.invulnerable=0;s.bullets.push({...hostile(s.player.x-100,s.player.y),vx:4000});step(s,{},.05);assert.equal(s.player.hp,6);
});
test('rewards are banked once and upgrades spend materials with a cap',()=>{
  const p=emptyProgress(),s=createRun('reflect');assert.equal(bankRun(p,s),false);finish(s,'win');assert.equal(bankRun(p,s),true);assert.equal(bankRun(p,s),false);assert.equal(p.modes.reflect.materials,6);assert.equal(p.modes.reflect.wins,1);
  assert.equal(upgrade(p,'reflect'),true);assert.equal(upgrade(p,'reflect'),true);assert.equal(upgrade(p,'reflect'),false);assert.equal(p.modes.reflect.level,2);p.modes.reflect.materials=99;assert.equal(upgrade(p,'reflect'),true);assert.equal(upgrade(p,'reflect'),false);
});
test('local-save corruption is bounded and unrelated data is discarded',()=>{
  const p=sanitizeProgress({version:1,modes:{reflect:{materials:-100,level:99,plays:'bad',memo:'x'.repeat(900),rating:'<script>'}}});assert.equal(p.modes.reflect.materials,0);assert.equal(p.modes.reflect.level,3);assert.equal(p.modes.reflect.plays,0);assert.equal(p.modes.reflect.memo.length,300);assert.equal(p.modes.reflect.rating,'');
  assert.deepEqual(sanitizeProgress(null),emptyProgress());
});
test('all eight mode/form combinations finish with finite positions and bounded life',()=>{
  for(const m of MODES)for(let form=0;form<2;form++){
    const s=createRun(m.id,form,1,1234);for(let i=0;i<6000&&s.status==='running';i++)step(s,{x:Math.cos(i/130),y:Math.sin(i/130),action:i%31===0,lighten:i%800===0},1/60);
    assert.equal(s.status,'ended',m.id+' '+form);assert.ok(Number.isFinite(s.player.x)&&Number.isFinite(s.player.y));assert.ok(s.player.hp>=0);assert.ok(s.boss.hp>=0);assert.ok(s.bullets.length<100);assert.ok(s.endedReward>0);
  }
});
