import {test} from 'node:test';import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';import {createHash} from 'node:crypto';
import {createState,step,STEP,spawnX,FINAL_SWEEP_SLOTS} from '../../../src/games/prototypes/shooter/model';
import {bossIncoming} from '../../../src/games/prototypes/shooter/briefing';import {chooseLane} from './controller';
test('the full original model is unchanged except for authored initial spawn positions',()=>{
 const source=readFileSync('src/games/prototypes/shooter/model.ts','utf8').replace(/\/\/ Final existing spawn slots[\s\S]*?\/\/ End authored spawn positions\.\n/,'').replace('x:spawnX(s.stage,n),y:11','x:Math.sin(n*2.4)*3,y:11');
 assert.equal(createHash('sha256').update(source).digest('hex'),'2eff2b3b001dced76bcee9aca3394e721eb5181243e920aa8d12efe82365f560');
});
test('each final three existing slots is left/center/right, every earlier spawn uses the original formula',()=>{
 for(let stage=0;stage<3;stage++){for(let n=0;n<25;n++){const index=(FINAL_SWEEP_SLOTS[stage] as readonly number[]).indexOf(n);assert.equal(spawnX(stage,n),index<0?Math.sin(n*2.4)*3:[-2.6,0,2.6][index]);}}
});
test('schedule-only fixture preserves 13/20/16 counts, fan kinds, drift and original last-slot times',()=>{
 const expected=[[24.16666666666657,26.483333333333103,28.799999999999638],[31.883333333332807,33.69999999999937,35.516666666665935],[24.616666666666543,26.433333333333106,28.24999999999967]];
 for(let stage=0;stage<3;stage++){const s=createState(stage),seen=new Set<number>(),spawns:{time:number;n:number;kind:string}[]=[];s.invulnerable=999; // Counting only; ordinary survival is a separate test below.
  while(s.time<(stage===0?31:stage===1?37:29)){step(s,STEP,{x:3.8,y:1.8});for(const e of s.enemies)if(!seen.has(e.id)){seen.add(e.id);const n=Math.floor(s.time/1.8);spawns.push({time:s.time,n,kind:e.kind});assert.equal(e.kind,stage>0&&n%3===0?'fan':'scout');assert.ok(Math.abs(e.vx-Math.cos(n)*.35)<1e-12);assert.ok(Math.abs(e.x-(spawnX(stage,n)+e.vx*STEP))<1e-9);}}
  assert.equal(spawns.length,[13,20,16][stage]);assert.deepEqual(spawns.slice(-3).map(e=>e.n),[...FINAL_SWEEP_SLOTS[stage]]);spawns.slice(-3).forEach((e,i)=>assert.ok(Math.abs(e.time-expected[stage][i])<1e-8));
 }
});
test('ordinary 4HP inputs clear every stage at 100/150/200ms observations, including the beam/boss handoff',()=>{
 for(const cadence of [.1,.15,.2])for(let stage=0;stage<3;stage++){const s=createState(stage);let target=0,next=0;while(s.status==='playing'){if(s.time>=next){target=chooseLane(s);next+=cadence;}step(s,STEP,{x:target,y:1.8});}assert.equal(s.status,'won',`stage${stage+1} at${cadence}s`);assert.ok(s.hp>0);assert.ok(s.time<=48);}
});
test('boss notice has exact simulation bounds and cannot survive a result or appear in a survival stage',()=>{
 const s=createState(2);s.time=28.49;assert.equal(bossIncoming(s),false);s.time=28.5;assert.equal(bossIncoming(s),true);s.time=29.99;assert.equal(bossIncoming(s),true);s.time=30;assert.equal(bossIncoming(s),false);s.time=29;s.status='lost';assert.equal(bossIncoming(s),false);s.status='playing';s.bossSpawned=true;assert.equal(bossIncoming(s),false);s.bossSpawned=false;s.stage=1;assert.equal(bossIncoming(s),false);
});
