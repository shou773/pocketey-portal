import * as T from 'three';
import {batchStatic, type Art} from './art';
import type {Hazard, Platform} from './model';

// Authored in game units. Opaque parts and bright accents share a vertex-lit
// batch, with no texture, runtime lighting pass or postprocess.
const paint = {
  ivory: new T.MeshLambertMaterial({color:0xe3dac3}),
  teal: new T.MeshLambertMaterial({color:0x299a98}),
  darkTeal: new T.MeshLambertMaterial({color:0x184b59}),
  canopy: new T.MeshLambertMaterial({color:0x102739}),
  glassEdge: new T.MeshLambertMaterial({color:0x72b5bc}),
  engine: new T.MeshLambertMaterial({color:0xffc779}),
  deck: new T.MeshLambertMaterial({color:0x263b52}),
  keel: new T.MeshLambertMaterial({color:0x142336}),
  seam: new T.MeshLambertMaterial({color:0x34495b}),
  mint: new T.MeshLambertMaterial({color:0x83d6c2}),
  vertex: new T.MeshLambertMaterial({color:0xffffff,vertexColors:true}),
  floorLip: new T.MeshLambertMaterial({color:0xb6c7c3}),
  gold: new T.MeshLambertMaterial({color:0xd9af69}),
  station: new T.MeshLambertMaterial({color:0x16263b}),
  stationEdge: new T.MeshLambertMaterial({color:0x21364b}),
  window: new T.MeshLambertMaterial({color:0x6097a2}),
};
const cube=new T.BoxGeometry(1,1,1);
const frontPlane=new T.PlaneGeometry(1,1);
const topPlane=new T.PlaneGeometry(1,1);topPlane.rotateX(-Math.PI/2);
function part(parent:T.Object3D, geometry:T.BufferGeometry, material:T.Material, x:number,y:number,z:number, sx=1,sy=1,sz=1) {
  const mesh=new T.Mesh(geometry,material);mesh.position.set(x,y,z);mesh.scale.set(sx,sy,sz);parent.add(mesh);return mesh;
}
function box(parent:T.Object3D, material:T.Material, x:number,y:number,z:number, w:number,h:number,d:number) {
  return part(parent,cube,material,x,y,z,w,h,d);
}
function bevel(w:number,h:number,d:number,b:number) {
  // Twenty triangles: a front bevel catches the key light without tessellating
  // the unseen rear edges. Duplicate face vertices retain crisp flat normals.
  const corners=[[-1,-1],[1,-1],[1,1],[-1,1]];
  const rings=[[w/2-b,h/2-b,d/2],[w/2,h/2,d/2-b],[w/2,h/2,-d/2]];
  const vertices=rings.flatMap(([x,y,z])=>corners.map(([sx,sy])=>[sx*x,sy*y,z]));
  const positions:number[]=[];
  const quad=(a:number,b:number,c:number,d:number)=>{for(const i of [a,b,c,a,c,d])positions.push(...vertices[i]);};
  quad(0,1,2,3);quad(11,10,9,8);
  for(let ring=0;ring<2;ring++)for(let i=0;i<4;i++) {
    const a=ring*4+i,next=ring*4+(i+1)%4;quad(a,a+4,next+4,next);
  }
  const geometry=new T.BufferGeometry();geometry.setAttribute('position',new T.Float32BufferAttribute(positions,3));
  geometry.setIndex(Array.from({length:positions.length/3},(_,i)=>i));geometry.computeVertexNormals();return geometry;
}
const bevelUnit=bevel(1,1,1,.045);

// Authored face colors reinforce the fixed key light without a draw call per
// face. These geometries are separate from the unchanged capsule parts.
function facePaint(source:T.BufferGeometry, top:number, front:number, side:number) {
  const geometry=source.clone(),normal=geometry.getAttribute('normal');
  const colors:number[]=[];
  for(let i=0;i<normal.count;i++) {
    const color=new T.Color(normal.getY(i)>.4?top:normal.getZ(i)>.5?front:side);
    colors.push(color.r,color.g,color.b);
  }
  geometry.setAttribute('color',new T.Float32BufferAttribute(colors,3));return geometry;
}
const floorWall=facePaint(cube,0x485f73,0x435e78,0x344b63);
const floorBacking=facePaint(cube,0x485f73,0x203348,0x26394f);
const shutterCase=facePaint(bevelUnit,0xf29377,0xce6154,0x74363d);
const shutterPanel=facePaint(bevelUnit,0xb25a4d,0x934940,0x622d34);
const capShape=bevel(1,1,1,.12);
const shutterCap=facePaint(capShape,0xffd58e,0xd9ae69,0x896538);capShape.dispose();

