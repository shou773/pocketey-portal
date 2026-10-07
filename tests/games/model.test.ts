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
  const s = createState('amber', 0); s.x = 8.3; step(s,{axis:1,jump:false}); step(s,{axis:1,jump:true}); assert.equal(s.jumps,1);
  const late = createState('amber', 0); late.x = 8.3; for(let i=0;i<20;i++) step(late,{axis:1,jump:false}); step(late,{axis:1,jump:true}); assert.equal(late.jumps,0);
});
test('buffered jump launches on landing, pressing in air does not double jump', () => {
  const s=createState('amber',0); step(s,{axis:0,jump:true}); step(s,{axis:0,jump:true}); assert.equal(s.jumps,1);
  let armed=false; for(let i=0;i<100;i++){const queue=s.y<.35&&s.vy<0&&!armed;if(queue)armed=true;step(s,{axis:0,jump:queue});if(Number(s.jumps)===2)break;}assert.equal(s.jumps,2);
});
test('fall and pillar collision fail, raised-platform sides are solid',()=>{
  const s=createState('orbit',1); for(let i=0;i<400;i++)step(s,{axis:0,jump:false});assert.equal(s.status,'dead');
  const fall=createState('amber',0);for(let i=0;i<500;i++)step(fall,{axis:1,jump:false});assert.equal(fall.status,'dead');
  const wall=createState('amber',1);wall.x=8.4;for(let i=0;i<10;i++)step(wall,{axis:1,jump:false});assert.ok(wall.x<8.7);
});
test('all stages are feasible with ordinary movement and jumps in simulation',()=>{
 for(const kind of ['orbit','amber'] as const)for(let level=0;level<3;level++){
  const s=createState(kind,level), stage=stages[kind][level];let lastJump=-10;
  for(let tick=0;tick<10000&&s.status==='running';tick++){
   const tile=stage.platforms.find(p=>s.x>=p.a-.23&&s.x<=p.b+.23);
   const gap=!!tile&&tile.b<stage.length&&tile.b-s.x< (kind==='orbit'?1.5:1.0)&&tile.b-s.x>-.15;
   const spike=kind==='amber'&&stage.hazards.some(h=>h.x-s.x<1.65&&h.x-s.x>0);
   let axis=1;
   if(kind==='orbit'){const h=stage.hazards.find(h=>h.x>s.x-1.0);const target=h&&h.x-s.x<10?(h.z>=0?-2.4:2.4):0;axis=Math.abs(target-s.z)<.06?0:Math.sign(target-s.z);}
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
