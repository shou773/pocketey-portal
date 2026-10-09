export type Observation={time:number;x:number;y:number;hp:number;status:string;score:number;enemies:{kind:string;x:number;y:number;hp:number}[];bullets:{x:number;y:number;vx:number;vy:number}[];beams:{x:number;age:number;wide:number}[];screen:{x:number;y:number};limits:{x:number;y:number}[];render:{calls:number;triangles:number}};
// Same bounded observational controller as the retained native Pulse play test.
// It drives ordinary inputs; it never writes engine state or bypasses damage.
export function chooseLane(s:Pick<Observation,'x'|'enemies'|'bullets'|'beams'>) {
 const enemy=s.enemies.find(e=>e.kind==='boss')||s.enemies.filter(e=>e.y>3).sort((a,b)=>a.y-b.y)[0],aim=enemy?enemy.x:0;let best=s.x,cost=Infinity;
 for(let x=-3.5;x<=3.5;x+=.25){let value=Math.abs(x-aim)*.5+Math.abs(x-s.x)*.22;
  for(const b of s.bullets){const t=(1.8-b.y)/b.vy;if(t>=-.12&&t<1.5){const dist=Math.abs(x-(b.x+b.vx*Math.max(t,0)));value+=Math.exp(-dist*dist/.3)*8*(1.6-Math.max(t,0));}if(Math.hypot(x-b.x,1.8-b.y)<.55)value+=20;
   for(let dt=.05;dt<.45;dt+=.05){const px=s.x+Math.sign(x-s.x)*Math.min(Math.abs(x-s.x),6.5*dt);if(Math.hypot(px-(b.x+b.vx*dt),1.8-(b.y+b.vy*dt))<.48)value+=12;}}
  for(const beam of s.beams)if(beam.age>.25&&beam.age<1.85){if(Math.abs(x-beam.x)<.7)value+=20;if(Math.min(x,s.x)<beam.x+.6&&Math.max(x,s.x)>beam.x-.6&&Math.abs(s.x-beam.x)>.6)value+=40;}
  if(value<cost){cost=value;best=x;}
 }return best;
}
