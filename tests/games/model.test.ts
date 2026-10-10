import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { orbitFailure } from '../../src/games/orbit-guidance';
import { createState, step, stages, cleanSave, DT } from '../../src/games/model';

test('fixed-step accumulator yields same movement and jump at 30/60/120 Hz', () => {
  const results = [30, 60, 120].map(hz => {
    const s = createState('orbit', 0); let accumulator = 0, tick = 0;
    for (let f = 0; f < hz * 2; f++) { accumulator += 1 / hz; while (accumulator + 1e-9 >= DT) { step(s, {axis: 0, jump: tick === 120}); accumulator -= DT; tick++; } }
    return s;
  });
  assert.deepEqual(results[0], results[1]); assert.deepEqual(results[1], results[2]); assert.equal(results[0].jumps, 1); assert.ok(Math.abs(results[0].x - 14) < .00001);
});
test('coyote jump after leaving edge works, late jump cannot fly', () => {
  const s = createState('amber', 0); s.x = stages.amber[0].platforms[0].b+.3; step(s,{axis:1,jump:false}); step(s,{axis:1,jump:true}); assert.equal(s.jumps,1);
  const late = createState('amber', 0); late.x = stages.amber[0].platforms[0].b+.3; for(let i=0;i<20;i++) step(late,{axis:1,jump:false}); step(late,{axis:1,jump:true}); assert.equal(late.jumps,0);
});
test('buffered jump launches on landing, pressing in air does not double jump', () => {
  const s=createState('amber',0); step(s,{axis:0,jump:true}); step(s,{axis:0,jump:true}); assert.equal(s.jumps,1);
  let armed=false; for(let i=0;i<100;i++){const queue=s.y<.35&&s.vy<0&&!armed;if(queue)armed=true;step(s,{axis:0,jump:queue});if(Number(s.jumps)===2)break;}assert.equal(s.jumps,2);
});
test('fall and pillar collision fail, raised-platform sides are solid',()=>{
  const s=createState('orbit',1); for(let i=0;i<400;i++)step(s,{axis:0,jump:false});assert.equal(s.status,'dead');
  const fall=createState('amber',0);fall.x=(stages.amber[0].platforms[0].b+stages.amber[0].platforms[1].a)/2;for(let i=0;i<500;i++)step(fall,{axis:0,jump:false});assert.equal(fall.status,'dead');assert.ok(fall.y<-4);
  const wall=createState('amber',1);wall.x=stages.amber[1].platforms[1].a-.3;for(let i=0;i<10;i++)step(wall,{axis:1,jump:false});assert.ok(wall.x<stages.amber[1].platforms[1].a);
});
test('all stages are feasible with ordinary movement and jumps in simulation',()=>{
 for(const kind of ['orbit','amber'] as const)for(let level=0;level<3;level++){
  const s=createState(kind,level), stage=stages[kind][level];let lastJump=-10;
  for(let tick=0;tick<10000&&s.status==='running';tick++){
   const tile=stage.platforms.find(p=>s.x>=p.a-.23&&s.x<=p.b+.23);
   const gap=!!tile&&tile.b<stage.length&&tile.b-s.x< (kind==='orbit'?1.1:1.0)&&tile.b-s.x>-.15;
   const spike=kind==='amber'&&stage.hazards.some(h=>h.x-s.x<(tile && tile.b-h.x<.9?1.35:1.65)&&h.x-s.x>0);
   let axis=1;
   if(kind==='orbit'){const h=stage.hazards.find(h=>h.x+h.d/2+.3>s.x);const target=h&&h.x-s.x<12?(h.z>=0?-1.85:1.85):0;axis=Math.abs(target-s.z)<.06?0:Math.sign(target-s.z);}
   const jump=(gap||spike)&&s.grounded&&s.time-lastJump>.3;if(jump)lastJump=s.time;step(s,{axis,jump});
  }
  assert.equal(s.status,'clear',`${kind}/${level} x=${s.x} y=${s.y} z=${s.z}`);
 }
});
test('save sanitation tolerates corrupt values and bounds unlocks',()=>{
 for(const raw of [null,{},[],"bad",7])assert.equal(cleanSave(raw).orbit.unlocked,1);
 const save=cleanSave({sound:'yes',orbit:{unlocked:99,best:[-1,Infinity,'bad']},amber:{unlocked:NaN,best:null}});
 assert.equal(save.sound,false);assert.equal(save.orbit.unlocked,3);assert.deepEqual(save.orbit.best,[null,null,null]);assert.equal(save.amber.unlocked,1);
});

