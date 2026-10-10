import * as THREE from 'three';import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import {test} from 'node:test';import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';import {createHash} from 'node:crypto';
import {createState,step,STEP,spawnX,FINAL_SWEEP_SLOTS} from '../../../src/games/prototypes/shooter/model';
import {chooseTimeoutLane} from './timeout-driver';
import {bossIncoming,bossTimedOut} from '../../../src/games/prototypes/shooter/briefing';import {chooseLane} from './controller';
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

const acceptedBossPaint = "    const top=THREE.MathUtils.smoothstep(y,.02,.38);\n    if(y>.37&&ax<.25)color=new THREE.Color(0x223b50).lerp(new THREE.Color(0x667f90),top*.65);\n    else color=new THREE.Color(0x3c5365).lerp(new THREE.Color(ax>.49?0x9c8367:0x8295a0),top).lerp(original,.18);\n    if(z>.85)color=original;";
const reviewedBossPaint = "    // Boss paint: violet upper shell, blue lower panels, restrained pale wing edge.\n    const top=THREE.MathUtils.smoothstep(y,.02,.38);\n    if(y>.37&&ax<.25)color=new THREE.Color(0x22314f).lerp(new THREE.Color(0x7769ae),top*.65);\n    else {\n     color=new THREE.Color(0x263e5b).lerp(new THREE.Color(0x7758b5),top);\n     if(ax>.49)color.lerp(new THREE.Color(0xc3c3dc),.24*THREE.MathUtils.smoothstep(y,.16,.36));\n     color.lerp(original,.08);\n    }\n    if(z>.85)color=original;\n    // End boss paint.";
function restoreBossPaint(source:string) {
 assert.equal(source.split(reviewedBossPaint).length,2,'Only the exact reviewed color calculation is permitted');
 return source.replace(reviewedBossPaint,acceptedBossPaint);
}
test('warning-only renderer correction is unfogged and steady without changing geometry or any other rendering',()=>{
 const source=readFileSync('src/games/prototypes/shooter/view.ts','utf8');assert.ok(source.includes('color:0xffbc50,transparent:true,opacity:.55,fog:false'));assert.ok(source.includes('b.age<1.3?.55:.85'));
 const original=restoreBossPaint(source).replace('color:0xffbc50,transparent:true,opacity:.55,fog:false','color:0xffbc50,transparent:true,opacity:.35').replace('b.age<1.3?.55:.85','b.age<1.3?.15+.13*(Math.sin(b.age*18)+1):.85');assert.equal(createHash('sha256').update(original).digest('hex'),'304fd7ccb3d9df5d73969d03c26da2b1db5542f3f61f8e7487cd39ddd66e2413');
});

test('boss paint is the sole change from the accepted warning renderer',()=>{
 const source=restoreBossPaint(readFileSync('src/games/prototypes/shooter/view.ts','utf8'));
 assert.equal(createHash('sha256').update(source).digest('hex'),'6a93584154b58144b0bc1579cce3b5bdd7ac5732f28c0d392a22a5d17dff91d0');
});
test('loaded boss paint changes only colors; ship and every position/normal/index stay identical',async()=>{
 const source=readFileSync('src/games/prototypes/shooter/view.ts','utf8');
 const extract=(text:string)=>text.slice(text.indexOf(' function paintVehicle('),text.indexOf(" paintVehicle(geometries.ship,'ship')"))
  .replace("geometry:THREE.BufferGeometry,kind:'ship'|'boss'",'geometry,kind').replace('colors:number[]=[]','colors=[]').replace('let color:THREE.Color;','let color;');
 const paint=new Function('THREE',`return (${extract(source)})`)(THREE),oldPaint=new Function('THREE',`return (${extract(restoreBossPaint(source))})`)(THREE);
 const bytes=readFileSync('public/games/assets/pulse/pulse-vehicles.glb');
 const gltf=await new GLTFLoader().parseAsync(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength),'');gltf.scene.updateMatrixWorld(true);
 for(const[kind,name]of[['ship','interceptor'],['boss','manta_boss']]as const){
  const mesh=gltf.scene.getObjectByName(name)as THREE.Mesh;assert.ok(mesh?.geometry);
  const geometry=mesh.geometry.clone().applyMatrix4(mesh.matrixWorld),baseline=geometry.clone();
  const snapshot=()=>({position:Array.from(geometry.getAttribute('position').array),normal:Array.from(geometry.getAttribute('normal').array),index:geometry.index?Array.from(geometry.index.array):null});
  const before=snapshot();paint(geometry,kind);oldPaint(baseline,kind);assert.deepEqual(snapshot(),before);
  const colors=Array.from(geometry.getAttribute('color').array),oldColors=Array.from(baseline.getAttribute('color').array);
  assert.ok(colors.every(Number.isFinite));assert.equal(colors.length,oldColors.length);
  if(kind==='boss')assert.notDeepEqual(colors,oldColors);else assert.deepEqual(colors,oldColors);
  geometry.dispose();baseline.dispose();
 }
});

test('boss timeout requires a living boss, surviving shields and the exact model deadline',()=>{
  const s=createState(2);s.status='lost';s.time=47.99999999999856;
  s.enemies=[{id:1,x:0,y:9,vx:0,vy:0,r:1,hp:20,shot:1,kind:'boss'}];
  const before=structuredClone(s);assert.equal(bossTimedOut(s),true);assert.deepEqual(s,before);
  s.time=48-1e-8;assert.equal(bossTimedOut(s),false);s.time=48;s.hp=0;assert.equal(bossTimedOut(s),false);
  s.hp=4;s.enemies[0].hp=0;assert.equal(bossTimedOut(s),false);s.enemies=[];assert.equal(bossTimedOut(s),false);
  s.enemies=before.enemies;s.status='won';assert.equal(bossTimedOut(s),false);s.status='playing';assert.equal(bossTimedOut(s),false);
  s.status='lost';s.stage=1;assert.equal(bossTimedOut(s),false);
});

test('ordinary four-shield avoidance reaches the true boss deadline without a fabricated death',()=>{
 for(const cadence of [.05,.1,.15,.2]){const s=createState(2);let target=0,next=0;
  while(s.status==='playing'){if(s.time>=next){target=chooseTimeoutLane(s);next+=cadence;}step(s,STEP,{x:target,y:1.8});}
  assert.equal(s.status,'lost');assert.ok(s.hp>0);assert.equal(bossTimedOut(s),true);assert.ok(s.time+1e-9>=48);
 }
});
