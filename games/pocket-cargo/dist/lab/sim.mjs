// Small deterministic simulations shared by the browser and Node verification.
export const W = 900, H = 560;
export const MODES = [
  { id:'reflect', n:'01', title:'反射スライム', en:'REFLECT SLIME', color:'#88e2bc', tag:'敵の攻撃が、自分の武器。', description:'タイミングよく反射して、ボスの弾を撃ち返そう。', action:'反射', key:'SPACE', forms:[
    {name:'まんまる型', note:'反射の範囲と時間が広い。まずはこちら。', effect:'反射 0.55秒 / 基本ダメージ 20'},
    {name:'ツノ型', note:'反射の受付は短いが、撃ち返す力が高い。', effect:'反射 0.24秒 / 基本ダメージ 36'}], tips:['移動で弾の近くへ。弾が触れる直前に「反射」。','受付の前半なら PERFECT。ダメージが1.5倍。','反射できない時間は移動して避けよう。'], test:'「避ける」より「撃ち返したい」と感じるか。'},
  { id:'yoyo', n:'02', title:'育てるヨーヨー', en:'RETURN PATH', color:'#a9b7ff', tag:'投げたあとが、勝負。', description:'武器の戻り道に敵を入れる。移動で軌道を操ろう。', action:'投げる / 戻す', key:'SPACE', forms:[
    {name:'重い鉄球', note:'ゆっくり飛び、戻りの一撃が重い。', effect:'戻りダメージ 32 / 低速'},
    {name:'跳ねるリング', note:'速く飛び、壁で跳ねる。戻りにも狙いを。', effect:'戻りダメージ 20 / 壁反射'}], tips:['「投げる」で攻撃。飛んでいる間に移動しよう。','もう一度押すと早く戻せる。戻りの攻撃が強い。','PCはマウスで狙える。パッド操作時はボスを自動で狙う。'], test:'投げた後の移動で、狙って当てる楽しさがあるか。'},
  { id:'scrap', n:'03', title:'ガラクタ生物', en:'SCRAP BODY', color:'#ffc484', tag:'その体で、どう戦う？', description:'左・右・後ろに部品を付け、体の向きで戦おう。', action:'突進', key:'SPACE', forms:[
    {name:'砲撃型', note:'左・右が砲台、後ろが盾。側面を敵に向けて撃つ。', effect:'移動方向に体が向く / 砲台は自動発射'},
    {name:'突撃型', note:'左・右が盾、後ろがトゲ。敵をすり抜け、トゲで刺す。', effect:'トゲの接触＋突進で大ダメージ'}], tips:['移動方向に体が向く。砲台は取り付けた方向へ自動で撃つ。','部品は左・右・後ろのボタンで、その場で変更できる。','突進でボスをすり抜けると、後ろのトゲを当てられる。'], test:'部品の位置に合わせて、動き方を変えたくなるか。'},
  { id:'grow', n:'04', title:'食べるほど重くなる', en:'GROW / GO', color:'#f3a9bf', tag:'大きくなる。それとも、かわす？', description:'食べると強く、大きく、遅くなる。成長の加減が攻略。', action:'食べる / かみつく', key:'SPACE', forms:[
    {name:'まるごと型', note:'大きく育ち、かみつきが強力に。隙間には注意。', effect:'成長で攻撃力アップ大 / 体格・減速も大'},
    {name:'すらり型', note:'成長しても細く速い。小さな攻撃を重ねよう。', effect:'成長で長い尾に変化 / 体格・減速は小'}], tips:['緑の実に近づいて「食べる」。ボスの近くではかみつき攻撃。','大きくなるほど強いが遅い。丸い体は狭い隙間を通れない。','「軽くなる / Q」で成長を2戻せる。変化は戦闘中だけ。'], test:'強くなるために食べるか、速さを残すか迷うか。'}
];
export const clamp = (n,a,b) => Math.max(a,Math.min(b,n));
export const distance = (a,b) => Math.hypot(a.x-b.x,a.y-b.y);
const norm = (x,y) => { const d=Math.hypot(x,y)||1; return {x:x/d,y:y/d}; };
export function segmentDistance(p,a,b) {
  const dx=b.x-a.x, dy=b.y-a.y;
  const t=clamp(((p.x-a.x)*dx+(p.y-a.y)*dy)/(dx*dx+dy*dy||1),0,1);
  return Math.hypot(p.x-a.x-t*dx,p.y-a.y-t*dy);
}
export function circleRect(p,r,b) { return Math.hypot(p.x-clamp(p.x,b.x,b.x+b.w),p.y-clamp(p.y,b.y,b.y+b.h)) < r; }
export function growthStats(form,growth) {
  const g=clamp(growth,0,10);
  return form===0 ? {radius:15+g*2.8,speed:240/(1+g*.12),damage:17+g*6} : {radius:14+g*.65,speed:250/(1+g*.045),damage:14+g*3.1};
}
function rng(seed) { let x=seed>>>0; return () => {x=(Math.imul(x,1664525)+1013904223)>>>0;return x/4294967296;}; }
export function createRun(mode,form=0,level=0,seed=1) {
  if(!MODES.some(m=>m.id===mode)) throw new Error('Unknown mode');
  form=clamp(Math.floor(Number(form)||0),0,1); level=clamp(Math.floor(Number(level)||0),0,3);
  const s={mode,form,level,seed,time:0,left:75,status:'running',outcome:null,events:[],rng:rng(seed),score:0,reflections:0,perfects:0,returnHits:0,hitCount:0,damageTaken:0,growth:0,foodEaten:0,
    player:{x:450,y:445,r:17,speed:245,hp:7+level,maxHp:7+level,invulnerable:1.5,angle:-Math.PI/2,dash:0},
    boss:{x:450,y:135,r:38,hp:mode==='reflect'?260:mode==='scrap'?180:220,maxHp:mode==='reflect'?260:mode==='scrap'?180:220,flash:0,angle:0},
    bullets:[],particles:[],texts:[],food:[],trail:[],weapon:null,guard:0,guardTotal:0,cooldown:0,shotClock:.9,partClock:.3,spikeClock:0,warning:0,volley:0,parts:form===0?['cannon','cannon','shield']:['shield','shield','spike'],
    barriers:mode==='grow'?[{x:0,y:290,w:300,h:42},{x:380,y:290,w:140,h:42},{x:600,y:290,w:300,h:42}]:[],
    pulse:0,shake:0,endedReward:0};
  if(mode==='grow') { s.player.y=435; spawnFood(s,450,415); for(let i=0;i<12;i++) spawnFood(s,70+(i%6)*150,380+Math.floor(i/6)*100); }
  return s;
}
function spawnFood(s,x,y) { s.food.push({x:clamp(x,25,W-25),y:clamp(y,25,H-25),r:7,phase:s.rng()*6.28}); }
function burst(s,x,y,color,count=10) {
  for(let i=0;i<count;i++){const a=s.rng()*Math.PI*2,sp=30+s.rng()*140;s.particles.push({x,y,vx:Math.cos(a)*sp,vy:Math.sin(a)*sp,life:.35+s.rng()*.4,color});}
}
function label(s,text,x,y,color='#fff') {s.texts.push({text,x,y,life:1,color});}
function event(s,name) {s.events.push(name);if(s.events.length>12)s.events.shift();}
export function hurtBoss(s,damage,x=s.boss.x,y=s.boss.y) {
  if(s.status!=='running'||s.boss.hp<=0)return;
  damage=Math.round(damage*(1+s.level*.08));
  s.boss.hp=Math.max(0,s.boss.hp-damage);s.boss.flash=.12;s.hitCount++;s.score+=damage;burst(s,x,y,'#ffd5a3',7);label(s,String(damage),x,y-22);event(s,'hit');
  if(s.boss.hp===0)finish(s,'win');
}
function hurtPlayer(s) {
  const p=s.player;if(s.status!=='running'||p.invulnerable>0||p.dash>0)return;
  p.hp--;p.invulnerable=1.15;s.damageTaken++;s.shake=.2;burst(s,p.x,p.y,'#f6a0ae',10);event(s,'hurt');
  if(p.hp<=0)finish(s,'lose');
}
export function finish(s,outcome) {
  if(s.status!=='running')return;
  s.status='ended';s.outcome=outcome;s.endedReward=outcome==='win'?6:2;event(s,outcome);
}
function fire(s,angle,speed=165,x=s.boss.x,y=s.boss.y) {
  s.bullets.push({x,y,vx:Math.cos(angle)*speed,vy:Math.sin(angle)*speed,r:7,owner:'enemy',damage:0,life:8});
}
export function partPositions(s) {
  return [-Math.PI/2,Math.PI/2,Math.PI].map((offset,i)=>({x:s.player.x+Math.cos(s.player.angle+offset)*31,y:s.player.y+Math.sin(s.player.angle+offset)*31,angle:s.player.angle+offset,type:s.parts[i],slot:i}));
}
export function cyclePart(s,index) {
  if(s.mode!=='scrap'||!Number.isInteger(index)||index<0||index>2)return;
  const order=['cannon','shield','spike'];s.parts[index]=order[(order.indexOf(s.parts[index])+1)%3];
}
export function lighten(s) {if(s.mode==='grow'&&s.status==='running'&&s.growth>0){s.growth=Math.max(0,s.growth-2);burst(s,s.player.x,s.player.y,'#b7e9ac',12);event(s,'lighten');}}
export function action(s,input={}) {
  if(s.status!=='running')return false;
  const p=s.player;
  if(s.mode==='yoyo'&&s.weapon){if(s.weapon.age>.12){s.weapon.phase='return';event(s,'recall');return true;}return false;}
  if(s.cooldown>0)return false;
  if(s.mode==='reflect') {
    s.guardTotal=s.form===0?.55:.24;s.guard=s.guardTotal;s.cooldown=s.form===0?.9:.72;s.pulse=.2;event(s,'guard');
  } else if(s.mode==='yoyo') {
    const target=input.aim||s.boss,d=norm(target.x-p.x,target.y-p.y),speed=s.form===0?345:490;
    s.weapon={x:p.x,y:p.y,vx:d.x*speed,vy:d.y*speed,r:s.form===0?15:12,phase:'out',age:0,hitClock:0,angle:0};event(s,'throw');
  } else if(s.mode==='scrap') {
    p.dash=.22;p.invulnerable=Math.max(p.invulnerable,.24);s.cooldown=1.05;s.spikeClock=0;s.pulse=.15;event(s,'dash');
  } else {
    s.cooldown=.38;s.pulse=.18;
    let eaten=0;
    s.food=s.food.filter(f=>{if(distance(f,p)<p.r+48&&s.growth<10){s.growth++;s.foodEaten++;eaten++;burst(s,f.x,f.y,'#b4f3a9',6);return false;}return true;});
    if(eaten){label(s,'GROW +'+eaten,p.x,p.y-30,'#b9f3a8');event(s,'eat');}
    if(distance(p,s.boss)<p.r+s.boss.r+37)hurtBoss(s,growthStats(s.form,s.growth).damage);
  }
  return true;
}
function movePlayer(s,input,dt) {
  const p=s.player,dx=Number(input.x)||0,dy=Number(input.y)||0,l=Math.hypot(dx,dy),d=l>1?{x:dx/l,y:dy/l}:{x:dx,y:dy};
  if(l>.08){p.angle=Math.atan2(d.y,d.x);}
  if(s.mode==='grow'){const st=growthStats(s.form,s.growth);p.r=st.radius;p.speed=st.speed;} else {p.r=17;p.speed=245;}
  const speed=p.speed*(p.dash>0?3.5:1);
  const vx=p.dash>0?Math.cos(p.angle):d.x,vy=p.dash>0?Math.sin(p.angle):d.y;
  for(const axis of ['x','y']){
    const old=p[axis];p[axis]+= (axis==='x'?vx:vy)*speed*dt;p[axis]=clamp(p[axis],p.r+10,(axis==='x'?W:H)-p.r-10);
    if(s.barriers.some(b=>circleRect(p,p.r,b)))p[axis]=old;
  }
  // Growth can overlap a wall; reduce size with Q rather than teleporting through it.
}
function updateBoss(s,dt) {
  const b=s.boss;b.x=450+Math.sin(s.time*.5)*220;b.y=128+Math.cos(s.time*.72)*34;
  s.shotClock-=dt;s.warning=s.shotClock<.42?(.42-s.shotClock)/.42:0;b.angle=Math.atan2(s.player.y-b.y,s.player.x-b.x);
  if(s.shotClock<=0){
    const hard=b.hp<b.maxHp*.5;s.volley++;
    const count=s.mode==='reflect'?(hard?5:3):(hard?5:3),gap=s.mode==='reflect'?.19:.25;
    for(let i=0;i<count;i++)fire(s,b.angle+(i-(count-1)/2)*gap,s.mode==='reflect'?170:150+(hard?25:0));
    if(s.volley%3===0){for(let i=0;i<8;i++)fire(s,i*Math.PI/4+s.time*.2,125);}
    s.shotClock=s.mode==='reflect'?(hard?1.35:1.65):(hard?1.7:2.05);s.warning=0;event(s,'volley');
    if(s.mode==='grow'&&s.food.length<18){for(let i=0;i<2;i++)spawnFood(s,70+s.rng()*760,65+s.rng()*180);}
  }
}
function updateBullets(s,dt) {
  const p=s.player;
  for(const b of s.bullets){
    const old={x:b.x,y:b.y};b.x+=b.vx*dt;b.y+=b.vy*dt;b.life-=dt;
    if(b.owner==='enemy'){
      if(s.mode==='reflect'&&s.guard>0&&segmentDistance(p,old,b)<p.r+(s.form===0?30:19)+b.r){
        const perfect=s.guard>s.guardTotal*.65;const d=norm(s.boss.x-b.x,s.boss.y-b.y);b.owner='player';b.vx=d.x*570;b.vy=d.y*570;b.damage=(s.form===0?20:36)*(perfect?1.5:1);b.r=9;
        s.reflections++;if(perfect)s.perfects++;burst(s,b.x,b.y,'#9ff3c7',8);label(s,perfect?'PERFECT':'REFLECT',p.x,p.y-40,'#a6f3d0');event(s,'reflect');continue;
      }
      if(s.mode==='scrap'&&partPositions(s).some(part=>part.type==='shield'&&segmentDistance(part,old,b)<21+b.r)){b.life=0;burst(s,b.x,b.y,'#a9e0f9',5);continue;}
      if(segmentDistance(p,old,b)<p.r+b.r){b.life=0;hurtPlayer(s);}
    }else if(segmentDistance(s.boss,old,b)<s.boss.r+b.r){b.life=0;hurtBoss(s,b.damage,b.x,b.y);}
    if(s.barriers.some(r=>circleRect(b,b.r,r)))b.life=0;
    if(b.x<-40||b.x>W+40||b.y<-40||b.y>H+40)b.life=0;
  }
  s.bullets=s.bullets.filter(b=>b.life>0);
}
function updateWeapon(s,dt) {
  const w=s.weapon;if(!w)return;const old={x:w.x,y:w.y};w.age+=dt;w.hitClock-=dt;w.angle+=dt*12;
  if(w.phase==='out'){
    w.x+=w.vx*dt;w.y+=w.vy*dt;
    if(s.form===1){if(w.x<20||w.x>W-20){w.vx*=-1;w.x=clamp(w.x,20,W-20);}if(w.y<20||w.y>H-20){w.vy*=-1;w.y=clamp(w.y,20,H-20);}}
    if(w.age>(s.form===0?.82:1.05)||w.x<0||w.x>W||w.y<0||w.y>H)w.phase='return';
  } else {
    const d=norm(s.player.x-w.x,s.player.y-w.y),speed=s.form===0?400:540;w.x+=d.x*speed*dt;w.y+=d.y*speed*dt;
    if(distance(w,s.player)<s.player.r+w.r){s.weapon=null;s.cooldown=.12;event(s,'catch');return;}
  }
  if(w.hitClock<=0&&segmentDistance(s.boss,old,w)<s.boss.r+w.r){const back=w.phase==='return';hurtBoss(s,back?(s.form===0?32:20):8,w.x,w.y);w.hitClock=.27;if(back){s.returnHits++;label(s,'RETURN HIT',w.x,w.y-30,'#c2c9ff');}}
}
function updateParts(s,dt) {
  s.partClock-=dt;s.spikeClock-=dt;
  const parts=partPositions(s);
  if(s.partClock<=0){for(const part of parts)if(part.type==='cannon')s.bullets.push({x:part.x,y:part.y,vx:Math.cos(part.angle)*430,vy:Math.sin(part.angle)*430,r:4,owner:'player',damage:9,life:2.5});s.partClock=.34;}
  if(s.spikeClock<=0){for(const part of parts)if(part.type==='spike'&&distance(part,s.boss)<s.boss.r+29){hurtBoss(s,s.player.dash>0?38:13,part.x,part.y);s.spikeClock=.4;break;}}
}
export function step(s,input={},dt=1/60) {
  dt=clamp(Number(dt)||0,0,.05);s.events=[];
  for(const p of s.particles){p.x+=p.vx*dt;p.y+=p.vy*dt;p.vx*=.97;p.vy*=.97;p.life-=dt;}
  s.particles=s.particles.filter(p=>p.life>0);
  for(const t of s.texts){t.y-=30*dt;t.life-=dt;}s.texts=s.texts.filter(t=>t.life>0);
  if(s.status!=='running')return s;
  s.time+=dt;s.left=Math.max(0,75-s.time);
  for(const key of ['guard','cooldown','pulse','shake'])s[key]=Math.max(0,s[key]-dt);
  s.player.invulnerable=Math.max(0,s.player.invulnerable-dt);s.player.dash=Math.max(0,s.player.dash-dt);s.boss.flash=Math.max(0,s.boss.flash-dt);
  movePlayer(s,input,dt);updateBoss(s,dt);
  if(input.action)action(s,input);if(input.lighten)lighten(s);
  if(s.mode==='yoyo')updateWeapon(s,dt);if(s.mode==='scrap')updateParts(s,dt);
  updateBullets(s,dt);
  if(distance(s.player,s.boss)<s.player.r+s.boss.r-4)hurtPlayer(s);
  s.trail.unshift({x:s.player.x,y:s.player.y});if(s.trail.length>42)s.trail.pop();
  if(s.left<=0&&s.status==='running')finish(s,'time');
  return s;
}
export function emptyProgress() { return {version:1,modes:Object.fromEntries(MODES.map(m=>[m.id,{materials:0,level:0,best:0,plays:0,wins:0,rating:'',memo:''}]))}; }
export function sanitizeProgress(raw) {
  const clean=emptyProgress();if(!raw||raw.version!==1)return clean;
  for(const m of MODES){const v=raw.modes?.[m.id];if(!v)continue;const r=clean.modes[m.id];for(const key of ['materials','level','best','plays','wins'])r[key]=clamp(Math.floor(Number(v[key])||0),0,key==='level'?3:99999);r.rating=['好き','普通','合わない'].includes(v.rating)?v.rating:'';r.memo=typeof v.memo==='string'?v.memo.slice(0,300):'';}
  return clean;
}
export function bankRun(progress,run) {
  if(run.status!=='ended'||run.banked)return false;
  const p=progress.modes[run.mode];p.materials+=run.endedReward;p.plays++;p.wins+=run.outcome==='win'?1:0;p.best=Math.max(p.best,run.score);run.banked=true;return true;
}
export function upgrade(progress,mode) {
  const p=progress.modes[mode];if(!p||p.level>=3||p.materials<3)return false;
  p.materials-=3;p.level++;return true;
}
