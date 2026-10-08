import * as T from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {batchStatic, type Art} from './art';

// Orbit-only paint and scenery: fixed lighting, opaque batches, no new textures.
export function paintOrbit(art: Art) {
  for (const name of ['craft_speederA', 'platform_small']) {
    art.get(name)?.scene.traverse(object => {
      if (!(object instanceof T.Mesh) || !(object.material instanceof T.MeshLambertMaterial)) return;
      const material=object.material.clone();
      if (name==='platform_small') {
        const hex=material.color.getHex();
        material.color.setHex(hex===0x708695?0x97adb6:hex===0x426272?0x486574:0x1b3047);
      } else {
        const r=material.color.r;
        material.color.setHex(r>.9?0x5acfc9:r>.8?0xe6ede6:r>.5?0x526f84:0x102b41);
      }
      object.material=material;
    });
  }
}

export function orbitPlanet() {
  const group=new T.Group();
  const geometry=new T.SphereGeometry(7.5,32,20);
  const colors:number[]=[];const positions=geometry.getAttribute('position');
  const sea=new T.Color(0x244c68),land=new T.Color(0x547f8b);
  for(let i=0;i<positions.count;i++) {
    const x=positions.getX(i),y=positions.getY(i),z=positions.getZ(i);
    const continent=Math.sin(x*.7+Math.sin(y*.9))*Math.cos(z*.6+y*.45);
    const color=sea.clone().lerp(land,T.MathUtils.smoothstep(continent,.12,.5));
    colors.push(color.r,color.g,color.b);
  }
  geometry.setAttribute('color',new T.Float32BufferAttribute(colors,3));
  group.add(new T.Mesh(geometry,new T.MeshLambertMaterial({color:0xffffff,vertexColors:true,fog:false})));
  const ring=new T.Mesh(new T.TorusGeometry(10.3,.085,3,64),new T.MeshBasicMaterial({color:0x5b8594,fog:false}));
  ring.rotation.set(1.13,.32,.2);group.add(ring);
  batchStatic(group,'orbit');return group;
}

export function orbitEngine(parent:T.Group) {
  const nozzle=new T.CylinderGeometry(.065,.08,.055,8);nozzle.rotateX(Math.PI/2);
  const material=new T.MeshBasicMaterial({color:0x91eee5});
  for(const x of [-.25,.25]) {
    const mesh=new T.Mesh(nozzle,material);mesh.position.set(x,.27,.36);parent.add(mesh);
  }
}

const hull=new T.MeshLambertMaterial({color:0x29445b});
const deck=new T.MeshLambertMaterial({color:0x6b8c9a});
const windows=new T.MeshBasicMaterial({color:0x77a9ae});
let relay:T.Group|undefined;
export async function loadOrbitRelay() {
  try {
    const model=await new GLTFLoader().loadAsync('/games/assets/orbit/lunar-relay.glb');
    model.scene.traverse(object=>{
      if(!(object instanceof T.Mesh))return;
      const original=object.material as T.MeshStandardMaterial;
      object.material=new T.MeshLambertMaterial({color:original.color});
    });
    relay=model.scene;return true;
  } catch {return false;}
}
export function orbitStation(parent:T.Group, x:number, z:number, side:number, box:(parent:T.Object3D,x:number,y:number,z:number,w:number,h:number,d:number,mat:T.Material)=>T.Mesh) {
  if(relay) {const station=relay.clone(true);station.position.set(x,0,z);parent.add(station);return;}
  // The entire station stays well outside the playable ribbon (width <= 7).
  box(parent,x,-3,z,7,1.1,11,hull);
  box(parent,x,-2.4,z,7.4,.22,11.4,deck);
  box(parent,x+side*1.8,1,z-1,2.7,6.8,4,hull);
  box(parent,x+side*1.8,4.5,z-1,3.3,.35,4.5,deck);
  for(let i=0;i<3;i++) box(parent,x+side*1.8,.3+i*1.15,z+1.02,1.9,.18,.04,windows);
  box(parent,x-side*1.8,-.8,z+2,2.3,2.2,4,deck);
  for(const dx of [-2.7,2.7])box(parent,x+dx,-4.6,z,.6,2.6,8,hull);
}
