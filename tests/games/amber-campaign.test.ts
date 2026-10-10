import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { stages,createState,step,DT } from '../../src/games/model';
import { AMBER_IDS,parseAmberCampaign,serializeAmberCampaign,mergeAmberCampaign } from '../../src/games/amber-campaign';
const legacy=JSON.stringify({version:1,sound:true,orbit:{unlocked:3,best:[10,20,30]},amber:{unlocked:3,best:[8,9,10],challengeBest:[12,16,22]}});
test('Amber4 is append-only; every accepted layout and all movement/save functions remain exact',()=>{
 const original=readFileSync('src/games/model.ts','utf8').replace(/,\n    \/\/ Begin Amber4:[\s\S]*?    \/\/ End Amber4.\n/,'');
 assert.equal(createHash('sha256').update(original).digest('hex'),'44710256bd6ab17d6b0f9cb1799f33afbad4f5ec727d7c0463af74bcde9a6931');
 assert.equal(stages.amber.length,4);assert.equal(stages.orbit.length,3);assert.equal(AMBER_IDS.length,4);
 const level=stages.amber[3];assert.equal(level.length,70);assert.equal(level.platforms.length,7);
 assert.ok(Math.abs(level.platforms[2].b-level.platforms[2].a-3.6)<1e-9);assert.ok(Math.abs(level.platforms[4].b-level.platforms[4].a-3.8)<1e-9);
 for(const pad of[level.platforms[2],level.platforms[4]])assert.equal(level.hazards.some(h=>h.x>=pad.a&&h.x<=pad.b),false);
});
for(const interval of[.05,.1,.15,.2])for(const pause of[false,true])test(`Amber4 discrete jumps and ${pause?'safe stops':'moving cadence'} clear at${interval}s`,()=>{
 const s=createState('amber',3),targets=[2.9,9.1,20.1,25.9,32.9,39.1,45.1,55.3,63.9],paused=new Set<number>();let target=0,next=0,axis=1,pauseUntil=0;
 while(s.status==='running'&&s.time<30){let jump=false;if(s.time>=next){const pad=stages.amber[3].platforms.findIndex((p,i)=>(i===2||i===4)&&s.grounded&&s.x>=p.a&&s.x<=p.b);if(pause&&pad>=0&&!paused.has(pad)){paused.add(pad);pauseUntil=s.time+.65;}axis=s.time<pauseUntil?0:1;if(axis&&s.grounded&&target<targets.length&&s.x>=targets[target]){jump=true;target++;}next=s.time+interval;}step(s,{axis,jump},DT);}
 assert.equal(s.status,'clear');assert.equal(s.jumps,9);assert.equal(paused.size,pause?2:0);assert.ok(s.time<(pause?16:14.1));
});
test('legacy dual times/sound import without a new completion; only current third-course clear unlocks4',()=>{
 const p=parseAmberCampaign(null,legacy);assert.deepEqual(p.best,[8,9,10,null]);assert.deepEqual(p.challengeBest,[12,16,22,null]);assert.equal(p.sound,true);assert.equal(p.unlocked,4);
 const old=JSON.parse(legacy);old.amber.challengeBest=[null,null,null];assert.equal(parseAmberCampaign(null,JSON.stringify(old)).unlocked,3);
 old.amber.best=[null,null,null];assert.equal(parseAmberCampaign(null,JSON.stringify(old)).unlocked,3);
 assert.equal(parseAmberCampaign('{"version":1,"unlocked":4,"records":{}}',JSON.stringify(old)).unlocked,3);
 assert.deepEqual(parseAmberCampaign(serializeAmberCampaign(p),legacy),p);
});
test('stable IDs, partial corruption and conservative merging preserve the fastest dual records',()=>{
 const p=parseAmberCampaign('{"version":1,"records":{"amber-garden":{"challengeBest":20},"small-step":{"best":"bad","challengeBest":11}}}',legacy);
 assert.deepEqual(p.best,[8,9,10,null]);assert.deepEqual(p.challengeBest,[11,16,20,null]);
 const newer=parseAmberCampaign('{"version":1,"records":{"landing-beats":{"challengeBest":14},"small-step":{"best":7,"challengeBest":10}}}',legacy);p.challengeBest[3]=16;p.sound=false;mergeAmberCampaign(p,newer);
 assert.deepEqual(p.best,[7,9,10,null]);assert.deepEqual(p.challengeBest,[10,16,20,14]);assert.equal(p.sound,false);
});
test('future formats become read-only at boot and before a later write; malformed input stays bounded',()=>{
 const p=parseAmberCampaign('{"version":2,"future":"keep"}',legacy);assert.equal(p.writable,false);assert.equal(p.unlocked,4);
 const current=parseAmberCampaign(null,legacy);mergeAmberCampaign(current,p);assert.equal(current.writable,false);
 for(const raw of['{','[]','null','{"version":1,"records":[]}'])assert.deepEqual(parseAmberCampaign(raw,legacy).challengeBest,[12,16,22,null]);
 for(const n of[0,-1,3600,'14',null])assert.equal(parseAmberCampaign(JSON.stringify({version:1,records:{'landing-beats':{challengeBest:n}}})).challengeBest[3],null);
});
