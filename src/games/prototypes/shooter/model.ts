export const STEP = 1 / 60;
export const SAVE_KEY = 'pocketey-pulse-drift-v1';
export const clamp = (v:number,a:number,b:number) => Math.max(a, Math.min(b,v));
export type Body = {id:number;x:number;y:number;vx:number;vy:number;r:number};
export type Enemy = Body & {hp:number;shot:number;kind:'scout'|'fan'|'boss'};
export type Beam = {x:number;age:number;wide:number};
export type State = {stage:number;time:number;x:number;y:number;hp:number;invulnerable:number;status:'playing'|'lost'|'won';score:number;enemies:Enemy[];bullets:Body[];shots:Body[];beams:Beam[];nextId:number;spawn:number;fire:number;bossSpawned:boolean;hit:number};
export const STAGES = [ {ja:'01 夜明けの回廊',en:'01 Dawn corridor',duration:36}, {ja:'02 交差する信号',en:'02 Crossed signals',duration:42}, {ja:'03 脈動の中枢',en:'03 Pulse core',duration:48} ];
export function createState(stage:number):State {return {stage:clamp(Math.floor(stage),0,2),time:0,x:0,y:1.8,hp:4,invulnerable:1,status:'playing',score:0,enemies:[],bullets:[],shots:[],beams:[],nextId:1,spawn:1,fire:0,bossSpawned:false,hit:0};}
export function overlaps(a:{x:number;y:number;r:number},b:{x:number;y:number;r:number}) {return Math.hypot(a.x-b.x,a.y-b.y)<a.r+b.r;}
export function sweptHit(a:Body,oldX:number,oldY:number,b:{x:number;y:number;r:number}) {const dx=a.x-oldX,dy=a.y-oldY; const t=clamp(((b.x-oldX)*dx+(b.y-oldY)*dy)/(dx*dx+dy*dy||1),0,1);return overlaps({x:oldX+dx*t,y:oldY+dy*t,r:a.r},b);}
export function step(s:State,dt:number,input:{x:number;y:number}) {
 if(s.status!=='playing')return;dt=clamp(dt,0,STEP);s.time+=dt;s.invulnerable=Math.max(0,s.invulnerable-dt);s.hit=Math.max(0,s.hit-dt);
 const dx=input.x-s.x,dy=input.y-s.y,d=Math.hypot(dx,dy),travel=Math.min(d,6.5*dt);if(d){s.x+=dx/d*travel;s.y+=dy/d*travel;}s.x=clamp(s.x,-3.8,3.8);s.y=clamp(s.y,.7,6.5);
 s.fire-=dt;if(s.fire<=0){s.fire=.16;s.shots.push({id:s.nextId++,x:s.x,y:s.y+.4,vx:0,vy:15,r:.12});}
 s.spawn-=dt;if(s.spawn<=0&&s.time<(s.stage===2?29:STAGES[s.stage].duration-5)){s.spawn= s.stage===0?2.3:1.8;const n=Math.floor(s.time/1.8);s.enemies.push({id:s.nextId++,x:Math.sin(n*2.4)*3,y:11,vx:Math.cos(n)*.35,vy:-1.1-s.stage*.15,r:.44,hp:3,shot:1,kind:s.stage>0&&n%3===0?'fan':'scout'});}
 if(s.stage===2&&s.time>=30&&!s.bossSpawned){s.bossSpawned=true;s.enemies.push({id:s.nextId++,x:0,y:9,vx:0,vy:0,r:1,hp:32,shot:1,kind:'boss'});}
 for(const e of s.enemies){e.y+=e.vy*dt;e.x=e.kind==='boss'?Math.sin(s.time*.6)*2.5:clamp(e.x+e.vx*dt,-3.5,3.5);e.shot-=dt;if(e.shot<=0&&e.y>3){e.shot=e.kind==='boss'?1.2:2.1;const angle=Math.atan2(s.y-e.y,s.x-e.x);const spread=e.kind==='scout'?[0]:[-.27,0,.27];for(const a of spread)s.bullets.push({id:s.nextId++,x:e.x,y:e.y,vx:Math.cos(angle+a)*(2.7+s.stage*.25),vy:Math.sin(angle+a)*(2.7+s.stage*.25),r:.16});}}
 // Fixed, visibly telegraphed lanes; no beam tracks the player after warning begins.
 const interval=s.stage===0?9:s.stage===1?7:5;const before=Math.floor((s.time-dt)/interval),now=Math.floor(s.time/interval);if(now>before)s.beams.push({x:Math.sin(now*2.2)*2.8,age:0,wide:.65});
 const player={x:s.x,y:s.y,r:.18};const damage=()=>{if(s.invulnerable<=0){s.hp--;s.invulnerable=1.35;s.hit=.22;if(s.hp<=0)s.status='lost';}};
 for(const beam of s.beams){beam.age+=dt;if(beam.age>=1.3&&beam.age<1.8&&Math.abs(s.x-beam.x)<beam.wide/2+player.r)damage();}s.beams=s.beams.filter(b=>b.age<1.9);
 for(const b of s.bullets){const x=b.x,y=b.y;b.x+=b.vx*dt;b.y+=b.vy*dt;if(sweptHit(b,x,y,player)){damage();b.y=-9;}}
 for(const b of s.shots){const x=b.x,y=b.y;b.y+=b.vy*dt;for(const e of s.enemies){if(e.hp>0&&sweptHit(b,x,y,e)){e.hp--;b.y=99;if(e.hp===0)s.score+=e.kind==='boss'?1000:100;break;}}}
 for(const e of s.enemies)if(e.hp>0&&overlaps(player,e))damage();
 s.bullets=s.bullets.filter(b=>b.y>-.5&&b.y<12&&Math.abs(b.x)<5);s.shots=s.shots.filter(b=>b.y<12);s.enemies=s.enemies.filter(e=>e.hp>0&&e.y>-.8);
 if(s.status==='playing'&&s.stage===2&&s.bossSpawned&&!s.enemies.some(e=>e.kind==='boss'))s.status='won';
 if(s.status==='playing'&&s.time+1e-9>=STAGES[s.stage].duration){s.status=s.stage<2?'won':'lost';}
}
export type Save={best:number[];mute:boolean};
export function cleanSave(raw:unknown):Save {const r=raw as Partial<Save>|null;return {best:[0,1,2].map(i=>typeof r?.best?.[i]==='number'&&Number.isFinite(r.best[i])?clamp(Math.floor(r.best[i]),0,100000):0),mute:typeof r?.mute==='boolean'?r.mute:true};}
