import {W,H,partPositions} from './sim.mjs';
const TAU=Math.PI*2;
function circle(c,x,y,r,color){c.fillStyle=color;c.beginPath();c.arc(x,y,Math.max(.1,r),0,TAU);c.fill();}
function line(c,x1,y1,x2,y2,color,width=2){c.strokeStyle=color;c.lineWidth=width;c.beginPath();c.moveTo(x1,y1);c.lineTo(x2,y2);c.stroke();}
function ring(c,x,y,r,color,width=2){c.strokeStyle=color;c.lineWidth=width;c.beginPath();c.arc(x,y,Math.max(.1,r),0,TAU);c.stroke();}
function round(c,x,y,w,h,r,color){c.fillStyle=color;c.beginPath();c.roundRect(x,y,w,h,r);c.fill();}
function eyes(c,x,y,angle=0,scale=1){c.save();c.translate(x,y);c.rotate(angle);circle(c,-5*scale,-3*scale,2.6*scale,'#203a3b');circle(c,5*scale,-3*scale,2.6*scale,'#203a3b');circle(c,-4.4*scale,-3.7*scale,.8*scale,'#fff');circle(c,5.6*scale,-3.7*scale,.8*scale,'#fff');c.restore();}
function leaf(c,x,y,angle,color='#9de9b4'){c.save();c.translate(x,y);c.rotate(angle);c.fillStyle=color;c.beginPath();c.ellipse(0,0,7,13,0,0,TAU);c.fill();line(c,0,-9,0,10,'#315442',1);c.restore();}
function slime(c,s,color){
 const p=s.player,wig=Math.sin(s.time*8)*1.3;
 c.save();c.translate(p.x,p.y);c.scale(1+wig*.016,1-wig*.02);
 c.fillStyle=color;c.beginPath();c.moveTo(-21,9);c.bezierCurveTo(-24,-28,20,-30,23,9);c.quadraticCurveTo(15,22,0,15);c.quadraticCurveTo(-15,22,-21,9);c.fill();
 c.fillStyle='#fff5';c.beginPath();c.ellipse(-8,-10,5,8,.6,0,TAU);c.fill();
 if(s.form===1){c.fillStyle='#e9dca8';c.beginPath();c.moveTo(-6,-18);c.lineTo(0,-40);c.lineTo(7,-18);c.fill();}
 eyes(c,0,1);line(c,-2,8,3,8,'#295046',1.6);c.restore();
 if(s.guard>0){const r=p.r+(s.form===0?31:20);circle(c,p.x,p.y,r,'#a1e9c01b');ring(c,p.x,p.y,r,'#bcffda',3);ring(c,p.x,p.y,r+7,'#8ee8bb44',1);for(let i=0;i<6;i++){const a=i*TAU/6+s.time*2;line(c,p.x+Math.cos(a)*(r+3),p.y+Math.sin(a)*(r+3),p.x+Math.cos(a)*(r+10),p.y+Math.sin(a)*(r+10),'#d4ffe4',2);}}
}
function robot(c,s){const p=s.player;
 c.save();c.translate(p.x,p.y);c.rotate(p.angle+Math.PI/2);
 round(c,-20,-20,40,42,11,'#f2c087');round(c,-14,-12,28,17,6,'#334c4d');circle(c,-6,-4,3,'#c4f0d5');circle(c,6,-4,3,'#c4f0d5');line(c,-6,13,6,13,'#946a49',3);round(c,-14,21,9,7,2,'#749181');round(c,5,21,9,7,2,'#749181');c.restore();
 for(const part of partPositions(s)){c.save();c.translate(part.x,part.y);c.rotate(part.angle);line(c,-10,0,0,0,'#768c83',6);if(part.type==='cannon'){round(c,-9,-8,21,16,4,'#779a99');round(c,4,-5,14,10,2,'#b4c9b7');circle(c,0,0,4,'#314a4b');}else if(part.type==='shield'){round(c,-4,-19,9,38,4,'#9cd9ed');line(c,3,-13,3,13,'#e0f6f4',2);}else{c.fillStyle='#f4a172';c.beginPath();c.moveTo(-8,-12);c.lineTo(23,0);c.lineTo(-8,12);c.fill();}c.restore();}
 if(p.dash>0){for(let i=1;i<6;i++){const a=p.angle+Math.PI,xx=p.x+Math.cos(a)*i*12,yy=p.y+Math.sin(a)*i*12;circle(c,xx,yy,7-i,'#ffd69a70');}}
}
function grow(c,s){const p=s.player;
 if(s.form===1){for(let i=Math.min(32,6+s.growth*3);i>0;i-=3){const t=s.trail[i];if(t)circle(c,t.x,t.y,Math.max(4,p.r*(1-i/45)),'#bd8eab');}}
 circle(c,p.x,p.y,p.r,'#efadc2');circle(c,p.x-p.r*.3,p.y-p.r*.35,p.r*.25,'#ffdce785');
 if(s.form===0){leaf(c,p.x+3,p.y-p.r-3,-.35,'#b2dcb0');leaf(c,p.x+12,p.y-p.r-1,.7,'#8ebf9b');}else{leaf(c,p.x-5,p.y-p.r+1,-1,'#b6d7ba');}
 eyes(c,p.x,p.y,0,Math.max(.9,p.r/22));
 if(s.pulse>0){const a=s.player.angle;const r=p.r+35*(1-s.pulse/.18);ring(c,p.x+Math.cos(a)*p.r,p.y+Math.sin(a)*p.r,r,'#ffdda5aa',3);}
}
function drawBoss(c,s){const b=s.boss;
 circle(c,b.x,b.y+12,b.r+8,'#00000025');
 if(s.warning>0){const alpha=s.warning*.6;c.globalAlpha=alpha;ring(c,b.x,b.y,b.r+10+s.warning*15,'#ffb08d',2);for(let i=-1;i<=1;i++){const a=b.angle+i*.22;line(c,b.x+Math.cos(a)*45,b.y+Math.sin(a)*45,b.x+Math.cos(a)*105,b.y+Math.sin(a)*105,'#ffb08d',2);}c.globalAlpha=1;}
 c.save();c.translate(b.x,b.y);
 if(s.mode==='reflect'){c.rotate(s.time*.35);c.fillStyle=b.flash>0?'#fff0d2':'#cc7e89';c.beginPath();for(let i=0;i<8;i++){const a=i*TAU/8;const r=i%2?30:44;const x=Math.cos(a)*r,y=Math.sin(a)*r;i?c.lineTo(x,y):c.moveTo(x,y);}c.closePath();c.fill();c.rotate(-s.time*.35);circle(c,0,0,23,'#5c3c56');circle(c,0,0,13,'#f1c18b');circle(c,2,1,6,'#392c46');}
 else if(s.mode==='yoyo'){c.rotate(Math.sin(s.time)*.1);round(c,-39,-29,78,58,17,b.flash>0?'#fff0d2':'#7b82b1');round(c,-29,-19,58,39,12,'#39435e');circle(c,0,0,13,'#e4ab7a');line(c,-41,0,-57,0,'#8a94ba',12);line(c,41,0,57,0,'#8a94ba',12);}
 else if(s.mode==='scrap'){c.rotate(s.time*.3);for(let i=0;i<4;i++){const a=i*TAU/4;line(c,0,0,Math.cos(a)*44,Math.sin(a)*44,'#7d6d67',9);circle(c,Math.cos(a)*44,Math.sin(a)*44,12,'#9c8f7b');ring(c,Math.cos(a)*44,Math.sin(a)*44,17,'#93866c60',3);}c.rotate(-s.time*.3);circle(c,0,0,31,b.flash>0?'#fff0d2':'#bd9c7c');round(c,-20,-11,40,23,8,'#493e43');circle(c,-8,0,5,'#f2ad83');circle(c,8,0,5,'#f2ad83');}
 else{circle(c,0,0,42,b.flash>0?'#fff0d2':'#8a81ae');circle(c,-12,-9,5,'#e4e4d1');circle(c,12,-9,5,'#e4e4d1');round(c,-23,8,46,14,5,'#453f60');for(let i=0;i<4;i++){c.fillStyle='#e4d8b9';c.beginPath();c.moveTo(-17+i*10,9);c.lineTo(-12+i*10,19);c.lineTo(-7+i*10,9);c.fill();}}
 c.restore();
 c.textAlign='center';c.fillStyle='#a0adb7';c.font='8px system-ui';c.fillText(s.boss.hp<s.boss.maxHp*.5?'PHASE 02 / ENRAGED':'PHASE 01',b.x,b.y-b.r-22);
}
export function draw(ctx,s,mode,{reduced=false,aim=null}={}){
 const c=ctx;c.save();c.scale(c.canvas.width/W,c.canvas.height/H);
 c.fillStyle='#111d28';c.fillRect(0,0,W,H);
 if(!reduced&&s.shake>0)c.translate(Math.sin(s.time*140)*s.shake*17,Math.cos(s.time*120)*s.shake*12);
 c.strokeStyle='#b7cfbe09';c.lineWidth=1;
 for(let x=0;x<W;x+=40){c.beginPath();c.moveTo(x,0);c.lineTo(x,H);c.stroke();}for(let y=0;y<H;y+=40){c.beginPath();c.moveTo(0,y);c.lineTo(W,y);c.stroke();}
 const glow=c.createRadialGradient(W/2,H/2,50,W/2,H/2,450);glow.addColorStop(0,mode.color+'09');glow.addColorStop(1,'#111d2800');c.fillStyle=glow;c.fillRect(0,0,W,H);
 c.strokeStyle='#64848132';c.lineWidth=1;c.strokeRect(18,18,W-36,H-36);
 for(const [x,y,sx,sy] of [[18,18,1,1],[W-18,18,-1,1],[18,H-18,1,-1],[W-18,H-18,-1,-1]]){line(c,x,y,x+sx*24,y,'#75958c66',2);line(c,x,y,x,y+sy*24,'#75958c66',2);}
 c.fillStyle='#8ea79742';c.font='9px system-ui';c.textAlign='left';c.fillText('POCKETEY / '+mode.en,34,H-36);c.textAlign='right';c.fillText('ARENA 0'+(Number(mode.n)),W-34,H-36);
 for(const b of s.barriers){round(c,b.x,b.y+5,b.w,b.h,7,'#09131c');round(c,b.x,b.y,b.w,b.h,7,'#3c4b4a');for(let x=b.x+15;x<b.x+b.w-10;x+=25)line(c,x,b.y+8,x+12,b.y+8,'#78947a4d',2);}
 if(s.mode==='grow'){c.fillStyle='#8aaca0';c.font='9px system-ui';c.textAlign='center';c.fillText('細い隙間 / 大きさに注意',450,354);for(const f of s.food){circle(c,f.x,f.y+2,f.r+2,'#0003');circle(c,f.x,f.y,f.r,'#a7d899');leaf(c,f.x+2,f.y-7,.6,'#719e78');}}
 drawBoss(c,s);
 if(s.weapon){const w=s.weapon;line(c,s.player.x,s.player.y,w.x,w.y,w.phase==='return'?'#bdc6ff99':'#93a8cb55',2);c.save();c.translate(w.x,w.y);c.rotate(w.angle);if(s.form===0){circle(c,0,0,w.r,'#c1cbef');ring(c,0,0,w.r-4,'#6378a2',3);line(c,-8,-4,8,4,'#657d9e',3);}else{ring(c,0,0,w.r,'#a9b8ff',6);line(c,-7,0,7,0,'#e0e6ff',2);line(c,0,-7,0,7,'#e0e6ff',2);}c.restore();}
 for(const b of s.bullets){const color=b.owner==='enemy'?'#f0a38e':s.mode==='reflect'?'#99edbe':'#f5c47d';circle(c,b.x-b.vx*.016,b.y-b.vy*.016,b.r+2,color+'38');circle(c,b.x,b.y,b.r,color);circle(c,b.x-1,b.y-1,b.r*.4,'#fff2df');}
 const p=s.player;circle(c,p.x,p.y+p.r*.7,p.r*1.2,'#00000030');
 const flash=p.invulnerable>0&&Math.sin(s.time*40)>0;c.globalAlpha=flash?.35:1;
 if(s.mode==='reflect')slime(c,s,'#9de0bd');else if(s.mode==='scrap')robot(c,s);else if(s.mode==='grow')grow(c,s);else{circle(c,p.x,p.y,19,'#abbcf0');round(c,p.x-13,p.y-7,26,15,7,'#2f4656');circle(c,p.x-5,p.y,2.5,'#d7f0e0');circle(c,p.x+5,p.y,2.5,'#d7f0e0');leaf(c,p.x+3,p.y-20,.4,'#cfddc2');}
 c.globalAlpha=1;
 if(s.mode==='yoyo'&&aim&&s.status==='running'&&!s.weapon){const a=Math.atan2(aim.y-p.y,aim.x-p.x);for(let i=1;i<5;i++)circle(c,p.x+Math.cos(a)*i*17,p.y+Math.sin(a)*i*17,1.5,'#bcc7f065');}
 for(const p of s.particles){c.globalAlpha=Math.min(1,p.life*2);circle(c,p.x,p.y,2.3,p.color);}c.globalAlpha=1;
 for(const t of s.texts){c.globalAlpha=Math.min(1,t.life*2);c.fillStyle=t.color;c.font='bold 12px system-ui';c.textAlign='center';c.fillText(t.text,t.x,t.y);}c.globalAlpha=1;
 if(s.mode==='reflect'&&s.cooldown>0){c.strokeStyle='#d9f5df70';c.lineWidth=2;c.beginPath();c.arc(p.x,p.y,p.r+9,-Math.PI/2,-Math.PI/2+TAU*(1-s.cooldown/(s.form===0?.9:.72)));c.stroke();}
 c.restore();
}