test('Orbit side pillars block fixed-edge bypasses while alternating routes remain feasible',()=>{
 for(const stage of [1,2])for(const target of [-3.5,3.5]){
  const s=createState('orbit',stage);let lastJump=-10;
  for(let tick=0;tick<5000&&s.status==='running';tick++){
   const tile=stages.orbit[stage].platforms.find(p=>s.x>=p.a-.23&&s.x<=p.b+.23);
   const jump=!!tile&&tile.b<stages.orbit[stage].length&&tile.b-s.x<1.5&&tile.b-s.x>-.15&&s.grounded&&s.time-lastJump>.3;
   if(jump)lastJump=s.time;
   step(s,{axis:Math.abs(s.z-target)<.03?0:Math.sign(target-s.z),jump});
  }
  assert.equal(s.status,'dead');assert.ok(s.y>=0,'must hit a side pillar, not fall off the road');
 }
});


test('course refresh retains legacy records and separates challenge records',()=>{
 const save=cleanSave({version:1,sound:true,orbit:{unlocked:3,best:[13,16,18]},amber:{unlocked:2,best:[10,null,null]}});
 assert.equal(save.orbit.unlocked,3);assert.equal(save.amber.unlocked,2);assert.equal(save.sound,true);
 assert.deepEqual(save.orbit.best,[13,16,18]);assert.deepEqual(save.orbit.challengeBest,[null,null,null]);
 const recorded={...save,orbit:{...save.orbit,challengeBest:[20,null,null]}};const reopened=cleanSave(JSON.parse(JSON.stringify(recorded)));
 assert.deepEqual(reopened.orbit.best,[13,16,18]);assert.deepEqual(reopened.orbit.challengeBest,[20,null,null]);
});

test('each gap has a usable running-jump window, including edge-spike combinations',()=>{
 for(const kind of ['orbit','amber'] as const)for(let index=0;index<3;index++){
  const level=stages[kind][index];
  for(let i=0;i<level.platforms.length-1;i++){
   const from=level.platforms[i],to=level.platforms[i+1];let successful=0;
   const edgeSpike=kind==='amber'?level.hazards.find(h=>h.x>from.b-3&&h.x<from.b):undefined;
   for(let n=0;n<=31;n++){
    const x=from.b-3+n*.1;
    if(edgeSpike && x>=edgeSpike.x-edgeSpike.d/2-.2)continue; // Cannot spawn beyond a spike.
    const s=createState(kind,index);s.x=x;s.y=from.y;
    for(let tick=0;tick<240&&s.status==='running';tick++){
     step(s,{axis:kind==='amber'?1:0,jump:tick===0});
     if(tick>1&&s.grounded&&s.x>=to.a-.22){successful++;break;}
    }
   }
   assert.ok(successful>=6,`${kind}/${index+1} gap${i+1}: ${successful} feasible 0.1m takeoff samples`);
  }
 }
});

