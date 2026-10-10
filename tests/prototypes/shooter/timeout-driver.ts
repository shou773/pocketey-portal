import type {Observation} from './controller';
// Ordinary avoidance input, deliberately not aiming at the boss, to exercise a real deadline.
export function chooseTimeoutLane(s:Pick<Observation,'x'|'enemies'|'bullets'|'beams'>) {
 const enemy=s.enemies.find(e=>e.kind==='boss')||s.enemies.filter(e=>e.y>3).sort((a,b)=>a.y-b.y)[0],aim=enemy?enemy.x:0;let best=s.x,cost=Infinity;
 for(let x=-3.5;x<=3.5;x+=.25){let value=(enemy?.kind==='boss'?Math.exp(-((x-enemy.x)**2)/2)*40:Math.abs(x-aim)*.5)+Math.abs(x-s.x)*.22;
  for(const b of s.bullets){const t=(1.8-b.y)/b.vy;if(t>=-.12&&t<1.5){const dist=Math.abs(x-(b.x+b.vx*Math.max(t,0)));value+=Math.exp(-dist*dist/.3)*8*(1.6-Math.max(t,0));}if(Math.hypot(x-b.x,1.8-b.y)<.55)value+=20;
   for(let dt=.05;dt<.45;dt+=.05){const px=s.x+Math.sign(x-s.x)*Math.min(Math.abs(x-s.x),6.5*dt);if(Math.hypot(px-(b.x+b.vx*dt),1.8-(b.y+b.vy*dt))<.48)value+=12;}}
  for(const beam of s.beams)if(beam.age>.25&&beam.age<1.85){if(Math.abs(x-beam.x)<.7)value+=20;if(Math.min(x,s.x)<beam.x+.6&&Math.max(x,s.x)>beam.x-.6&&Math.abs(s.x-beam.x)>.6)value+=40;}
  if(value<cost){cost=value;best=x;}
 }return best;
}
