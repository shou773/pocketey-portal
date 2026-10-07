import test from 'node:test';
import assert from 'node:assert/strict';
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
