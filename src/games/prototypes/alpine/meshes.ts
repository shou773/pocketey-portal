import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
export type Point = [number, number, number];
export const UP = new THREE.Vector3(0, 1, 0);
export const noise = (n: number) => { const v = Math.sin(n * 127.1 + 311.7) * 43758.5453; return v - Math.floor(v); };
export function triangles(points: Point[]) {
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(points.flat(), 3));
  geometry.computeVertexNormals();
  return geometry;
}
/** Bake static parts by material; one draw per material, not per detail. */
export class Parts {
  private batches = new Map<THREE.Material, THREE.BufferGeometry[]>();
  add(geometry: THREE.BufferGeometry, material: THREE.Material, position: Point = [0, 0, 0],
    scale: Point = [1, 1, 1], rotation: Point = [0, 0, 0]) {
    const g = geometry.index ? geometry.toNonIndexed() : geometry;
    if (g !== geometry) geometry.dispose();
    g.deleteAttribute('uv');
    g.applyMatrix4(new THREE.Matrix4().compose(new THREE.Vector3(...position),
      new THREE.Quaternion().setFromEuler(new THREE.Euler(...rotation)), new THREE.Vector3(...scale)));
    const batch = this.batches.get(material) ?? [];
    batch.push(g); this.batches.set(material, batch);
  }
  box(material: THREE.Material, position: Point, size: Point, rotation: Point = [0, 0, 0]) {
    this.add(new THREE.BoxGeometry(...size), material, position, [1, 1, 1], rotation);
  }
  finish(parent: THREE.Object3D) {
    for (const [material, parts] of this.batches) {
      const geometry = mergeGeometries(parts);
      parts.forEach(p => p.dispose());
      parent.add(new THREE.Mesh(geometry, material));
    }
    this.batches.clear();
  }
}
/** Continuous tapered shell, with six-sided cross sections. */
function shell(sections: { z: number; width: number; bottom: number; top: number }[]) {
  const rings = sections.map(s => [
    [-s.width*.78,s.bottom,s.z], [s.width*.78,s.bottom,s.z],
    [s.width,s.bottom+.035,s.z], [s.width*.94,s.top,s.z],
    [-s.width*.94,s.top,s.z], [-s.width,s.bottom+.035,s.z],
  ] as Point[]);
  const points: Point[] = [];
  for (let i = 1; i < rings.length; i++) for (let j = 0; j < 6; j++) {
    const a = rings[i-1][j], b = rings[i-1][(j+1)%6], c = rings[i][(j+1)%6], d = rings[i][j];
    points.push(a,b,c,a,c,d);
  }
  for (const [i, reverse] of [[0,true],[rings.length-1,false]] as const) {
    const ring = rings[i];
    for (let j=1; j<5; j++) points.push(ring[0],ring[reverse?j+1:j],ring[reverse?j:j+1]);
  }
  return triangles(points);
}
export function makeCar(material: (hex: number) => THREE.MeshLambertMaterial) {
  const car = new THREE.Group(); car.name = 'rally-car';
  const p = new Parts(), yellow = material(0xffc629), dark = material(0x202c31);
  const glass = material(0x263e4b), tire = material(0x202328), metal = material(0xa7b4b9);
  const ivory = material(0xffe7ba), red = material(0xc34c35);
  p.add(shell([
    {z:-.385,width:.205,bottom:.13,top:.215}, {z:-.30,width:.26,bottom:.13,top:.25},
    {z:-.13,width:.26,bottom:.14,top:.292}, {z:.22,width:.26,bottom:.14,top:.29},
    {z:.355,width:.228,bottom:.15,top:.27},
  ]), yellow);
  p.add(shell([
    {z:-.145,width:.212,bottom:.283,top:.293}, {z:-.025,width:.179,bottom:.285,top:.443},
    {z:.155,width:.179,bottom:.285,top:.443}, {z:.29,width:.202,bottom:.28,top:.306},
  ]), glass);
  p.box(yellow,[0,.448,.06],[.352,.025,.203]);
  p.box(dark,[0,.463,.06],[.07,.005,.20]);
  p.add(triangles([[-.035,.219,-.384],[.035,.219,-.384],[.035,.295,-.133],
    [-.035,.219,-.384],[.035,.295,-.133],[-.035,.295,-.133]]),dark);
  p.box(dark,[0,.276,.341],[.07,.006,.029]);
  p.box(dark,[0,.171,-.377],[.34,.043,.012]);
  p.box(dark,[0,.159,.357],[.39,.045,.014]);
  for (const side of [-1,1]) {
    p.box(ivory,[side*.143,.217,-.368],[.075,.043,.017]);
    p.box(red,[side*.157,.239,.355],[.087,.043,.014]);
    const pillar = (a: Point, b: Point, width: number) => {
      const midpoint = new THREE.Vector3(...a).add(new THREE.Vector3(...b)).multiplyScalar(.5);
      const direction = new THREE.Vector3(...b).sub(new THREE.Vector3(...a));
      const g = new THREE.CylinderGeometry(width,width,direction.length(),4);
      g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(UP,direction.normalize()));
      p.add(g,yellow,midpoint.toArray() as Point);
    };
    pillar([side*.197,.30,-.135],[side*.177,.439,-.025],.012);
    pillar([side*.177,.439,.155],[side*.197,.305,.28],.014);
    pillar([side*.18,.30,.08],[side*.18,.441,.08],.012);
    p.box(dark,[side*.249,.274,.06],[.008,.013,.065]);
    for (const z of [-.236,.232]) {
      p.add(new THREE.CylinderGeometry(.109,.109,.052,10),tire,[side*.25,.111,z],[1,1,1],[0,0,Math.PI/2]);
      p.add(new THREE.CylinderGeometry(.06,.06,.006,8),metal,[side*.277,.111,z],[1,1,1],[0,0,Math.PI/2]);
      p.add(new THREE.TorusGeometry(.116,.012,3,10,Math.PI),dark,[side*.251,.111,z],[1,1,1],[0,Math.PI/2,0]);
    }
  }
  p.finish(car); return car;
}
/** Tiered asymmetric branches alternate broad lobes and deep notches. */
export function treeGeometry(variant: number) {
  const points: Point[] = [], colors: number[] = [];
  const leaf = new THREE.Color(0x294d3b), bark = new THREE.Color(0x655847);
  const push = (a: Point,b: Point,c: Point,tint: THREE.Color) => {
    points.push(a,b,c); for (let i=0;i<3;i++) colors.push(tint.r,tint.g,tint.b);
  };
  const height = 2.4 + variant*.32;
  for (let tier=0;tier<4;tier++) {
    const base = .4+tier*height*.2, radius = (1-tier*.19)*(.68+variant*.03);
    const ring: Point[] = [], tip: Point = [.1*Math.sin(variant+tier),base+height*.39,.07*Math.cos(tier*2)];
    for (let i=0;i<12;i++) {
      const a=i*Math.PI/6+variant*.3+tier*.12;
      const r=radius*(i%2?.57:1)*(.88+.22*noise(i+tier*19+variant*51));
      ring.push([Math.cos(a)*r,base+.15*noise(i+tier*7),Math.sin(a)*r]);
    }
    for (let i=0;i<12;i++) {
      const tint=leaf.clone().multiplyScalar(.8+.35*noise(i+31*tier+variant*80));
      push(ring[i],tip,ring[(i+1)%12],tint);
      push(ring[(i+1)%12],[0,base-.1,0],ring[i],leaf.clone().multiplyScalar(.65));
    }
  }
  const trunk=new THREE.CylinderGeometry(.085,.12,.8,5).toNonIndexed();trunk.translate(0,.4,0);
  const pos=trunk.getAttribute('position');
  for(let i=0;i<pos.count;i+=3) push([pos.getX(i),pos.getY(i),pos.getZ(i)],
    [pos.getX(i+1),pos.getY(i+1),pos.getZ(i+1)],[pos.getX(i+2),pos.getY(i+2),pos.getZ(i+2)],bark);
  trunk.dispose();
  const g=triangles(points);g.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));return g;
}
export function rockGeometry(variant: number) {
  const g=new THREE.IcosahedronGeometry(1,0), pos=g.getAttribute('position');
  const colors:number[]=[], base=new THREE.Color(0x9b9588);
  for(let i=0;i<pos.count;i++) {
    const x=pos.getX(i),y=pos.getY(i),z=pos.getZ(i);
    const factor=.8+.3*noise(Math.round((x+2)*23+(y+2)*89+(z+2)*151)+variant*97);
    pos.setXYZ(i,x*factor,(y+1)*factor*.62,z*factor*(.7+variant*.14));
    const tint=base.clone().multiplyScalar(.82+.22*noise(Math.floor(i/3)+variant*51));
    colors.push(tint.r,tint.g,tint.b);
  }
  g.computeVertexNormals();g.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));return g;
}
