import * as THREE from 'three';
import type {State} from './model';
export function createView(canvas:HTMLCanvasElement) {
 const renderer=new THREE.WebGLRenderer({canvas,antialias:false,alpha:false,powerPreference:'low-power'});renderer.setPixelRatio(Math.min(devicePixelRatio,1.5));renderer.setClearColor(0x071323);
 const scene=new THREE.Scene();scene.fog=new THREE.Fog(0x071323,16,36);
 const camera=new THREE.PerspectiveCamera(48,1,.1,60);camera.position.set(0,14,10);camera.lookAt(0,0,-5);
 scene.add(new THREE.HemisphereLight(0xb5edff,0x16253b,2));const light=new THREE.DirectionalLight(0xffffff,2);light.position.set(-4,10,4);scene.add(light);
 const geometries={ship:new THREE.ConeGeometry(.37,.85,4),enemy:new THREE.OctahedronGeometry(.48),bullet:new THREE.SphereGeometry(.16,8,6),shot:new THREE.BoxGeometry(.09,.1,.5),beam:new THREE.BoxGeometry(1,.03,13),boss:new THREE.OctahedronGeometry(1),tile:new THREE.BoxGeometry(.05,.02,16)};
 const materials={ship:new THREE.MeshStandardMaterial({color:0x67ecff,emissive:0x167a99,metalness:.4,roughness:.4}),enemy:new THREE.MeshStandardMaterial({color:0xf2809d,emissive:0x6b1938}),bullet:new THREE.MeshBasicMaterial({color:0xff416d}),shot:new THREE.MeshBasicMaterial({color:0x9affed}),beam:new THREE.MeshBasicMaterial({color:0xffbc50,transparent:true,opacity:.35}),boss:new THREE.MeshStandardMaterial({color:0xd890ff,emissive:0x52217b}),tile:new THREE.MeshBasicMaterial({color:0x183c55})};
 const ship=new THREE.Mesh(geometries.ship,materials.ship);ship.rotation.x=-Math.PI/2;scene.add(ship);
 const core=new THREE.Mesh(new THREE.SphereGeometry(.18,12,8),new THREE.MeshBasicMaterial({color:0xffffff}));core.position.y=.6;scene.add(core);
 // Repeated infrastructure is instanced: depth without a draw call per prop.
 const temp=new THREE.Object3D();
 const deckMaterial=new THREE.MeshStandardMaterial({color:0x0d2639,roughness:.82,metalness:.18});
 const deck=new THREE.Mesh(new THREE.BoxGeometry(8.8,.3,19),deckMaterial);deck.position.set(0,-.38,-7.5);scene.add(deck);
 const grid=new THREE.InstancedMesh(geometries.tile,materials.tile,9);for(let i=0;i<9;i++){temp.position.set(i-4,-.21,-5);temp.updateMatrix();grid.setMatrixAt(i,temp.matrix);}scene.add(grid);
 const cross=new THREE.InstancedMesh(new THREE.BoxGeometry(8,.025,.025),materials.tile,12);scene.add(cross);
 const towerMaterial=new THREE.MeshStandardMaterial({color:0x294357,roughness:.72,metalness:.2});
 const towers=new THREE.InstancedMesh(new THREE.BoxGeometry(.7,1,1.1),towerMaterial,18);scene.add(towers);
 const shoulders=new THREE.InstancedMesh(new THREE.BoxGeometry(1.25,.3,1.6),deckMaterial,18);scene.add(shoulders);
 const caps=new THREE.InstancedMesh(new THREE.BoxGeometry(.82,.14,1.22),towerMaterial,18);scene.add(caps);
 const farMaterial=new THREE.MeshStandardMaterial({color:0x132a3d,roughness:.95});
 const skyline=new THREE.InstancedMesh(new THREE.BoxGeometry(2,1,2),farMaterial,14);for(let i=0;i<14;i++){temp.position.set((i%2?1:-1)*(9+i%3*2),-1,-8-Math.floor(i/2)*4);temp.scale.set(1,2+i%4,1);temp.updateMatrix();skyline.setMatrixAt(i,temp.matrix);}scene.add(skyline);
 temp.scale.set(1,1,1);
 const meshes=new Map<string,THREE.Mesh>();let dimensions='';
 function sync(key:string,kind:keyof typeof geometries,x:number,y:number,scale=1) {let m=meshes.get(key);if(!m){m=new THREE.Mesh(geometries[kind],materials[kind]);meshes.set(key,m);scene.add(m);}m.visible=true;m.position.set(x,kind==='beam'?0:.45,-y);m.scale.setScalar(scale);return m;}
 function resize(){const w=canvas.clientWidth,h=canvas.clientHeight;if(dimensions===`${w},${h}`)return;dimensions=`${w},${h}`;renderer.setSize(w,h,false);camera.aspect=w/h; // Keep the entire combat width visible at 320px and in landscape.
 camera.fov=camera.aspect<.65?64:48;camera.updateProjectionMatrix();}
 function draw(s:State){resize();ship.position.set(s.x,.4,-s.y);ship.rotation.z=-s.x*.045;ship.visible=s.invulnerable<=0||Math.floor(s.time*12)%2===0;core.position.set(s.x,.45,-s.y);core.visible=ship.visible;for(const m of meshes.values())m.visible=false;
 for(const e of s.enemies){const m=sync(`e${e.id}`,e.kind==='boss'?'boss':'enemy',e.x,e.y);m.rotation.y=s.time;m.rotation.z=s.time*.3;}
 for(const b of s.bullets)sync(`b${b.id}`,'bullet',b.x,b.y);
 for(const b of s.shots)sync(`s${b.id}`,'shot',b.x,b.y);
 s.beams.forEach((b,i)=>{const m=sync(`beam${i}`,'beam',b.x,5.5);m.scale.set(b.wide,1,1);(m.material as THREE.MeshBasicMaterial).opacity=b.age<1.3?.15+.13*(Math.sin(b.age*18)+1):.85;});
 for(const [key,m] of meshes)if(!m.visible){scene.remove(m);meshes.delete(key);}
 for(let i=0;i<12;i++){temp.position.set(0,-.21,-((i*1.4-s.time*2)%16+16)%16+1);temp.scale.set(1,1,1);temp.updateMatrix();cross.setMatrixAt(i,temp.matrix);}cross.instanceMatrix.needsUpdate=true;
 for(let i=0;i<18;i++){const z=-((Math.floor(i/2)*2-s.time*2)%18+18)%18,height=1.2+(i%3)*.65,x=i%2?5:-5;temp.position.set(x,height/2-.35,z);temp.scale.set(1,height,1);temp.updateMatrix();towers.setMatrixAt(i,temp.matrix);temp.position.y=-.18;temp.scale.set(1,1,1);temp.updateMatrix();shoulders.setMatrixAt(i,temp.matrix);temp.position.y=height-.28;temp.updateMatrix();caps.setMatrixAt(i,temp.matrix);}towers.instanceMatrix.needsUpdate=true;shoulders.instanceMatrix.needsUpdate=true;caps.instanceMatrix.needsUpdate=true;
 renderer.setClearColor(s.hit>0?0x42233b:0x071323);renderer.render(scene,camera);}
 const ray=new THREE.Raycaster(),plane=new THREE.Plane(new THREE.Vector3(0,1,0),-.4),point=new THREE.Vector3();
 function pointer(x:number,y:number){const r=canvas.getBoundingClientRect();ray.setFromCamera(new THREE.Vector2((x-r.left)/r.width*2-1,-(y-r.top)/r.height*2+1),camera);if(!ray.ray.intersectPlane(plane,point))return null;return {x:point.x,y:-point.z};}
 function project(x:number,y:number){const p=new THREE.Vector3(x,.4,-y).project(camera),r=canvas.getBoundingClientRect();return {x:r.left+(p.x+1)/2*r.width,y:r.top+(1-p.y)/2*r.height};}
 function dispose(){for(const g of Object.values(geometries))g.dispose();for(const m of Object.values(materials))m.dispose();scene.traverse(o=>{if(o instanceof THREE.Mesh){if(o instanceof THREE.InstancedMesh)o.dispose();o.geometry.dispose();if(!Array.isArray(o.material))o.material.dispose();}});renderer.dispose();}
 return {draw,pointer,project,dispose,stats:()=>({calls:renderer.info.render.calls,triangles:renderer.info.render.triangles})};
}
