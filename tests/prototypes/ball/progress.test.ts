import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { STAGES, STEP, advance, createState, track, length } from '../../../src/games/prototypes/ball/model';
import { STAGE_IDS, ORIGINAL_COURSE_COUNT, parseProgress, serializeProgress, stageUnlocked, mergeProgress } from '../../../src/games/prototypes/ball/progress';

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
  assert.deepEqual(save.best,[10,20,30,null,null,null]);assert.equal(save.muted,false);
  assert.deepEqual(STAGES.map((_,i)=>stageUnlocked(save,i)),[true,true,true,true,false,false]);
  const encoded=JSON.parse(serializeProgress(save));assert.equal(encoded.version,3);assert.deepEqual(encoded.records,{'first-bends':10,'wave-corridor':20,'sky-ridge':30,'breathing-bends':null,'double-apex':null,'neck-corridors':null});
  assert.deepEqual(parseProgress(JSON.stringify(encoded)),save);
});
test('fresh/original access and progressive unlock use actual prior course records',()=>{
  const save=parseProgress(null);assert.deepEqual(STAGES.map((_,i)=>stageUnlocked(save,i)),[true,true,true,false,false,false]);
  save.best[0]=12;save.best[1]=22;assert.equal(stageUnlocked(save,3),false);
  save.best[2]=40;assert.equal(stageUnlocked(save,3),true);assert.equal(stageUnlocked(save,4),false);
  save.best[3]=25;assert.equal(stageUnlocked(save,4),true);
  for(const stage of [-1,6,NaN,1.5])assert.equal(stageUnlocked(save,stage),false);
});
test('stable IDs parse independently of object order and reject invalid per-course times',()=>{
  const save=parseProgress(JSON.stringify({version:2,records:{'double-apex':45,'sky-ridge':30,'wave-corridor':20,'first-bends':10,'breathing-bends':25},muted:false}));
  assert.deepEqual(save.best,[10,20,30,25,45,null]);
  for(const value of [-1,0,null,'10',Infinity]){
    const parsed=parseProgress(JSON.stringify({version:2,records:{'first-bends':value,'sky-ridge':30}}));
    assert.deepEqual(parsed.best,[null,null,30,null,null,null]);
  }
});
test('corrupt campaign falls back to untouched legacy records; future versions become read-only',()=>{
  const old='{"best":[10,20,30],"muted":false}';
  for(const raw of ['{','[]','null','{"version":2,"records":[]}'])assert.deepEqual(parseProgress(raw,old).best,[10,20,30,null,null,null]);
  const future=parseProgress('{"version":4,"records":{"private-future-course":123}}',old);
  assert.equal(future.writable,false);assert.deepEqual(future.best,[10,20,30,null,null,null]);
  assert.deepEqual(parseProgress(null,'{"version":9,"best":[10,20,30]}').best,[null,null,null,null,null,null]);
});

test('partial v2 damage retains valid first-three legacy bests and their unlock',()=>{
  const old='{"best":[14.2,27.8,41.2],"muted":false}';
  const saved=parseProgress('{"version":2,"records":{"first-bends":12,"wave-corridor":"broken","sky-ridge":null}}',old);
  assert.deepEqual(saved.best,[12,27.8,41.2,null,null,null]);assert.equal(stageUnlocked(saved,3),true);assert.equal(stageUnlocked(saved,4),false);
  assert.equal(parseProgress('{"version":2,"records":{"first-bends":99}}',old).best[0],14.2);
});

