import * as THREE from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import type {State} from './model';
export function createView(canvas:HTMLCanvasElement) {
 const renderer=new THREE.WebGLRenderer({canvas,antialias:false,alpha:false,powerPreference:'low-power'});renderer.setPixelRatio(Math.min(devicePixelRatio,1.5));renderer.setClearColor(0x214651);
 const scene=new THREE.Scene();scene.fog=new THREE.Fog(0x214651,16,36);
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
 function flat(points:[number,number][]) {const g=new THREE.ShapeGeometry(new THREE.Shape(points.map(([x,z])=>new THREE.Vector2(x,-z))));g.rotateX(-Math.PI/2);return g;}
 const box=(x:number,y:number,z:number)=>new THREE.BoxGeometry(x,y,z);
 const cylinder=(r:number,length:number)=>new THREE.CylinderGeometry(r,r,length,8);
 const white=0xe8ece0,blue=0x43839e,dark=0x1b3a50;
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
 // Diffuse lighting keeps facet shading while avoiding unnecessary PBR fragment work.
 const painted=new THREE.MeshLambertMaterial({vertexColors:true});
 const enemyPaint=new THREE.MeshLambertMaterial({vertexColors:true,fog:false});
 const geometries={ship:shipGeometry,scout:scoutGeometry,fan:fanGeometry,bullet:new THREE.SphereGeometry(.16,8,6),shot:box(.09,.1,.5),beam:box(1,.03,13),boss:bossGeometry};
 const materials={ship:painted,scout:enemyPaint,fan:enemyPaint,bullet:new THREE.MeshBasicMaterial({color:0xff416d}),shot:new THREE.MeshBasicMaterial({color:0x9affed}),beam:new THREE.MeshBasicMaterial({color:0xffbc50,transparent:true,opacity:.35}),boss:enemyPaint};
 const ship=new THREE.Mesh(geometries.ship,materials.ship);scene.add(ship);
 const exhaustGeometry=assemble([-1,1].map(side=>({geometry:new THREE.ConeGeometry(.075,.32,6),color:0x71eaff,position:[side*.24,.10,.74] as [number,number,number],rotation:[Math.PI/2,0,0] as [number,number,number]})));
 const exhaust=new THREE.Mesh(exhaustGeometry,new THREE.MeshBasicMaterial({vertexColors:true}));ship.add(exhaust);
 // Keep the collision-plane marker readable while the damaged hull blinks.
 const core=new THREE.Mesh(new THREE.SphereGeometry(.18,12,8),new THREE.MeshBasicMaterial({color:0xffffff,depthTest:false,depthWrite:false}));core.renderOrder=10;scene.add(core);
 const temp=new THREE.Object3D();
 const terrain=new THREE.MeshLambertMaterial({vertexColors:true});
 // Shallow shelves fade into a quiet, darker channel; static vertex paint only.
 const waterGeometry=new THREE.PlaneGeometry(13.5,24,6,8);waterGeometry.rotateX(-Math.PI/2);
 const waterPositions=waterGeometry.getAttribute('position'),waterColors:number[]=[];
 const deepWater=new THREE.Color(0x103e4a),shelfWater=new THREE.Color(0x2a6770);
 for(let i=0;i<waterPositions.count;i++){
  const x=waterPositions.getX(i),z=waterPositions.getZ(i),shelf=THREE.MathUtils.smoothstep(Math.abs(x),3.1,6.7);
  const drift=.06*Math.sin(z*.28+x*.24)+.035*Math.cos(z*.19-x*.32);
  const color=deepWater.clone().lerp(shelfWater,THREE.MathUtils.clamp(.08+shelf*.66+drift,0,1));waterColors.push(color.r,color.g,color.b);
 }
 waterGeometry.setAttribute('color',new THREE.Float32BufferAttribute(waterColors,3));
 const water=new THREE.Mesh(waterGeometry,terrain);water.position.set(0,-.84,-8);scene.add(water);
 // Two reusable profiles keep the original outer extent and placement. One
 // extra inset ring separates the pale sand ledge from the blue-gray cliff.
 function erodedRock(seed:number){
  const segments=10,rings=[{y:0,r:.78},{y:.34,r:1.05},{y:.66,r:.84},{y:1.22,r:.80},{y:1.46,r:.62}];
  const positions:number[]=[],colors:number[]=[],indices:number[]=[];
  const strata=[0x405d67,0xb5ad91,0xb5ad91,0x748c99,0x6e806a].map(c=>new THREE.Color(c));
  const crown=new THREE.Color(0x76896c);
  for(let row=0;row<rings.length;row++)for(let j=0;j<segments;j++){
   const angle=j/segments*Math.PI*2,ring=rings[row];
   const contour=1+.11*Math.sin(angle*3+seed*1.7)+.065*Math.cos(angle*5-seed*.8);
   // Preserve the old four-ring lean and crown anchors after inserting ring 2.
   const profileRow=[0,1,1.5,2,3][row];
   const leanX=.12*Math.sin(seed+profileRow*.4),leanZ=.1*Math.cos(seed*.8+profileRow*.6);
   const y=ring.y+(row? .075*Math.sin(angle*2+seed)+.045*Math.cos(angle*3+seed*.4):0);
   const x=Math.cos(angle)*1.57*ring.r*contour+leanX,z=Math.sin(angle)*1.42*ring.r*contour+leanZ;
   positions.push(x,y,z);
   const color=strata[row].clone();
   color.multiplyScalar(1+.06*Math.sin(angle*3+seed));colors.push(color.r,color.g,color.b);
   if(row<rings.length-1){const a=row*segments+j,b=row*segments+(j+1)%segments,c=a+segments,d=b+segments;indices.push(a,c,b,b,c,d);}
  }
  const top=positions.length/3;positions.push(.12*Math.sin(seed+1.6),1.66,.1*Math.cos(seed*.8+2.4));colors.push(crown.r,crown.g,crown.b);
  for(let j=0;j<segments;j++)indices.push(top,(rings.length-1)*segments+(j+1)%segments,(rings.length-1)*segments+j);
  const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));geometry.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));geometry.setIndex(indices);geometry.computeVertexNormals();return geometry;
 }
 const cliffs=[0,2].map((seed)=>{const mesh=new THREE.InstancedMesh(erodedRock(seed+1),terrain,8);scene.add(mesh);return mesh;});
 const platformGeometry=assemble([
  {geometry:box(1.35,.22,2.8),color:0x768785},
  {geometry:box(.06,.025,2.3),color:0xa8b3a2,position:[-.44,.125,0]},
  {geometry:box(.06,.025,2.3),color:0xa8b3a2,position:[.44,.125,0]},
  {geometry:new THREE.RingGeometry(.355,.405,12),color:0xc1bc9c,position:[0,.13,.55],rotation:[-Math.PI/2,0,0]}
 ]);
 const platforms=new THREE.InstancedMesh(platformGeometry,painted,3);scene.add(platforms);
 const facilityGeometry=assemble([
  {geometry:cylinder(.34,.7),color:0xc9c9b4,position:[0,.36,0]},
  {geometry:new THREE.ConeGeometry(.34,.18,8),color:0x344f68,position:[0,.80,0]},
  {geometry:cylinder(.14,.45),color:0x506d7b,position:[.47,.24,0]},
  {geometry:new THREE.SphereGeometry(.19,10,6),color:0xabc5c6,position:[0,1.01,0]},
  {geometry:box(.11,.10,.018),color:0xb49b62,position:[0,.55,.327]},
  ...[-1,1].map(side=>({geometry:box(.018,.10,.11),color:0xb49b62,position:[side*.327,.55,0] as [number,number,number]}))
 ]);
 const facilities=new THREE.InstancedMesh(facilityGeometry,painted,3);scene.add(facilities);
 const pipeGeometry=assemble([{geometry:cylinder(.075,2.6),color:0x7c979b,rotation:[Math.PI/2,0,0]},...[-1,1].map(z=>({geometry:box(.20,.3,.14),color:0x506773,position:[0,-.13,z] as [number,number,number]}))]);
 const pipes=new THREE.InstancedMesh(pipeGeometry,painted,5);scene.add(pipes);
 // Sparse tapered current marks and broken shore wash stay below projectiles.
 const rippleGeometry=flat([[-.015,-.7],[.012,-.42],[.02,.08],[.004,.7],[-.012,.16],[-.025,-.35]]);
 const ripples=new THREE.InstancedMesh(rippleGeometry,new THREE.MeshBasicMaterial({color:0x315863}),12);scene.add(ripples);
 const shoreGeometry=flat([[-.07,-1.24],[.17,-.82],[.30,-.25],[.27,.28],[.10,.82],[-.12,1.18],[-.06,.85],[.20,.28],[.24,-.24],[.11,-.80],[-.13,-1.19]]);
 const shore=new THREE.InstancedMesh(shoreGeometry,new THREE.MeshBasicMaterial({color:0xb5d4cc,transparent:true,opacity:.34,depthWrite:false}),16);scene.add(shore);
 // Identical projectile geometry/materials share two draws; grow without dropping bodies.
 function projectilePool(kind:'bullet'|'shot',capacity=32){const pool=new THREE.InstancedMesh(geometries[kind],materials[kind],capacity);pool.count=0;pool.frustumCulled=false;scene.add(pool);return pool;}
 let bulletPool:THREE.InstancedMesh=projectilePool('bullet'),shotPool:THREE.InstancedMesh=projectilePool('shot');
 function populate(pool:THREE.InstancedMesh,kind:'bullet'|'shot',bodies:{x:number;y:number}[]){
  if(bodies.length>pool.instanceMatrix.count){const next=projectilePool(kind,2**Math.ceil(Math.log2(bodies.length)));scene.remove(pool);pool.dispose();pool=next;}
  pool.count=bodies.length;temp.rotation.set(0,0,0);temp.scale.set(1,1,1);
  bodies.forEach((b,i)=>{temp.position.set(b.x,.45,-b.y);temp.updateMatrix();pool.setMatrixAt(i,temp.matrix);});pool.instanceMatrix.needsUpdate=true;return pool;
 }
 const meshes=new Map<string,THREE.Mesh>();let dimensions='';
 // Repaint the authored curved shells once at load time. Their vertex positions,
 // normals and extents stay byte-identical; the independent white core is untouched.
 function paintVehicle(geometry:THREE.BufferGeometry,kind:'ship'|'boss'){
  const p=geometry.getAttribute('position'),old=geometry.getAttribute('color'),colors:number[]=[];
  for(let i=0;i<p.count;i++){
   const x=p.getX(i),ax=Math.abs(x),y=p.getY(i),z=p.getZ(i),original=new THREE.Color().setRGB(old.getX(i),old.getY(i),old.getZ(i));
   let color:THREE.Color;
   if(kind==='ship'){
    if(z>.56)color=original; // Existing dark nozzle mouths and cyan exhaust.
    else if(ax<.095&&y>.175&&z>-.40&&z<.21){
     const glint=Math.exp(-(((x+.04)/.037)**2))*THREE.MathUtils.smoothstep(y,.21,.30);
     color=new THREE.Color(0x193d53).lerp(new THREE.Color(0x8ab7c4),glint*.65);
    }else{
     const wing=ax>.34,top=THREE.MathUtils.smoothstep(y,wing?.025:.01,wing?.09:.20);
     color=new THREE.Color(wing?0x28536c:0x456375).lerp(new THREE.Color(wing?0x639db4:0xe6e9db),top);
     if(wing&&ax>.54)color.lerp(new THREE.Color(0xb8d1d4),.28);
     color.lerp(original,.16);
    }
   }else{
    const top=THREE.MathUtils.smoothstep(y,.02,.38);
    if(y>.37&&ax<.25)color=new THREE.Color(0x223b50).lerp(new THREE.Color(0x667f90),top*.65);
    else color=new THREE.Color(0x3c5365).lerp(new THREE.Color(ax>.49?0x9c8367:0x8295a0),top).lerp(original,.18);
    if(z>.85)color=original;
   }
   colors.push(color.r,color.g,color.b);
  }
  geometry.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));
 }
 paintVehicle(geometries.ship,'ship');paintVehicle(geometries.boss,'boss');
 // Two authored Blender meshes share the existing inexpensive diffuse paints.
 // Keep procedural silhouettes if loading fails; never gate gameplay on art.
 let disposed=false;canvas.dataset.pulseArt='loading';
 new GLTFLoader().loadAsync('/games/assets/pulse/pulse-vehicles.glb').then(gltf=>{
  gltf.scene.updateMatrixWorld(true);const imported:THREE.Mesh[]=[];
  gltf.scene.traverse(o=>{if(o instanceof THREE.Mesh)imported.push(o);});
  const replacements=new Map<'ship'|'boss',THREE.BufferGeometry>();
  try{
   for(const [kind,name] of [['ship','interceptor'],['boss','manta_boss']] as const){
    const mesh=imported.find(o=>o.name===name);
    if(!mesh||!mesh.geometry.getAttribute('color')||!mesh.geometry.getAttribute('normal'))throw Error('Missing vehicle geometry');
    const geometry=mesh.geometry.clone().applyMatrix4(mesh.matrixWorld);geometry.clearGroups();paintVehicle(geometry,kind);replacements.set(kind,geometry);
   }
   if(disposed){for(const g of replacements.values())g.dispose();return;}
   for(const [kind,geometry] of replacements){const old=geometries[kind];geometries[kind]=geometry;if(kind==='ship')ship.geometry=geometry;else for(const m of meshes.values())if(m.geometry===old)m.geometry=geometry;old.dispose();}
   canvas.dataset.pulseArt='ready';
  }catch{for(const g of replacements.values())g.dispose();if(!disposed)canvas.dataset.pulseArt='fallback';}
  finally{for(const mesh of imported){mesh.geometry.dispose();for(const material of Array.isArray(mesh.material)?mesh.material:[mesh.material])material.dispose();}}
 }).catch(()=>{if(!disposed)canvas.dataset.pulseArt='fallback';});
 function sync(key:string,kind:keyof typeof geometries,x:number,y:number,scale=1) {let m=meshes.get(key);if(!m){m=new THREE.Mesh(geometries[kind],materials[kind]);meshes.set(key,m);scene.add(m);}m.visible=true;m.position.set(x,kind==='beam'?0:.45,-y);m.scale.setScalar(scale);return m;}
 function resize(){const w=canvas.clientWidth,h=canvas.clientHeight;if(dimensions===`${w},${h}`)return;dimensions=`${w},${h}`;renderer.setSize(w,h,false);camera.aspect=w/h; // Keep the entire combat width visible at 320px and in landscape.
 camera.fov=camera.aspect<.65?64:48;camera.updateProjectionMatrix();}
 function draw(s:State){resize();ship.position.set(s.x,.4,-s.y);ship.rotation.z=-s.x*.025;exhaust.scale.z=.88+.12*Math.sin(s.time*24);ship.visible=s.invulnerable<=0||Math.floor(s.time*12)%2===0;core.position.set(s.x,.45,-s.y);for(const m of meshes.values())m.visible=false;
 for(const e of s.enemies){const m=sync(`e${e.id}`,e.kind,e.x,e.y);m.rotation.y=0;m.rotation.z=Math.sin(s.time*1.8+e.id)*.04;}
 bulletPool=populate(bulletPool,'bullet',s.bullets);shotPool=populate(shotPool,'shot',s.shots);
 s.beams.forEach((b,i)=>{const m=sync(`beam${i}`,'beam',b.x,5.5);m.scale.set(b.wide,1,1);(m.material as THREE.MeshBasicMaterial).opacity=b.age<1.3?.15+.13*(Math.sin(b.age*18)+1):.85;});
 for(const [key,m] of meshes)if(!m.visible){scene.remove(m);meshes.delete(key);}
 // Uneven opposing shores; the same reusable rocks vary in height, width and phase.
 const scroll=(distance:number)=>-((distance-s.time*1.2)%24+24)%24+2;
 const bankDistances=[.3,2.8,6.5,8.6,12.8,15.1,18.9,22.3];
 for(let i=0;i<16;i++){
  const side=i%2?1:-1,row=Math.floor(i/2),sx=.73+(i*7%5)*.13,sz=.74+(i*3%4)*.22,angle=(side<0?Math.PI:0)+(.5-(i*3%7)/6)*.8;
  const x=side*(5.62+(i*5%7)*.11),z=scroll(bankDistances[row]+(side<0?1.45:0));
  temp.position.set(x,-1.25,z);temp.rotation.set(0,angle,0);temp.scale.set(sx,.58+(i*5%7)*.15,sz);temp.updateMatrix();cliffs[(i+row)%2].setMatrixAt(row,temp.matrix);
  // Broken, low-contrast waterline strokes follow each rock's inner edge.
  temp.position.set(x-side*1.53*sx,-.83,z);temp.rotation.set(0,side<0?Math.PI:0,0);temp.scale.set(1,1,sz*.8);temp.updateMatrix();shore.setMatrixAt(i,temp.matrix);
 }
 const pads=[{side:-1,distance:3.5},{side:1,distance:10.8},{side:-1,distance:19.5}];
 for(let i=0;i<pads.length;i++){const {side,distance}=pads[i],z=scroll(distance);temp.position.set(side*4.85,-.42,z);temp.rotation.set(0,0,0);temp.scale.set(1,1,1);temp.updateMatrix();platforms.setMatrixAt(i,temp.matrix);temp.position.set(side*5.08,-.31,z-.75);temp.updateMatrix();facilities.setMatrixAt(i,temp.matrix);}
 for(let i=0;i<5;i++){const side=i%2?1:-1;temp.position.set(side*4.52,-.13,scroll([2.5,10,5.6,13.1,20.2][i]));temp.rotation.set(0,0,0);temp.scale.set(1,1,1);temp.updateMatrix();pipes.setMatrixAt(i,temp.matrix);}
 for(let i=0;i<12;i++){temp.position.set((i%2?1:-1)*(2.8+(i%3)*.35),-.83,scroll(Math.floor(i/2)*4));temp.rotation.set(0,0,0);temp.scale.set(1,1,1);temp.updateMatrix();ripples.setMatrixAt(i,temp.matrix);}
 for(const instanced of [...cliffs,platforms,facilities,pipes,ripples,shore])instanced.instanceMatrix.needsUpdate=true;
 renderer.setClearColor(s.hit>0?0x42233b:0x214651);renderer.render(scene,camera);}
 const ray=new THREE.Raycaster(),plane=new THREE.Plane(new THREE.Vector3(0,1,0),-.4),point=new THREE.Vector3();
 function pointer(x:number,y:number){const r=canvas.getBoundingClientRect();ray.setFromCamera(new THREE.Vector2((x-r.left)/r.width*2-1,-(y-r.top)/r.height*2+1),camera);if(!ray.ray.intersectPlane(plane,point))return null;return {x:point.x,y:-point.z};}
 function project(x:number,y:number){const p=new THREE.Vector3(x,.4,-y).project(camera),r=canvas.getBoundingClientRect();return {x:r.left+(p.x+1)/2*r.width,y:r.top+(1-p.y)/2*r.height};}
 function dispose(){disposed=true;for(const g of Object.values(geometries))g.dispose();for(const m of Object.values(materials))m.dispose();scene.traverse(o=>{if(o instanceof THREE.Mesh){if(o instanceof THREE.InstancedMesh)o.dispose();o.geometry.dispose();if(!Array.isArray(o.material))o.material.dispose();}});renderer.dispose();}
 return {draw,pointer,project,dispose,stats:()=>({calls:renderer.info.render.calls,triangles:renderer.info.render.triangles})};
}