test('Orbit observes actual pillar deaths and both gap and lateral falls without changing the state',()=>{
  for(let course=0;course<3;course++)for(let target=0;target<stages.orbit[course].hazards.length;target++){
    const s=createState('orbit',course),level=stages.orbit[course];let input={axis:0,jump:false},lastJump=-10;
    for(let n=0;n<4000&&s.status==='running';n++){
      if(n%6===0){const index=level.hazards.findIndex(h=>h.x+h.d/2+.3>s.x),h=level.hazards[index];
        const z=h&&h.x-s.x<12?(index===target?h.z:(h.z>=0?-1.85:1.85)):0;
        const tile=level.platforms.find(p=>s.x>=p.a-.23&&s.x<=p.b+.23);
        const jump=!!tile&&tile.b<level.length&&tile.b-s.x<1.1&&tile.b-s.x>-.15&&s.grounded&&s.time-lastJump>.3;
        if(jump)lastJump=s.time;input={axis:Math.abs(z-s.z)<.14?0:Math.sign(z-s.z),jump};}
      step(s,input);input.jump=false;
    }
    assert.equal(s.status,'dead');const before={...s};assert.equal(orbitFailure(s),'pillar');assert.deepEqual(s,before);
    assert.ok(Math.abs(s.x-level.hazards[target].x)<.7);
  }
  for(const lateral of [false,true]){
    const s=createState('orbit',0);while(s.status==='running'&&s.time<10){const h=stages.orbit[0].hazards.find(h=>h.x+h.d/2+.3>s.x),z=h&&h.x-s.x<12?(h.z>=0?-1.85:1.85):0;step(s,{axis:lateral?1:Math.abs(z-s.z)<.14?0:Math.sign(z-s.z),jump:false});}
    assert.equal(s.status,'dead');assert.equal(orbitFailure(s),'fall');assert.ok(s.y<-4);
  }
});
test('Orbit observed help stays neutral for unknown terminal states and excludes Amber and non-results',()=>{
  const s=createState('orbit',0);assert.equal(orbitFailure(s),null);s.status='clear';assert.equal(orbitFailure(s),null);s.status='dead';assert.equal(orbitFailure(s),null);
  s.kind='amber';s.y=-5;assert.equal(orbitFailure(s),null);
});
test('retry help and compact header are the only changes in the five reviewed runtime files',()=>{
  { let source=readFileSync("src/games/app.ts",'utf8');
    {const fragment="import { orbitFailure } from './orbit-guidance';\n";assert.equal(source.split(fragment).length,2);source=source.replace(fragment,"");}
    {const fragment="  // Observed Orbit retry help. No movement, record or lifecycle changes.\n  function orbitRetryCopy() {\n    const reason=orbitFailure(state);\n    if(reason==='pillar')return tr('柱にぶつかりました。左右に動いて柱をよけよう。', 'You hit a pillar. Steer left or right to go around it.');\n    if(reason==='fall')return tr('道から落ちました。次の足場を確かめよう。すき間を越えるときは、光るふちの近くでジャンプ。', 'You fell off the path. Check the next platform. When crossing a gap, jump near its glowing edge.');\n    return tr('進む先の柱と足場を確かめて、もう一度。', 'Check the pillars and platforms ahead, then try again.');\n  }\n  // End observed Orbit retry help.\n";assert.equal(source.split(fragment).length,2);source=source.replace(fragment,"");}
    {const fragment="orbitRetryCopy()";assert.equal(source.split(fragment).length,2);source=source.replace(fragment,"tr('すき間の光るふちでジャンプ。左右の足場も確かめよう。', 'Jump near a glowing gap edge. Check the next platform, too.')");}
    assert.equal(createHash('sha256').update(source).digest('hex'),"23bbc6f40c28cb322b0e6d82594b7e57617aee4fb8130696a057fd3be596a9aa"); }
  { let source=readFileSync("src/games/game.css",'utf8');
    {const fragment="\n/* Compact shared header: preserve full labels, 44px targets and focus room. */\n@media(max-width:380px){\n .game-bar{padding-left:max(8px,env(safe-area-inset-left));padding-right:max(8px,env(safe-area-inset-right));gap:6px}\n .game-bar>div{gap:6px}\n .game-bar button{min-width:44px;min-height:44px;padding-inline:6px}\n}\n/* End compact shared header. */\n";assert.equal(source.split(fragment).length,2);source=source.replace(fragment,"");}
    assert.equal(createHash('sha256').update(source).digest('hex'),"ffc4cadd837af1003cd30a372468704b9147aad48e4bd57c7b9b6cf453b600b8"); }
  { let source=readFileSync("src/games/prototypes/shooter/briefing.ts",'utf8');
    {const fragment="import {STAGES,type State} from './model';";assert.equal(source.split(fragment).length,2);source=source.replace(fragment,"import type {State} from './model';");}
    {const fragment="\n/** Only the observed deadline with shields and a living boss gets timeout advice. */\nexport function bossTimedOut(s:State) {\n return s.stage===2&&s.status==='lost'&&s.hp>0&&s.time+1e-9>=STAGES[2].duration&&s.enemies.some(e=>e.kind==='boss'&&e.hp>0);\n}\n";assert.equal(source.split(fragment).length,2);source=source.replace(fragment,"");}
    assert.equal(createHash('sha256').update(source).digest('hex'),"800a8674ab7888c79df2d605735b8d65bacb1145a7eb14a904ad638568f55721"); }
  { let source=readFileSync("src/games/prototypes/shooter/app.ts",'utf8');
    {const fragment="import {bossIncoming,bossTimedOut} from './briefing';";assert.equal(source.split(fragment).length,2);source=source.replace(fragment,"import {bossIncoming} from './briefing';");}
    {const fragment="(bossTimedOut(s)?tr('時間切れです。弾をよける合間にボスと左右の位置を合わせ、自動射撃を当てよう。','Time ran out. Line up with the boss between dodges so your auto-fire hits.'):tr('赤い弾は小さく横に避ける。予告線は1.3秒後に発射。','Sidestep red bullets. Warning lanes fire after 1.3 seconds.'))";assert.equal(source.split(fragment).length,2);source=source.replace(fragment,"tr('赤い弾は小さく横に避ける。予告線は1.3秒後に発射。','Sidestep red bullets. Warning lanes fire after 1.3 seconds.')");}
    assert.equal(createHash('sha256').update(source).digest('hex'),"64d1b3659130cb281c5726b1e0f84ee1f0f5ac223a6ae0f068e0f417c07b6081"); }
  assert.equal(createHash('sha256').update(readFileSync('src/games/orbit-guidance.ts')).digest('hex'),"db71e2edd6a61717b053fe4d405ed3511e5ef59a580d072beda0cd67d0f939f5");
});