test('all five accepted courses and original movement remain byte-identical',()=>{
 assert.equal(createHash('sha256').update(JSON.stringify(STAGES.slice(0,5))).digest('hex'),'59633eb82e1b5a33e805d5b6fcb21eec802a2cc2d8c42b61cf4426d20ccb376a');
 const original=readFileSync('src/games/prototypes/ball/model.ts','utf8').replace(/  \/\/ Begin course 6:[\s\S]*?  \/\/ End course 6.\n/,'');
 assert.equal(createHash('sha256').update(original).digest('hex'),'df81538cecc1e90306ac3d5366fe230c1382942d713277f1cc41a9cf953519ab');
 assert.equal(STAGES[5].knots.at(-1)!.z,94);for(const z of[23,27,31])assert.equal(track(5,z).x,3.2);for(const z of[46,50,54])assert.equal(track(5,z).x,-3.2);
});
for(const cadence of[.065,.1,.15,.2])for(const policy of['conservative','release'])test(`course6 ${policy} route at${cadence}s uses unchanged ordinary controls`,()=>{
 const s=createState(5);s.phase='playing';let next=0,input={steer:0,brake:true},margin=Infinity;
 while(s.phase==='playing'&&s.time<90){if(s.time>=next){const road=track(5,s.z),ahead=track(5,s.z+.7),diff=(ahead.x-road.x)/.7*s.speed+(road.x-s.x)*3-s.vx;input={steer:diff>.3?1:diff<-.3?-1:0,brake:policy==='conservative'||(s.z>=36&&s.z<47)};next=s.time+cadence;}advance(s,input);const road=track(5,s.z);margin=Math.min(margin,road.width/2-.38*.35-Math.abs(s.x-road.x));}
 assert.equal(s.phase,'clear');assert.ok(margin>0);if(policy==='release')assert.ok(s.time<25);else assert.ok(s.time>40);
});
test('v2 five-course migration preserves every best and unlocks6 only from a real5 record',()=>{
 const old=JSON.stringify({version:2,muted:false,records:Object.fromEntries(STAGE_IDS.slice(0,5).map((id,i)=>[id,20+i]))});
 const p=parseProgress(null,null,old);assert.deepEqual(p.best,[20,21,22,23,24,null]);assert.equal(p.muted,false);assert.equal(stageUnlocked(p,5),true);
 const roundtrip=parseProgress(serializeProgress(p),null,old);assert.deepEqual(roundtrip,p);
 const incomplete=JSON.parse(old);incomplete.records['double-apex']=null;assert.equal(stageUnlocked(parseProgress(null,null,JSON.stringify(incomplete)),5),false);
 const damaged=parseProgress('{"version":3,"records":{"first-bends":18,"double-apex":"bad"}}',null,old);assert.deepEqual(damaged.best,[18,21,22,23,24,null]);
});
test('reread merge retains faster current/other-course records and protects future versions',()=>{
 const first=parseProgress('{"version":3,"records":{"neck-corridors":25,"first-bends":20}}');
 const newer=parseProgress('{"version":3,"records":{"neck-corridors":19,"first-bends":12,"double-apex":30}}');first.muted=false;mergeProgress(first,newer);assert.equal(first.best[5],19);assert.equal(first.best[0],12);assert.equal(first.best[4],30);assert.equal(first.muted,false);
 mergeProgress(first,parseProgress('{"version":4,"future":"keep"}'));assert.equal(first.writable,false);assert.equal(first.best[5],19);
});

test('portal update is limited to accurate Tilt count and appended name in both languages',()=>{
 let source=readFileSync('src/components/GamePortal.astro','utf8');
 const amberOnly=[["3つの庭を、自分のペースで。", "4つの庭を、自分のペースで。"], ["Reach the finish in three stages at your own pace.", "Reach the finish in four stages at your own pace."], ["03 琥珀の庭'", "03 琥珀の庭 → 04 着地の間合い'"], ["03 Amber Garden'", "03 Amber Garden → 04 Landing Beats'"], ["Orbit Ribbon・Amber Step・Pulse Driftは3ステージ。", "Orbit Ribbon・Pulse Driftは3ステージ、Amber Stepは4ステージ。"], ["Orbit Ribbon, Amber Step and Pulse Drift have three stages.", "Orbit Ribbon and Pulse Drift have three stages; Amber Step has four."]];
 for(const [before,after] of amberOnly){assert.equal(source.split(after).length-1,1);source=source.replace(after,before);}
 const replacements=[["空に浮かぶ5つの道を", "空に浮かぶ6つの道を"], ["Follow five floating trails", "Follow six floating trails"], ["05 ふたつの頂点'", "05 ふたつの頂点 → 06 細道の入口'"], ["05 Double apex'", "05 Double apex → 06 Narrow passages'"], ["TiltTrailは5コースで", "TiltTrailは6コースで"], ["4・5は前のコース", "4〜6は前のコース"], ["TiltTrail has five courses", "TiltTrail has six courses"], ["courses 4 and 5 unlock", "courses 4–6 unlock"]];
 for(const [before,after] of replacements){assert.equal(source.split(after).length-1,1);source=source.replace(after,before);}
 assert.equal(createHash('sha256').update(source).digest('hex'),'3611b21e5e27845a3d912a8576028b147333a11ec18bf4a8f6f1fe556c327a54');
});