// The previous normalized speeder occupied [-.4,.4] x [.12,.504] x [-.42,.42].
// Keep that silhouette envelope and the existing forgiving center collider.
const hull=new T.SphereGeometry(1,12,6);
const canopy=new T.SphereGeometry(1,12,6);
const engine=new T.CylinderGeometry(.044,.044,.022,8);engine.rotateX(Math.PI/2);
const engineRim=new T.CylinderGeometry(.064,.064,.07,8);engineRim.rotateX(Math.PI/2);
function wing(side:number) {
  const shape=new T.Shape();
  shape.moveTo(side*.16,-.16);shape.lineTo(side*.4,.16);
  shape.lineTo(side*.37,.31);shape.lineTo(side*.16,.23);shape.closePath();
  const geometry=new T.ExtrudeGeometry(shape,{depth:.055,bevelEnabled:false,steps:1,curveSegments:1});
  // The authored X/Y outline becomes X/Z; thickness points down from y=.29.
  geometry.rotateX(Math.PI/2);geometry.translate(0,.29,0);
  geometry.setIndex(Array.from({length:geometry.getAttribute('position').count},(_,i)=>i));return geometry;
}
const wings=[wing(-1),wing(1)];
export function orbitCraft() {
  const ship=new T.Group();
  part(ship,hull,paint.darkTeal,0,.237,0,.22,.117,.42);
  part(ship,hull,paint.ivory,0,.29,-.025,.225,.135,.395);
  for(const geometry of wings)part(ship,geometry,paint.teal,0,0,0);
  // Ivory shoulder strips separate the canopy from both turquoise flanks.
  for(const side of [-1,1]) {
    part(ship,bevelUnit,paint.teal,side*.19,.30,.025,.085,.115,.52);
    part(ship,bevelUnit,paint.ivory,side*.15,.355,-.035,.055,.07,.49);
    part(ship,engineRim,paint.darkTeal,side*.135,.245,.374);
    part(ship,engine,paint.engine,side*.135,.245,.409);
  }
  part(ship,canopy,paint.canopy,0,.398,-.065,.115,.106,.205);
  part(ship,bevelUnit,paint.glassEdge,0,.454,.08,.14,.018,.025);
  part(ship,bevelUnit,paint.teal,0,.375,-.306,.095,.024,.11);
  batchStatic(ship,'orbit');return ship;
}

export function orbitPlatform(parent:T.Group,p:Platform) {
  const mid=-(p.a+p.b)/2,len=p.b-p.a;
  // Recess the backing at each end. Three solid end panels and their shallow
  // joints show a wall beneath the unchanged landing surface, within a/b.
  part(parent,floorBacking,paint.vertex,p.z,p.y-.43,mid,p.w,.72,len-.08);
  for(const z of [-p.a-.04,-p.b+.04]) {
    for(const column of [-1,0,1])
      part(parent,floorWall,paint.vertex,p.z+column*p.w/3,p.y-.43,z,p.w/3-.045,.72,.08);
    box(parent,paint.floorLip,p.z,p.y-.10,z,p.w,.08,.08);
  }
  box(parent,paint.keel,p.z,p.y-.76,mid,p.w-.18,.20,len);
  box(parent,paint.deck,p.z,p.y-.035,mid,p.w-.64,.05,len);
  for(const side of [-1,1]) {
    const edge=p.z+side*(p.w/2-.17);
    // Continuous backing with a few painted seams reads as repeated panels,
    // without submitting the hidden end/underside faces of individual tiles.
    box(parent,paint.ivory,edge,p.y-.03,mid,.32,.12,len-.06);
    for(let x=p.a+5;x<p.b-.1;x+=5)
      part(parent,topPlane,paint.seam,edge,p.y+.031,-x,.32,1,.045);
    box(parent,paint.mint,p.z+side*(p.w/2-.36),p.y+.006,mid,.035,.018,len);
    box(parent,paint.darkTeal,p.z+side*(p.w/2-.035),p.y-.59,mid,.07,.10,len);
  }
  for(let x=p.a+5;x<p.b-.3;x+=5)
    part(parent,topPlane,paint.seam,p.z,p.y-.007,-x,p.w-.78,1,.025);
}

