import * as THREE from 'three';
import type {State} from './model';
export function createView(canvas:HTMLCanvasElement) {
 const renderer=new THREE.WebGLRenderer({canvas,antialias:false,alpha:false,powerPreference:'low-power'});renderer.setPixelRatio(Math.min(devicePixelRatio,1.5));renderer.setClearColor(0x071323);
 const scene=new THREE.Scene();scene.fog=new THREE.Fog(0x071323,16,36);
 const camera=new THREE.PerspectiveCamera(48,1,.1,60);camera.position.set(0,14,10);camera.lookAt(0,0,-5);
 scene.add(new THREE.HemisphereLight(0xb5edff,0x16253b,2));const light=new THREE.DirectionalLight(0xffffff,2);light.position.set(-4,10,4);scene.add(light);
 // Original low-poly meshes, authored here; no external game artwork.
 type Part={geometry:THREE.BufferGeometry;color:number;position?:[number,number,number];rotation?:[number,number,number];scale?:[number,number,number]};
 function assemble(parts:Part[]) {
  const positions:number[]=[],normals:number[]=[],colors:number[]=[];
  for(const part of parts){const geometry=part.geometry.index?part.geometry.toNonIndexed():part.geometry.clone(),matrix=new THREE.Matrix4().compose(new THREE.Vector3(...(part.position||[0,0,0])),new THREE.Quaternion().setFromEuler(new THREE.Euler(...(part.rotation||[0,0,0]))),new THREE.Vector3(...(part.scale||[1,1,1])));geometry.applyMatrix4(matrix);const color=new THREE.Color(part.color),p=geometry.getAttribute('position'),n=geometry.getAttribute('normal');for(let i=0;i<p.count;i++){positions.push(p.getX(i),p.getY(i),p.getZ(i));normals.push(n.getX(i),n.getY(i),n.getZ(i));colors.push(color.r,color.g,color.b);}geometry.dispose();part.geometry.dispose();}
  const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));g.setAttribute('normal',new THREE.Float32BufferAttribute(normals,3));g.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));return g;
 }
 function hull(points:[number,number][],height:number,topScale=1){
  // Normalize winding so mirrored wings and rock sides face outward.
  if(THREE.ShapeUtils.area(points.map(([x,z])=>new THREE.Vector2(x,z)))<0)points=points.slice().reverse();
  const vertices:number[]=[],n=points.length,top=points.map(([x,z])=>[x*topScale,height,z*topScale]);
  const tri=(a:number[],b:number[],c:number[])=>vertices.push(...a,...b,...c);
  for(const [a,b,c] of THREE.ShapeUtils.triangulateShape(points.map(([x,z])=>new THREE.Vector2(x,z)),[])){tri(top[c],top[b],top[a]);tri([points[a][0],0,points[a][1]],[points[b][0],0,points[b][1]],[points[c][0],0,points[c][1]]);}
  for(let i=0;i<n;i++){const j=(i+1)%n,a=[points[i][0],0,points[i][1]],b=[points[j][0],0,points[j][1]];tri(a,top[i],top[j]);tri(a,top[j],b);}
  const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(vertices,3));g.computeVertexNormals();return g;
 }
 const box=(x:number,y:number,z:number)=>new THREE.BoxGeometry(x,y,z);
 const cylinder=(r:number,length:number)=>new THREE.CylinderGeometry(r,r,length,8);
 const white=0xe1e8de,blue=0x357597,dark=0x172a38;
 const shipGeometry=assemble([
  {geometry:hull([[0,-.72],[.16,-.35],[.18,.38],[.11,.52],[-.11,.52],[-.18,.38],[-.16,-.35]],.17,.72),color:white},
  {geometry:hull([[.12,-.15],[.58,.28],[.52,.43],[.15,.28]],.07),color:blue,position:[0,.03,0]},
  {geometry:hull([[-.12,-.15],[-.15,.28],[-.52,.43],[-.58,.28]],.07),color:blue,position:[0,.03,0]},
  {geometry:hull([[0,-.3],[.11,-.08],[.08,.22],[-.08,.22],[-.11,-.08]],.13,.7),color:dark,position:[0,.16,0]},
  ...[-1,1].flatMap(side=>[
   {geometry:cylinder(.105,.52),color:white,position:[side*.24,.10,.25] as [number,number,number],rotation:[Math.PI/2,0,0] as [number,number,number]},
   {geometry:cylinder(.075,.1),color:dark,position:[side*.24,.10,.54] as [number,number,number],rotation:[Math.PI/2,0,0] as [number,number,number]},
   {geometry:hull([[side*.18,.30],[side*.25,.47],[side*.25,.50]],.20),color:blue,position:[0,.08,0] as [number,number,number]}
  ])
 ]);
 const scoutGeometry=assemble([
  {geometry:hull([[0,.57],[.12,.10],[.11,-.37],[-.11,-.37],[-.12,.10]],.16,.75),color:0xe8ba7a},
  ...[-1,1].map(side=>({geometry:hull([[side*.08,.08],[side*.33,-.20],[side*.27,-.38],[side*.08,-.24]],.065),color:0xd3a569})),
  {geometry:box(.11,.045,.2),color:0x302a38,position:[0,.18,-.04]}
 ]);
 const fanGeometry=assemble([
  {geometry:hull([[0,.48],[.22,.20],[.24,-.28],[-.24,-.28],[-.22,.20]],.22,.8),color:0xd7ac88},
  ...[-1,1].flatMap(side=>[
   {geometry:hull([[side*.16,.12],[side*.62,.27],[side*.56,-.24],[side*.16,-.34]],.10,.9),color:0xc59875},
   {geometry:cylinder(.07,.38),color:0xe2b27e,position:[side*.38,.13,.26] as [number,number,number],rotation:[Math.PI/2,0,0] as [number,number,number]}
  ]),{geometry:box(.18,.06,.18),color:0x242c3b,position:[0,.23,.08]}
 ]);
 const bossGeometry=assemble([
  {geometry:hull([[-.82,-.65],[.82,-.65],[1.13,-.14],[.89,.57],[.34,.72],[-.34,.72],[-.89,.57],[-1.13,-.14]],.36,.8),color:0xb49a91},
  {geometry:cylinder(.35,.18),color:0xb59d91,position:[0,.43,-.06]},
  ...[-1,1].flatMap(side=>[
   {geometry:box(.29,.17,.58),color:0x96837c,position:[side*.65,.36,.10] as [number,number,number]},
   {geometry:cylinder(.09,.62),color:0xd4b08c,position:[side*.65,.40,.49] as [number,number,number],rotation:[Math.PI/2,0,0] as [number,number,number]},
   {geometry:box(.18,.09,.55),color:0x363e4f,position:[side*.91,.18,-.17] as [number,number,number]}
  ]),{geometry:box(.32,.07,.26),color:0x2b3341,position:[0,.55,-.04]}
 ]);
 const painted=new THREE.MeshStandardMaterial({vertexColors:true,roughness:.72,metalness:.15});
 const enemyPaint=new THREE.MeshStandardMaterial({vertexColors:true,roughness:.82,metalness:.05,fog:false});
 const geometries={ship:shipGeometry,scout:scoutGeometry,fan:fanGeometry,bullet:new THREE.SphereGeometry(.16,8,6),shot:box(.09,.1,.5),beam:box(1,.03,13),boss:bossGeometry};
 const materials={ship:painted,scout:enemyPaint,fan:enemyPaint,bullet:new THREE.MeshBasicMaterial({color:0xff416d}),shot:new THREE.MeshBasicMaterial({color:0x9affed}),beam:new THREE.MeshBasicMaterial({color:0xffbc50,transparent:true,opacity:.35}),boss:enemyPaint};
 const ship=new THREE.Mesh(geometries.ship,materials.ship);scene.add(ship);
 const exhaustGeometry=assemble([-1,1].map(side=>({geometry:new THREE.ConeGeometry(.075,.32,6),color:0x71eaff,position:[side*.24,.10,.74] as [number,number,number],rotation:[Math.PI/2,0,0] as [number,number,number]})));
 const exhaust=new THREE.Mesh(exhaustGeometry,new THREE.MeshBasicMaterial({vertexColors:true}));ship.add(exhaust);
 // Preserve the original collision-plane marker position; draw it over the new hull.
 const core=new THREE.Mesh(new THREE.SphereGeometry(.18,12,8),new THREE.MeshBasicMaterial({color:0xffffff,depthTest:false,depthWrite:false}));core.renderOrder=10;scene.add(core);
 const temp=new THREE.Object3D();
 const terrain=new THREE.MeshStandardMaterial({vertexColors:true,roughness:.95,metalness:0});
 const water=new THREE.Mesh(box(13.5,.08,24),new THREE.MeshStandardMaterial({color:0x163d48,roughness:.68,metalness:.12}));water.position.set(0,-.88,-8);scene.add(water);
 const cliffGeometry=assemble([
  {geometry:hull([[-1.5,-1.4],[1.2,-1.5],[1.6,-.3],[1.1,1.4],[-1.3,1.5],[-1.7,.2]],1.25,.82),color:0x3f5051},
  {geometry:hull([[-.9,-1],[.8,-.8],[1,.5],[.4,1],[-.9,.7]],.65,.7),color:0x59645e,position:[.3,1.1,0]}
 ]);
 const cliffs=new THREE.InstancedMesh(cliffGeometry,terrain,16);scene.add(cliffs);
 const platformGeometry=assemble([
  {geometry:box(1.35,.22,2.8),color:0x626d69},
  {geometry:box(.06,.025,2.3),color:0x98a58c,position:[-.44,.125,0]},
  {geometry:box(.06,.025,2.3),color:0x98a58c,position:[.44,.125,0]},
  {geometry:new THREE.TorusGeometry(.38,.025,4,12),color:0xc1b98c,position:[0,.13,.55],rotation:[Math.PI/2,0,0]}
 ]);
 const platforms=new THREE.InstancedMesh(platformGeometry,painted,3);scene.add(platforms);
 const facilityGeometry=assemble([
  {geometry:cylinder(.34,.7),color:0x8a9891,position:[0,.36,0]},
  {geometry:new THREE.ConeGeometry(.34,.18,8),color:0x515f61,position:[0,.80,0]},
  {geometry:cylinder(.14,.45),color:0x9a8c70,position:[.47,.24,0]},
  {geometry:cylinder(.055,1.25),color:0x82928f,position:[-.38,.20,-.13],rotation:[Math.PI/2,0,0]},
  {geometry:new THREE.TorusGeometry(.17,.055,4,8,Math.PI),color:0x82928f,position:[-.21,.20,.48],rotation:[Math.PI/2,0,0]},
  {geometry:box(.12,.08,.12),color:0xa9bda5,position:[0,.90,0]}
 ]);
 const facilities=new THREE.InstancedMesh(facilityGeometry,painted,3);scene.add(facilities);
 const pipeGeometry=assemble([{geometry:cylinder(.075,2.6),color:0x778981,rotation:[Math.PI/2,0,0]},...[-1,1].map(z=>({geometry:box(.20,.3,.14),color:0x414c4a,position:[0,-.13,z] as [number,number,number]}))]);
 const pipes=new THREE.InstancedMesh(pipeGeometry,painted,5);scene.add(pipes);
 const ripples=new THREE.InstancedMesh(box(.018,.008,1.3),new THREE.MeshBasicMaterial({color:0x285059}),12);scene.add(ripples);
 const shoreGeometry=hull([[-.08,-1.35],[.12,-.75],[.02,-.1],[.18,.6],[-.02,1.3],[-.09,1.27],[.11,.58],[-.05,-.09],[.05,-.73],[-.15,-1.34]],.008);
 const shore=new THREE.InstancedMesh(shoreGeometry,new THREE.MeshBasicMaterial({color:0x72979c,transparent:true,opacity:.48,depthWrite:false}),16);scene.add(shore);
 const meshes=new Map<string,THREE.Mesh>();let dimensions='';
 function sync(key:string,kind:keyof typeof geometries,x:number,y:number,scale=1) {let m=meshes.get(key);if(!m){m=new THREE.Mesh(geometries[kind],materials[kind]);meshes.set(key,m);scene.add(m);}m.visible=true;m.position.set(x,kind==='beam'?0:.45,-y);m.scale.setScalar(scale);return m;}
 function resize(){const w=canvas.clientWidth,h=canvas.clientHeight;if(dimensions===`${w},${h}`)return;dimensions=`${w},${h}`;renderer.setSize(w,h,false);camera.aspect=w/h; // Keep the entire combat width visible at 320px and in landscape.
 camera.fov=camera.aspect<.65?64:48;camera.updateProjectionMatrix();}
 function draw(s:State){resize();ship.position.set(s.x,.4,-s.y);ship.rotation.z=-s.x*.025;exhaust.scale.z=.88+.12*Math.sin(s.time*24);ship.visible=s.invulnerable<=0||Math.floor(s.time*12)%2===0;core.position.set(s.x,.45,-s.y);core.visible=ship.visible;for(const m of meshes.values())m.visible=false;
 for(const e of s.enemies){const m=sync(`e${e.id}`,e.kind,e.x,e.y);m.rotation.y=0;m.rotation.z=Math.sin(s.time*1.8+e.id)*.04;}
 for(const b of s.bullets)sync(`b${b.id}`,'bullet',b.x,b.y);
 for(const b of s.shots)sync(`s${b.id}`,'shot',b.x,b.y);
 s.beams.forEach((b,i)=>{const m=sync(`beam${i}`,'beam',b.x,5.5);m.scale.set(b.wide,1,1);(m.material as THREE.MeshBasicMaterial).opacity=b.age<1.3?.15+.13*(Math.sin(b.age*18)+1):.85;});
 for(const [key,m] of meshes)if(!m.visible){scene.remove(m);meshes.delete(key);}
 // Uneven opposing shores; the same reusable rocks vary in height, width and phase.
 const scroll=(distance:number)=>-((distance-s.time*1.2)%24+24)%24+2;
 const bankDistances=[.3,2.8,6.5,8.6,12.8,15.1,18.9,22.3];
 for(let i=0;i<16;i++){
  const side=i%2?1:-1,row=Math.floor(i/2),sx=.73+(i*7%5)*.13,sz=.74+(i*3%4)*.22,angle=(side<0?Math.PI:0)+(.5-(i*3%7)/6)*.28;
  const x=side*(5.62+(i*5%7)*.11),z=scroll(bankDistances[row]+(side<0?1.45:0));
  temp.position.set(x,-1.25,z);temp.rotation.set(0,angle,0);temp.scale.set(sx,.58+(i*5%7)*.15,sz);temp.updateMatrix();cliffs.setMatrixAt(i,temp.matrix);
  // Broken, low-contrast waterline strokes follow each rock's inner edge.
  temp.position.set(x-side*1.53*sx,-.83,z);temp.rotation.set(0,side<0?Math.PI:0,0);temp.scale.set(1,1,sz*.8);temp.updateMatrix();shore.setMatrixAt(i,temp.matrix);
 }
 const pads=[{side:-1,distance:3.5},{side:1,distance:10.8},{side:-1,distance:19.5}];
 for(let i=0;i<pads.length;i++){const {side,distance}=pads[i],z=scroll(distance);temp.position.set(side*4.85,-.42,z);temp.rotation.set(0,0,0);temp.scale.set(1,1,1);temp.updateMatrix();platforms.setMatrixAt(i,temp.matrix);temp.position.set(side*5.08,-.31,z-.75);temp.updateMatrix();facilities.setMatrixAt(i,temp.matrix);}
 for(let i=0;i<5;i++){const side=i%2?1:-1;temp.position.set(side*4.52,-.13,scroll([2.5,10,5.6,13.1,20.2][i]));temp.rotation.set(0,0,0);temp.scale.set(1,1,1);temp.updateMatrix();pipes.setMatrixAt(i,temp.matrix);}
 for(let i=0;i<12;i++){temp.position.set((i%2?1:-1)*(2.8+(i%3)*.35),-.83,scroll(Math.floor(i/2)*4));temp.rotation.set(0,0,0);temp.scale.set(1,1,1);temp.updateMatrix();ripples.setMatrixAt(i,temp.matrix);}
 for(const instanced of [cliffs,platforms,facilities,pipes,ripples,shore])instanced.instanceMatrix.needsUpdate=true;
 renderer.setClearColor(s.hit>0?0x42233b:0x071323);renderer.render(scene,camera);}
 const ray=new THREE.Raycaster(),plane=new THREE.Plane(new THREE.Vector3(0,1,0),-.4),point=new THREE.Vector3();
 function pointer(x:number,y:number){const r=canvas.getBoundingClientRect();ray.setFromCamera(new THREE.Vector2((x-r.left)/r.width*2-1,-(y-r.top)/r.height*2+1),camera);if(!ray.ray.intersectPlane(plane,point))return null;return {x:point.x,y:-point.z};}
 function project(x:number,y:number){const p=new THREE.Vector3(x,.4,-y).project(camera),r=canvas.getBoundingClientRect();return {x:r.left+(p.x+1)/2*r.width,y:r.top+(1-p.y)/2*r.height};}
 function dispose(){for(const g of Object.values(geometries))g.dispose();for(const m of Object.values(materials))m.dispose();scene.traverse(o=>{if(o instanceof THREE.Mesh){if(o instanceof THREE.InstancedMesh)o.dispose();o.geometry.dispose();if(!Array.isArray(o.material))o.material.dispose();}});renderer.dispose();}
 return {draw,pointer,project,dispose,stats:()=>({calls:renderer.info.render.calls,triangles:renderer.info.render.triangles})};
}