export function orbitShutter(parent:T.Group,h:Hazard) {
  const shutter=new T.Group();shutter.position.set(h.z,h.y,-h.x);
  // A full opaque slab backs the recess. All decoration stays within the
  // original w/h/d bounds; the center cannot read as a passage underneath.
  part(shutter,shutterCase,paint.vertex,0,h.h/2,-.11,h.w,h.h,h.d-.22);
  // A real 0.19-unit setback, with dark side reveals and a lit top shoulder.
  part(shutter,shutterPanel,paint.vertex,0,h.h/2,h.d/2-.245,h.w-.48,h.h-.56,.11);
  for(const side of [-1,1]) {
    part(shutter,shutterCase,paint.vertex,side*(h.w/2-.12),h.h/2,0,.24,h.h-.56,h.d);
    part(shutter,shutterCase,paint.vertex,0,side<0?.14:h.h-.14,0,h.w-.48,.28,h.d);
    for(const y of [.22,h.h-.22])
      part(shutter,shutterCap,paint.vertex,side*(h.w/2-.18),y,0,.36,.44,h.d);
    const stripe=part(shutter,frontPlane,paint.gold,side*h.w*.17,h.h*.5,h.d/2-.176,.095,h.h*.40);
    stripe.rotation.z=-.46;
  }
  parent.add(shutter);
}

export function orbitPlanet() {
  const group=new T.Group(),geometry=new T.SphereGeometry(7.5,32,20);
  const colors:number[]=[],positions=geometry.getAttribute('position');
  const deep=new T.Color(0x245365),light=new T.Color(0x498981);
  for(let i=0;i<positions.count;i++) {
    const latitude=(positions.getY(i)+positions.getX(i)*.16)/7.5;
    const band=.5+.5*Math.sin(latitude*12+.35*Math.sin(positions.getZ(i)*.23));
    const color=deep.clone().lerp(light,T.MathUtils.smoothstep(band,.2,.8));
    colors.push(color.r,color.g,color.b);
  }
  geometry.setAttribute('color',new T.Float32BufferAttribute(colors,3));
  group.add(new T.Mesh(geometry,new T.MeshLambertMaterial({vertexColors:true,fog:false})));
  const ring=new T.Mesh(new T.TorusGeometry(10.3,.065,3,64),new T.MeshBasicMaterial({color:0x95876b,fog:false}));
  ring.rotation.set(1.13,.32,.2);group.add(ring);
  batchStatic(group,'orbit');geometry.dispose();ring.geometry.dispose();return group;
}

export function orbitStation(parent:T.Group,x:number,z:number,side:number) {
  // Distant silhouette only, well outside the playable ribbon (width <= 7).
  box(parent,paint.station,x,-3,z,7,1.1,11);
  box(parent,paint.stationEdge,x,-2.4,z,7.4,.22,11.4);
  box(parent,paint.station,x+side*1.8,1,z-1,2.7,6.8,4);
  box(parent,paint.stationEdge,x+side*1.8,4.5,z-1,3.3,.35,4.5);
  for(let i=0;i<3;i++)box(parent,paint.window,x+side*1.8,.3+i*1.15,z+1.02,1.6,.11,.04);
  box(parent,paint.station,x-side*1.8,-.8,z+2,2.3,2.2,4);
  for(const dx of [-2.7,2.7])box(parent,paint.station,x+dx,-4.6,z,.6,2.6,8);
}

export function paintOrbitScenery(art:Art) {
  for(const source of art.values())source.scene.traverse(object=>{
    if(!(object instanceof T.Mesh) || !(object.material instanceof T.MeshLambertMaterial))return;
    const material=object.material.clone();
    material.color.setHex(material.color.r>.5?0x3b5062:0x253a4e);
    object.material=material;
  });
}
